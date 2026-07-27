from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.api.dependencies import get_assessment_repository, get_recommendation_llm_client
from app.api.repository import AssessmentRecord, InMemoryAssessmentRepository
from app.domain.recommendation.models import ClassificationResult, Questionnaire, SkinContext, SupportedCondition
from app.infrastructure.llm.client import MockLLMClient
from app.main import app


class _FailingMockLLMClient(MockLLMClient):
    def __init__(self) -> None:
        super().__init__(should_raise=True)


def _classification(confidence: float = 0.9) -> ClassificationResult:
    return ClassificationResult(
        condition=SupportedCondition.ACNE,
        confidence=confidence,
        model_version="clf-v3",
        inference_ms=120,
        predicted_at=datetime.now(timezone.utc),
    )


def _make_record(
    assessment_id: str,
    status: str,
    questionnaire: Questionnaire | None,
    confidence: float = 0.9,
) -> AssessmentRecord:
    return AssessmentRecord(
        id=assessment_id,
        status=status,
        classification=_classification(confidence=confidence),
        questionnaire=questionnaire,
        skin_context=SkinContext(tone_group="melanin_rich"),
    )


def _make_client(repo: InMemoryAssessmentRepository, llm_client: MockLLMClient) -> TestClient:
    app.dependency_overrides[get_assessment_repository] = lambda: repo
    app.dependency_overrides[get_recommendation_llm_client] = lambda: llm_client
    return TestClient(app)


def test_create_recommendation_happy_path() -> None:
    repo = InMemoryAssessmentRepository()
    repo.upsert(
        _make_record(
            assessment_id="asm-100",
            status="questionnaire_completed",
            questionnaire=Questionnaire(itching=True, pain_level=2),
            confidence=0.9,
        )
    )

    client = _make_client(repo, MockLLMClient())
    response = client.post("/v1/assessments/asm-100/recommendation")

    assert response.status_code == 200
    body = response.json()
    assert body["assessment_id"] == "asm-100"
    assert body["condition"] == "acne"
    assert body["guidance_level"] == "condition_specific_guidance"

    persisted = repo.get("asm-100")
    assert persisted is not None
    assert persisted.status == "completed"

    app.dependency_overrides.clear()


def test_create_recommendation_wrong_status_returns_conflict() -> None:
    repo = InMemoryAssessmentRepository()
    repo.upsert(
        _make_record(
            assessment_id="asm-101",
            status="classified",
            questionnaire=None,
            confidence=0.9,
        )
    )

    client = _make_client(repo, MockLLMClient())
    response = client.post("/v1/assessments/asm-101/recommendation")

    assert response.status_code == 409
    app.dependency_overrides.clear()


def test_create_recommendation_llm_unavailable_contract() -> None:
    repo = InMemoryAssessmentRepository()
    repo.upsert(
        _make_record(
            assessment_id="asm-102",
            status="questionnaire_completed",
            questionnaire=Questionnaire(itching=True),
            confidence=0.9,
        )
    )

    client = _make_client(repo, _FailingMockLLMClient())
    response = client.post("/v1/assessments/asm-102/recommendation")

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "RECOMMENDATION_UNAVAILABLE",
            "message": "A safe recommendation could not be generated.",
            "retryable": True,
            "details": None,
        }
    }
    app.dependency_overrides.clear()


def test_create_recommendation_nonexistent_assessment_returns_404() -> None:
    repo = InMemoryAssessmentRepository()
    client = _make_client(repo, MockLLMClient())

    response = client.post("/v1/assessments/missing/recommendation")

    assert response.status_code == 404
    app.dependency_overrides.clear()


def test_create_recommendation_referral_required_updates_professional_review_status() -> None:
    repo = InMemoryAssessmentRepository()
    repo.upsert(
        _make_record(
            assessment_id="asm-103",
            status="questionnaire_completed",
            questionnaire=Questionnaire(swelling=True),
            confidence=0.95,
        )
    )

    client = _make_client(repo, MockLLMClient())
    response = client.post("/v1/assessments/asm-103/recommendation")

    assert response.status_code == 200
    body = response.json()
    assert body["referral_required"] is True
    assert body["guidance_level"] == "professional_review"

    persisted = repo.get("asm-103")
    assert persisted is not None
    assert persisted.status == "professional_review_required"

    app.dependency_overrides.clear()
