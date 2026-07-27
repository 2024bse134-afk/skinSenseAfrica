import asyncio
import json
from datetime import datetime, timezone

import pytest

from app.application.recommendation.service import (
    RecommendationUnavailableError,
    RecommendationValidationError,
    assemble_recommendation_result,
    enforce_guidance_consistency,
    generate_recommendation,
    parse_llm_output,
)
from app.domain.recommendation.models import (
    ClassificationResult,
    GuidanceLevel,
    Questionnaire,
    RecommendationDraft,
    RecommendationInput,
    SkinContext,
    SupportedCondition,
)
from app.infrastructure.llm.client import MockLLMClient


def _base_input(
    confidence: float = 0.9,
    questionnaire: Questionnaire | None = None,
) -> RecommendationInput:
    return RecommendationInput(
        assessment_id="asm-001",
        classifier=ClassificationResult(
            condition=SupportedCondition.ACNE,
            confidence=confidence,
            model_version="clf-v2",
            inference_ms=100,
            predicted_at=datetime.now(timezone.utc),
        ),
        severity="mild",
        questionnaire=questionnaire or Questionnaire(),
        skin_context=SkinContext(tone_group="melanin_rich"),
    )


def _valid_draft_json() -> str:
    return json.dumps(
        {
            "explanation": "Educational summary.",
            "possible_contributing_factors": ["occlusive products"],
            "skin_tone_considerations": ["use gentle products"],
            "recommended_action": {
                "type": "self_care",
                "urgency": "routine",
                "steps": ["cleanse", "moisturize"],
                "referral_reason": None,
            },
            "prevention": ["patch test"],
            "warning_signs": ["rapid worsening"],
            "limitations": ["not a diagnosis"],
        }
    )


def _valid_draft_model() -> RecommendationDraft:
    return parse_llm_output(_valid_draft_json())


def test_parse_llm_output_valid_json_passes() -> None:
    draft = parse_llm_output(_valid_draft_json())
    assert draft.recommended_action.type == "self_care"


def test_parse_llm_output_invalid_json_raises() -> None:
    with pytest.raises(RecommendationValidationError):
        parse_llm_output("{not-json")


def test_parse_llm_output_missing_required_fields_raises() -> None:
    raw = json.dumps({"explanation": "missing required fields"})
    with pytest.raises(RecommendationValidationError):
        parse_llm_output(raw)


def test_assemble_recommendation_result_uses_backend_owned_protected_fields() -> None:
    input_data = _base_input(confidence=0.91, questionnaire=Questionnaire())

    # Simulate LLM payload trying to inject protected keys; draft parsing ignores extras.
    spoofed_payload = json.loads(_valid_draft_json())
    spoofed_payload["confidence"] = 0.01
    spoofed_payload["guidance_level"] = "urgent_referral"
    draft = RecommendationDraft.model_validate(spoofed_payload)

    result = assemble_recommendation_result(
        input=input_data,
        guidance_level=GuidanceLevel.CAUTIOUS_GUIDANCE,
        draft=draft,
        model_version="backend-model-v9",
    )

    assert result.assessment_id == input_data.assessment_id
    assert result.condition == input_data.classifier.condition
    assert result.confidence == input_data.classifier.confidence
    assert result.guidance_level == GuidanceLevel.CAUTIOUS_GUIDANCE
    assert result.model_version == "backend-model-v9"
    assert result.draft == draft


def test_enforce_guidance_consistency_corrects_self_care_under_professional_review() -> None:
    draft = _valid_draft_model()
    corrected = enforce_guidance_consistency(GuidanceLevel.PROFESSIONAL_REVIEW, draft)

    assert corrected.recommended_action.type == "referral"
    assert corrected.recommended_action.steps == []
    assert corrected.recommended_action.referral_reason is not None


def test_enforce_guidance_consistency_passes_through_when_compliant() -> None:
    compliant = _valid_draft_model()
    compliant.recommended_action.type = "referral"
    compliant.recommended_action.steps = []
    compliant.recommended_action.referral_reason = "See clinician"

    result = enforce_guidance_consistency(GuidanceLevel.PROFESSIONAL_REVIEW, compliant)
    assert result.model_dump() == compliant.model_dump()


@pytest.mark.parametrize(
    ("level", "input_data"),
    [
        (
            GuidanceLevel.URGENT_REFERRAL,
            _base_input(confidence=0.95, questionnaire=Questionnaire(eye_involvement=True)),
        ),
        (
            GuidanceLevel.PROFESSIONAL_REVIEW,
            _base_input(confidence=0.95, questionnaire=Questionnaire(swelling=True)),
        ),
        (
            GuidanceLevel.RETAKE_OR_REVIEW,
            _base_input(confidence=0.50, questionnaire=Questionnaire()),
        ),
        (
            GuidanceLevel.CAUTIOUS_GUIDANCE,
            _base_input(confidence=0.70, questionnaire=Questionnaire()),
        ),
        (
            GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE,
            _base_input(confidence=0.90, questionnaire=Questionnaire()),
        ),
    ],
)
def test_generate_recommendation_happy_path_per_guidance_level(
    level: GuidanceLevel,
    input_data: RecommendationInput,
) -> None:
    client = MockLLMClient(response_text=_valid_draft_json())

    result = asyncio.run(generate_recommendation(input_data, client))

    assert result.guidance_level == level
    assert result.assessment_id == input_data.assessment_id
    assert result.condition == input_data.classifier.condition
    assert result.confidence == input_data.classifier.confidence
    if level in {GuidanceLevel.URGENT_REFERRAL, GuidanceLevel.PROFESSIONAL_REVIEW}:
        assert result.draft.recommended_action.type == "referral"
        assert result.draft.recommended_action.steps == []


def test_generate_recommendation_retry_then_fail_raises_unavailable() -> None:
    input_data = _base_input(confidence=0.9, questionnaire=Questionnaire())
    client = MockLLMClient(should_raise=True)

    with pytest.raises(RecommendationUnavailableError, match="RECOMMENDATION_UNAVAILABLE"):
        asyncio.run(generate_recommendation(input_data, client))
