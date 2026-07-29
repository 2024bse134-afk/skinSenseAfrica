from app.api.dependencies import (
    get_assessment_repository,
    get_image_assessment_provider,
    get_recommendation_llm_client,
)
from app.api.repository import InMemoryAssessmentRepository
from app.infrastructure.assessment.mock import MockImageAssessmentProvider, MockProviderScenario
from app.infrastructure.llm.client import MockLLMClient
from app.main import app
from tests.conftest import make_image_bytes
from tests.http_client import ASGITestClient, async_dependency


def test_full_mock_routine_flow_returns_educational_guidance(questionnaire_payload) -> None:
    repository = InMemoryAssessmentRepository()
    app.dependency_overrides[get_assessment_repository] = async_dependency(repository)
    app.dependency_overrides[get_image_assessment_provider] = async_dependency(
        MockImageAssessmentProvider()
    )
    app.dependency_overrides[get_recommendation_llm_client] = async_dependency(
        MockLLMClient()
    )
    client = ASGITestClient()

    created = client.post("/v1/assessments").json()
    assessment_id = created["id"]
    assessed = client.post(
        f"/v1/assessments/{assessment_id}/image-assessment",
        files={"image": ("synthetic.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert assessed.status_code == 200
    assert assessed.json()["confidence_level"] == "high"

    safety = client.put(
        f"/v1/assessments/{assessment_id}/questionnaire",
        json=questionnaire_payload,
    )
    assert safety.status_code == 200
    assert safety.json()["safety"]["recommendation_permission"] == "allowed"

    recommendation = client.post(f"/v1/assessments/{assessment_id}/recommendation")
    assert recommendation.status_code == 200
    assert recommendation.json()["draft"]["recommended_action"]["type"] == "self_care"
    app.dependency_overrides.clear()


def test_retake_flow_never_accepts_questionnaire(questionnaire_payload) -> None:
    repository = InMemoryAssessmentRepository()
    app.dependency_overrides[get_assessment_repository] = async_dependency(repository)
    app.dependency_overrides[get_image_assessment_provider] = async_dependency(
        MockImageAssessmentProvider(MockProviderScenario.RETAKE_REQUIRED)
    )
    client = ASGITestClient()
    assessment_id = client.post("/v1/assessments").json()["id"]

    assessed = client.post(
        f"/v1/assessments/{assessment_id}/image-assessment",
        files={"image": ("synthetic.png", make_image_bytes("PNG"), "image/png")},
    )
    assert assessed.json()["assessment_status"] == "retake_required"
    questionnaire = client.put(
        f"/v1/assessments/{assessment_id}/questionnaire",
        json=questionnaire_payload,
    )
    assert questionnaire.status_code == 409
    assert questionnaire.json()["error"]["code"] == "ASSESSMENT_STATE_CONFLICT"
    app.dependency_overrides.clear()
