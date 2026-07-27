from fastapi.testclient import TestClient

from app.api.dependencies import get_assessment_repository, get_referral_repository
from app.api.repository import InMemoryAssessmentRepository, InMemoryReferralRepository
from app.main import app


def _make_client(
    assessments: InMemoryAssessmentRepository | None = None,
    referrals: InMemoryReferralRepository | None = None,
) -> TestClient:
    assessment_repository = assessments or InMemoryAssessmentRepository()
    referral_repository = referrals or InMemoryReferralRepository()
    app.dependency_overrides[get_assessment_repository] = lambda: assessment_repository
    app.dependency_overrides[get_referral_repository] = lambda: referral_repository
    return TestClient(app)


def _create_assessment(client: TestClient) -> str:
    response = client.post("/v1/assessments")
    assert response.status_code == 201
    assert response.json()["status"] == "draft"
    return response.json()["id"]


def _upload_image(client: TestClient, assessment_id: str) -> None:
    response = client.post(
        f"/v1/assessments/{assessment_id}/image",
        files={"image": ("skin.jpg", b"pretend image", "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json() == {"id": assessment_id, "status": "image_uploaded"}


def test_create_assessment_persists_draft() -> None:
    repo = InMemoryAssessmentRepository()
    client = _make_client(assessments=repo)

    assessment_id = _create_assessment(client)

    assert repo.get(assessment_id) is not None
    app.dependency_overrides.clear()


def test_upload_image_validates_type_and_persists_temporarily() -> None:
    repo = InMemoryAssessmentRepository()
    client = _make_client(assessments=repo)
    assessment_id = _create_assessment(client)

    invalid = client.post(
        f"/v1/assessments/{assessment_id}/image",
        files={"image": ("note.txt", b"not an image", "text/plain")},
    )
    assert invalid.status_code == 400

    _upload_image(client, assessment_id)
    assert repo.get_image(assessment_id) == (b"pretend image", "image/jpeg")
    app.dependency_overrides.clear()


def test_upload_image_missing_assessment_returns_404() -> None:
    client = _make_client()

    response = client.post(
        "/v1/assessments/missing/image",
        files={"image": ("skin.jpg", b"image", "image/jpeg")},
    )

    assert response.status_code == 404
    app.dependency_overrides.clear()


def test_classification_requires_image_then_uses_mock_result() -> None:
    client = _make_client()
    assessment_id = _create_assessment(client)

    missing_image = client.post(f"/v1/assessments/{assessment_id}/classify")
    assert missing_image.status_code == 409

    _upload_image(client, assessment_id)
    response = client.post(f"/v1/assessments/{assessment_id}/classify")

    assert response.status_code == 200
    assert response.json()["condition"] == "acne"
    assert response.json()["confidence"] == 0.85
    assert response.json()["model_version"] == "mock-cv-1"
    app.dependency_overrides.clear()


def test_classification_missing_assessment_returns_404() -> None:
    client = _make_client()

    assert client.post("/v1/assessments/missing/classify").status_code == 404
    app.dependency_overrides.clear()


def test_questionnaire_requires_classification_then_updates_state() -> None:
    client = _make_client()
    assessment_id = _create_assessment(client)
    questionnaire = {"itching": True, "pain_level": 2}

    early = client.put(f"/v1/assessments/{assessment_id}/questionnaire", json=questionnaire)
    assert early.status_code == 409

    _upload_image(client, assessment_id)
    assert client.post(f"/v1/assessments/{assessment_id}/classify").status_code == 200
    response = client.put(f"/v1/assessments/{assessment_id}/questionnaire", json=questionnaire)

    assert response.status_code == 200
    assert response.json() == {"id": assessment_id, "status": "questionnaire_completed"}
    app.dependency_overrides.clear()


def test_questionnaire_missing_assessment_returns_404() -> None:
    client = _make_client()

    assert client.put("/v1/assessments/missing/questionnaire", json={}).status_code == 404
    app.dependency_overrides.clear()


def test_get_assessment_returns_current_state() -> None:
    client = _make_client()
    assessment_id = _create_assessment(client)
    _upload_image(client, assessment_id)
    assert client.post(f"/v1/assessments/{assessment_id}/classify").status_code == 200
    assert client.put(
        f"/v1/assessments/{assessment_id}/questionnaire", json={"itching": True}
    ).status_code == 200

    response = client.get(f"/v1/assessments/{assessment_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == assessment_id
    assert body["status"] == "questionnaire_completed"
    assert body["classification"]["condition"] == "acne"
    assert body["questionnaire"]["itching"] is True
    assert body["recommendation"] is None
    app.dependency_overrides.clear()


def test_get_assessment_missing_returns_404() -> None:
    client = _make_client()

    assert client.get("/v1/assessments/missing").status_code == 404
    app.dependency_overrides.clear()


def test_create_referral_stores_transient_request() -> None:
    referrals = InMemoryReferralRepository()
    client = _make_client(referrals=referrals)

    response = client.post(
        "/v1/referrals",
        json={
            "assessment_id": "asm-1",
            "name": "Ada Lovelace",
            "contact": "ada@example.test",
            "reason": "Needs clinical review",
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "received"
    assert response.json()["id"] in referrals._store
    app.dependency_overrides.clear()
