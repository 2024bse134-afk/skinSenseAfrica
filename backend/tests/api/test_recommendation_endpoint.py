from app.api.dependencies import get_assessment_repository, get_recommendation_llm_client
from app.api.repository import AssessmentRecord, InMemoryAssessmentRepository
from app.domain.safety.policy import evaluate_safety
from app.infrastructure.llm.client import MockLLMClient
from app.main import app
from tests.conftest import make_assessment_result
from tests.http_client import ASGITestClient, async_dependency


class CountingLLM(MockLLMClient):
    def __init__(self):
        super().__init__()
        self.calls = 0

    async def generate(self, messages):
        self.calls += 1
        return await super().generate(messages)


def make_record(assessment_id, questionnaire, **assessment_updates):
    assessment = make_assessment_result(**assessment_updates)
    safety = evaluate_safety(assessment, questionnaire)
    return AssessmentRecord(
        id=assessment_id,
        status={
            "routine": "questionnaire_completed",
            "professional_review": "professional_review_required",
            "urgent": "urgent",
            "emergency": "emergency",
        }[safety.urgency.value],
        assessment=assessment,
        questionnaire=questionnaire,
        safety=safety,
    )


def client_for(record, llm):
    repository = InMemoryAssessmentRepository()
    repository.upsert(record)
    app.dependency_overrides[get_assessment_repository] = async_dependency(repository)
    app.dependency_overrides[get_recommendation_llm_client] = async_dependency(llm)
    return ASGITestClient(), repository


def test_routine_recommendation_endpoint_is_operational(questionnaire) -> None:
    llm = CountingLLM()
    client, repository = client_for(make_record("asm-routine", questionnaire), llm)
    response = client.post("/v1/assessments/asm-routine/recommendation")
    assert response.status_code == 200
    assert response.json()["confidence_level"] == "high"
    assert response.json()["safety"]["urgency"] == "routine"
    assert llm.calls == 1
    assert repository.get("asm-routine").status == "completed"

    repeated = client.post("/v1/assessments/asm-routine/recommendation")
    assert repeated.status_code == 200
    assert llm.calls == 1
    app.dependency_overrides.clear()


def test_professional_review_generates_cautious_context(questionnaire) -> None:
    llm = CountingLLM()
    record = make_record(
        "asm-review",
        questionnaire,
        confidence_level="low",
        confidence_score=0.3,
    )
    client, _ = client_for(record, llm)
    response = client.post("/v1/assessments/asm-review/recommendation")
    assert response.status_code == 200
    assert response.json()["guidance_level"] == "professional_review"
    assert response.json()["referral_required"] is True
    assert response.json()["draft"]["recommended_action"]["type"] == "professional_review"
    assert llm.calls == 1
    app.dependency_overrides.clear()


def test_urgent_and_emergency_generate_escalation_context(
    questionnaire_payload,
) -> None:
    for field in ("rapidly_spreading", "difficulty_breathing"):
        from app.domain.questionnaire.models import Questionnaire

        q = Questionnaire.model_validate({**questionnaire_payload, field: "yes"})
        llm = CountingLLM()
        client, _ = client_for(make_record(f"asm-{field}", q), llm)
        response = client.post(f"/v1/assessments/asm-{field}/recommendation")
        assert response.status_code == 200
        assert response.json()["guidance_level"] == "urgent_referral"
        assert response.json()["draft"]["recommended_action"]["type"] == "referral"
        assert response.json()["draft"]["recommended_action"]["steps"] == []
        assert llm.calls == 1
        app.dependency_overrides.clear()


def test_uncertain_condition_still_blocks_recommendation(questionnaire) -> None:
    llm = CountingLLM()
    record = make_record(
        "asm-uncertain",
        questionnaire,
        condition="other_or_uncertain",
        confidence_level="unknown",
        confidence_score=None,
        recommendation_status="blocked",
    )
    client, _ = client_for(record, llm)

    response = client.post("/v1/assessments/asm-uncertain/recommendation")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "RECOMMENDATION_BLOCKED"
    assert llm.calls == 0
    app.dependency_overrides.clear()


def test_not_ready_and_missing_use_stable_envelope(questionnaire) -> None:
    repository = InMemoryAssessmentRepository()
    draft = repository.create()
    app.dependency_overrides[get_assessment_repository] = async_dependency(repository)
    app.dependency_overrides[get_recommendation_llm_client] = async_dependency(CountingLLM())
    client = ASGITestClient()

    conflict = client.post(f"/v1/assessments/{draft.id}/recommendation")
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "ASSESSMENT_STATE_CONFLICT"
    missing = client.get("/v1/assessments/missing")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "ASSESSMENT_NOT_FOUND"
    app.dependency_overrides.clear()
