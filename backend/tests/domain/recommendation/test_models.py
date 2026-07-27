from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.domain.recommendation.models import (
    ClassificationResult,
    GuidanceLevel,
    Questionnaire,
    RecommendationDraft,
    RecommendationInput,
    RecommendationResult,
    RecommendedAction,
    SkinContext,
    SupportedCondition,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _valid_classification() -> ClassificationResult:
    return ClassificationResult(
        condition=SupportedCondition.ACNE,
        confidence=0.92,
        model_version="clf-v1",
        inference_ms=143,
        predicted_at=_now(),
    )


def _valid_questionnaire() -> Questionnaire:
    return Questionnaire(
        duration="2 weeks",
        itching=True,
        pain_level=3,
        rapidly_spreading=False,
        affected_area="cheek",
        fever=False,
        swelling=False,
        bleeding_or_open_wound=False,
        eye_involvement=False,
        previous_treatments=["gentle cleanser"],
        known_allergies=["fragrance"],
        current_products=["spf50 sunscreen"],
    )


def _valid_skin_context() -> SkinContext:
    return SkinContext(tone_group="melanin_rich")


def _valid_action() -> RecommendedAction:
    return RecommendedAction(
        type="self_care",
        urgency="routine",
        steps=["Cleanse gently", "Use non-comedogenic moisturizer"],
        referral_reason=None,
    )


def _valid_draft() -> RecommendationDraft:
    return RecommendationDraft(
        explanation="This appears consistent with mild acne patterns.",
        possible_contributing_factors=["occlusive products", "humidity"],
        skin_tone_considerations=["Prioritize non-irritating actives"],
        recommended_action=_valid_action(),
        prevention=["Patch-test new products"],
        warning_signs=["Rapid worsening"],
        limitations=["Photo quality can affect interpretation"],
    )


def test_classification_result_valid_construction() -> None:
    model = _valid_classification()
    assert model.condition == SupportedCondition.ACNE


def test_questionnaire_valid_construction() -> None:
    model = _valid_questionnaire()
    assert model.itching is True


def test_skin_context_valid_construction() -> None:
    model = _valid_skin_context()
    assert model.tone_group == "melanin_rich"


def test_recommendation_input_valid_construction() -> None:
    model = RecommendationInput(
        assessment_id="asm-123",
        classifier=_valid_classification(),
        severity="mild",
        questionnaire=_valid_questionnaire(),
        skin_context=_valid_skin_context(),
    )
    assert model.assessment_id == "asm-123"


def test_recommended_action_valid_construction() -> None:
    model = _valid_action()
    assert model.urgency == "routine"


def test_recommendation_draft_valid_construction() -> None:
    model = _valid_draft()
    assert model.recommended_action.type == "self_care"


def test_recommendation_result_valid_construction() -> None:
    model = RecommendationResult(
        assessment_id="asm-123",
        condition=SupportedCondition.ACNE,
        confidence=0.92,
        guidance_level=GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE,
        referral_required=False,
        urgency="routine",
        model_version="clf-v1",
        prompt_version="v1",
        disclaimer="This is educational guidance and not a diagnosis.",
        generated_at=_now(),
        draft=_valid_draft(),
    )
    assert model.guidance_level == GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE


def test_classification_result_rejects_confidence_out_of_range() -> None:
    with pytest.raises(ValidationError):
        ClassificationResult(
            condition=SupportedCondition.ACNE,
            confidence=1.5,
            model_version="clf-v1",
            inference_ms=100,
            predicted_at=_now(),
        )


def test_recommendation_draft_has_no_protected_fields_overlap() -> None:
    protected_fields = {
        "assessment_id",
        "condition",
        "confidence",
        "guidance_level",
        "referral_required",
        "urgency",
        "model_version",
        "prompt_version",
        "disclaimer",
    }
    draft_fields = set(RecommendationDraft.model_fields.keys())
    assert draft_fields.isdisjoint(protected_fields)
