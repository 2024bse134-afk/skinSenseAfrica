import asyncio
import json

import pytest
from pydantic import ValidationError

from app.application.recommendation.service import (
    RecommendationBlockedError,
    RecommendationUnavailableError,
    generate_recommendation,
    parse_llm_output,
)
from app.domain.recommendation.models import (
    GuidanceLevel,
    RecommendationAssessmentContext,
    RecommendationInput,
    SkinContext,
)
from app.domain.recommendation.policy import decide_guidance
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
    elif urgency == "blocked":
        assessment_updates = {
            "condition": "other_or_uncertain",
            "confidence_level": "unknown",
            "confidence_score": None,
            "recommendation_status": "blocked",
        }

    effective_questionnaire = Questionnaire.model_validate(questionnaire_data)
    assessment_result = make_assessment_result(**assessment_updates)
    safety_result = evaluate_safety(assessment_result, effective_questionnaire)
    expected_urgency = "professional_review" if urgency == "blocked" else urgency
    assert safety_result.urgency.value == expected_urgency

    return RecommendationInput(
        assessment_id="asm-001",
        assessment=RecommendationAssessmentContext(
            condition=assessment_result.condition,
            confidence_level=assessment_result.confidence_level,
            confidence_score=assessment_result.confidence_score,
            visual_findings=assessment_result.visual_findings,
            alternative_conditions=assessment_result.alternative_conditions,
            needs_more_information=assessment_result.needs_more_information,
            engine_version=assessment_result.engine_version,
        ),
        questionnaire=effective_questionnaire,
        safety=safety_result,
        allowed_guidance_level=decide_guidance(
            assessment_result.confidence_level,
            safety_result,
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


@pytest.mark.parametrize("urgency", ["professional_review", "urgent", "emergency"])
def test_safety_shapes_the_llm_output_without_ending_showcase(
    questionnaire, urgency
) -> None:
    client = CountingLLM(response_text=valid_draft_json())
    result = asyncio.run(
        generate_recommendation(recommendation_input(urgency, questionnaire), client)
    )

    assert client.calls == 1
    if urgency in {"urgent", "emergency"}:
        assert result.guidance_level is GuidanceLevel.URGENT_REFERRAL
        assert result.draft.recommended_action.type == "referral"
        assert result.draft.recommended_action.steps == []
    else:
        assert result.guidance_level is GuidanceLevel.PROFESSIONAL_REVIEW
        assert result.draft.recommended_action.type == "professional_review"
        assert result.draft.recommended_action.steps == ["cleanse gently"]


def test_hard_block_still_prevents_llm_call(questionnaire) -> None:
    client = CountingLLM(response_text=valid_draft_json())
    with pytest.raises(RecommendationBlockedError):
        asyncio.run(
            generate_recommendation(
                recommendation_input("blocked", questionnaire),
                client,
            )
        )
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
