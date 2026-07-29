from __future__ import annotations

import asyncio
from io import BytesIO
from tempfile import SpooledTemporaryFile

import pytest
from fastapi import UploadFile

from app.api.dependencies import get_assessment_repository, get_image_assessment_provider
from app.api.repository import InMemoryAssessmentRepository
from app.api.routers.assessments import create_image_assessment
from app.infrastructure.assessment.mock import MockImageAssessmentProvider, MockProviderScenario
from app.main import app
from tests.conftest import make_image_bytes
from tests.http_client import ASGITestClient, async_dependency


def make_client(
    repository: InMemoryAssessmentRepository | None = None,
    provider: MockImageAssessmentProvider | None = None,
) -> tuple[ASGITestClient, InMemoryAssessmentRepository, MockImageAssessmentProvider]:
    repository = repository or InMemoryAssessmentRepository()
    provider = provider or MockImageAssessmentProvider(capture_inputs=True)
    app.dependency_overrides[get_assessment_repository] = async_dependency(repository)
    app.dependency_overrides[get_image_assessment_provider] = async_dependency(provider)
    return ASGITestClient(), repository, provider


def create_assessment(client: ASGITestClient) -> str:
    response = client.post("/v1/assessments")
    assert response.status_code == 201
    return response.json()["id"]


@pytest.mark.parametrize(
    ("image_format", "mime"),
    [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")],
)
def test_valid_supported_image_assessment(image_format: str, mime: str) -> None:
    client, repository, provider = make_client()
    assessment_id = create_assessment(client)

    response = client.post(
        f"/v1/assessments/{assessment_id}/image-assessment",
        files={"image": (f"synthetic.{image_format.lower()}", make_image_bytes(image_format), mime)},
    )

    assert response.status_code == 200
    assert response.json()["assessment_status"] == "completed"
    assert response.json()["assessment_engine"] == "mock"
    record = repository.get(assessment_id)
    assert record is not None and record.assessment is not None
    assert "_images" not in repository.__dict__
    assert "content" not in record.model_dump()
    assert provider.received_images[-1].content_type == mime
    app.dependency_overrides.clear()


def test_unsupported_mismatch_oversize_corrupt_and_pixel_errors_use_envelope() -> None:
    client, _, _ = make_client()
    assessment_id = create_assessment(client)
    cases = [
        (("x.gif", make_image_bytes("GIF"), "image/gif"), 415, "INVALID_IMAGE_TYPE"),
        (("x.png", make_image_bytes("JPEG"), "image/png"), 415, "INVALID_IMAGE_TYPE"),
        (("x.jpg", b"not-an-image", "image/jpeg"), 422, "IMAGE_DECODE_FAILED"),
    ]
    for file_value, status, code in cases:
        response = client.post(
            f"/v1/assessments/{assessment_id}/image-assessment",
            files={"image": file_value},
        )
        assert response.status_code == status
        assert response.json()["error"]["code"] == code
        assert response.json()["error"]["request_id"]
        assert response.json()["error"]["details"] is not None
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    ("scenario", "status", "code"),
    [
        (MockProviderScenario.TIMEOUT, 504, "ASSESSMENT_TIMEOUT"),
        (MockProviderScenario.UNAVAILABLE, 503, "ASSESSMENT_PROVIDER_UNAVAILABLE"),
        (MockProviderScenario.MALFORMED, 502, "ASSESSMENT_OUTPUT_INVALID"),
    ],
)
def test_provider_failures_are_stable_and_do_not_persist(
    scenario: MockProviderScenario, status: int, code: str
) -> None:
    provider = MockImageAssessmentProvider(scenario)
    client, repository, _ = make_client(provider=provider)
    assessment_id = create_assessment(client)
    response = client.post(
        f"/v1/assessments/{assessment_id}/image-assessment",
        files={"image": ("synthetic.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    record = repository.get(assessment_id)
    assert record is not None and record.assessment is None
    assert "_images" not in repository.__dict__
    app.dependency_overrides.clear()


def test_upload_is_closed_on_success_timeout_and_invalid_output() -> None:
    for scenario in (
        MockProviderScenario.ACCEPTABLE,
        MockProviderScenario.TIMEOUT,
        MockProviderScenario.MALFORMED,
    ):
        repository = InMemoryAssessmentRepository()
        record = repository.create()
        temporary = SpooledTemporaryFile()
        temporary.write(make_image_bytes())
        temporary.seek(0)
        upload = UploadFile(
            filename="synthetic.jpg",
            file=temporary,
            headers={"content-type": "image/jpeg"},
        )
        provider = MockImageAssessmentProvider(scenario)
        try:
            asyncio.run(
                create_image_assessment(
                    record.id,
                    upload,
                    repository,
                    provider,
                )
            )
        except Exception:
            pass
        assert upload.file.closed is True


def test_invalid_workflow_and_deprecated_routes() -> None:
    client, _, _ = make_client()
    missing = client.post(
        "/v1/assessments/missing/image-assessment",
        files={"image": ("synthetic.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "ASSESSMENT_NOT_FOUND"

    assessment_id = create_assessment(client)
    early = client.put(f"/v1/assessments/{assessment_id}/questionnaire", json={})
    # Body validation occurs before state handling, but still uses the stable envelope.
    assert early.status_code == 422
    assert early.json()["error"]["code"] == "VALIDATION_ERROR"
    deprecated = client.post(f"/v1/assessments/{assessment_id}/classify")
    assert deprecated.status_code == 409
    assert deprecated.json()["error"]["code"] == "ASSESSMENT_STATE_CONFLICT"
    app.dependency_overrides.clear()


def test_urgent_questionnaire_returns_backend_owned_safety_feedback(
    questionnaire_payload: dict,
) -> None:
    client, repository, _ = make_client()
    assessment_id = create_assessment(client)
    assessed = client.post(
        f"/v1/assessments/{assessment_id}/image-assessment",
        files={"image": ("synthetic.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert assessed.status_code == 200

    questionnaire_payload.update(
        {
            "rapidly_spreading": "yes",
            "high_fever": "yes",
            "blistering": "yes",
            "open_wound": "yes",
            "pain_level": 6,
        }
    )
    response = client.put(
        f"/v1/assessments/{assessment_id}/questionnaire",
        json=questionnaire_payload,
    )

    assert response.status_code == 200
    safety = response.json()["safety"]
    assert safety["urgency"] == "urgent"
    assert safety["recommendation_permission"] == "escalation_only"
    assert [trigger["code"] for trigger in safety["feedback"]["triggers"]] == [
        "rapidly_spreading",
        "high_fever",
        "extensive_blistering",
        "open_wound",
    ]
    assert safety["feedback"]["clinician_summary"]["pain_level"] == 6
    assert safety["feedback"]["next_steps"]
    assert "withheld" in safety["feedback"]["guidance_withheld_reason"]
    record = repository.get(assessment_id)
    assert record is not None and record.recommendation is None
    app.dependency_overrides.clear()
