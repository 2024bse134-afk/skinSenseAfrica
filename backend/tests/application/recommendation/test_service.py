import asyncio
import json

import pytest
from pydantic import ValidationError

from app.application.recommendation.service import (
    RecommendationBlockedError,
    RecommendationUnavailableError,
    RedFlagEscalationRequiredError,
    generate_recommendation,
    parse_llm_output,
)
from app.domain.recommendation.models import (
    GuidanceLevel,
    RecommendationAssessmentContext,
    RecommendationInput,
    SkinContext,
)
from app.domain.questionnaire.models import Questionnaire
from app.domain.safety.policy import evaluate_safety
from app.infrastructure.llm.client import MockLLMClient
from tests.conftest import make_assessment_result


def valid_draft_json() -> str:
    return json.dumps(
        {
            "explanation": "Educational summary.",
            "possible_contributing_factors": ["occlusive products"],
            "skin_tone_considerations": ["use gentle products"],
            "recommended_action": {
                "type": "self_care",
                "urgency": "routine",
                "steps": ["cleanse gently"],
                "referral_reason": None,
            },
            "prevention": ["patch test"],
            "warning_signs": ["rapid worsening"],
            "limitations": ["not a diagnosis"],
        }
    )


def recommendation_input(urgency: str = "routine", questionnaire=None) -> RecommendationInput:
    if questionnaire is None:
        raise AssertionError("questionnaire fixture is required")

    questionnaire_data = questionnaire.model_dump(mode="json")
    assessment_updates = {}
    if urgency == "professional_review":
        assessment_updates = {
            "confidence_level": "low",
            "confidence_score": 0.35,
        }
    elif urgency == "urgent":
        questionnaire_data["rapidly_spreading"] = "yes"
    elif urgency == "emergency":
        questionnaire_data["difficulty_breathing"] = "yes"

    effective_questionnaire = Questionnaire.model_validate(questionnaire_data)
    assessment_result = make_assessment_result(**assessment_updates)
    safety_result = evaluate_safety(assessment_result, effective_questionnaire)
    assert safety_result.urgency.value == urgency

    return RecommendationInput(
        assessment_id="asm-001",
        assessment=RecommendationAssessmentContext(
            condition=assessment_result.condition,
            confidence_level=assessment_result.confidence_level,
            confidence_score=assessment_result.confidence_score,
            engine_version=assessment_result.engine_version,
        ),
        questionnaire=effective_questionnaire,
        safety=safety_result,
        allowed_guidance_level=(
            GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
            if urgency == "routine"
            else GuidanceLevel.PROFESSIONAL_REVIEW
        ),
        skin_context=SkinContext(tone_group="melanin_rich"),
    )


class CountingLLM(MockLLMClient):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.calls = 0
        self.messages = None

    async def generate(self, messages):
        self.calls += 1
        self.messages = messages
        return await super().generate(messages)


def test_allowed_routine_recommendation_remains_operational(questionnaire) -> None:
    client = CountingLLM(response_text=valid_draft_json())
    result = asyncio.run(generate_recommendation(recommendation_input(questionnaire=questionnaire), client))
    assert client.calls == 1
    assert result.condition.value == "acne"
    assert result.confidence_level.value == "high"
    assert result.guidance_level is GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
    assert result.safety.urgency.value == "routine"


@pytest.mark.parametrize(
    ("urgency", "expected"),
    [
        ("professional_review", RecommendationBlockedError),
        ("urgent", RedFlagEscalationRequiredError),
        ("emergency", RedFlagEscalationRequiredError),
    ],
)
def test_safety_prevents_llm_call(questionnaire, urgency, expected) -> None:
    client = CountingLLM(response_text=valid_draft_json())
    with pytest.raises(expected):
        asyncio.run(generate_recommendation(recommendation_input(urgency, questionnaire), client))
    assert client.calls == 0


def test_recommendation_input_rejects_every_image_vector(questionnaire) -> None:
    base = recommendation_input(questionnaire=questionnaire).model_dump(mode="json")
    for field, value in (
        ("image", b"bytes"),
        ("base64", "abc"),
        ("image_path", "/tmp/x"),
        ("image_url", "https://example.invalid/x"),
        ("original_filename", "patient.jpg"),
        ("exif", {"gps": "x"}),
        ("provider_raw_response", "{}"),
    ):
        with pytest.raises(ValidationError):
            RecommendationInput.model_validate({**base, field: value})


def test_malformed_recommendation_retries_then_fails(questionnaire) -> None:
    client = CountingLLM(response_text="{not-json")
    with pytest.raises(RecommendationUnavailableError):
        asyncio.run(generate_recommendation(recommendation_input(questionnaire=questionnaire), client))
    assert client.calls == 2


def test_structured_recommendation_parser_still_validates() -> None:
    assert parse_llm_output(valid_draft_json()).recommended_action.type == "self_care"
    with pytest.raises(Exception):
        parse_llm_output(json.dumps({"explanation": "missing fields"}))
