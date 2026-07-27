from datetime import datetime, timezone

import pytest

from app.domain.recommendation.models import (
    ClassificationResult,
    GuidanceLevel,
    Questionnaire,
    RecommendationInput,
    SkinContext,
    SupportedCondition,
)
from app.domain.recommendation.prompt_builder import build_messages, build_user_message


def _base_input(questionnaire: Questionnaire | None = None) -> RecommendationInput:
    return RecommendationInput(
        assessment_id="asm-protected-123",
        classifier=ClassificationResult(
            condition=SupportedCondition.ACNE,
            confidence=0.93,
            model_version="clf-secret-v9",
            inference_ms=120,
            predicted_at=datetime.now(timezone.utc),
        ),
        severity="mild",
        questionnaire=questionnaire or Questionnaire(itching=True, pain_level=2),
        skin_context=SkinContext(tone_group="melanin_rich"),
    )


@pytest.mark.parametrize(
    "level",
    [
        GuidanceLevel.URGENT_REFERRAL,
        GuidanceLevel.PROFESSIONAL_REVIEW,
        GuidanceLevel.RETAKE_OR_REVIEW,
        GuidanceLevel.CAUTIOUS_GUIDANCE,
        GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE,
    ],
)
def test_permitted_guidance_instruction_present_for_each_level(level: GuidanceLevel) -> None:
    msg = build_user_message(_base_input(), level)
    expected = (
        f"Permitted guidance level: {level.value}. Do not exceed this level of specificity "
        "or provide routine treatment instructions if the level is professional_review "
        "or urgent_referral."
    )
    assert expected in msg


def test_urgent_and_professional_include_referral_priority_guard() -> None:
    urgent_msg = build_user_message(_base_input(), GuidanceLevel.URGENT_REFERRAL)
    professional_msg = build_user_message(_base_input(), GuidanceLevel.PROFESSIONAL_REVIEW)

    phrase = "Referral priority instruction: prioritize referral language and omit routine self-care steps."
    assert phrase in urgent_msg
    assert phrase in professional_msg


def test_protected_field_names_and_values_do_not_appear_in_messages() -> None:
    input_data = _base_input()
    messages = build_messages(input_data, GuidanceLevel.CAUTIOUS_GUIDANCE)
    combined = "\n".join([m["content"] for m in messages])

    protected_field_names = {
        "assessment_id",
        "confidence",
        "referral_required",
        "model_version",
        "prompt_version",
        "disclaimer",
    }
    for field_name in protected_field_names:
        assert field_name not in combined

    protected_values = {
        input_data.assessment_id,
        input_data.classifier.model_version,
        str(input_data.classifier.confidence),
    }
    for value in protected_values:
        assert value not in combined


def test_missing_questionnaire_fields_are_omitted() -> None:
    q = Questionnaire(itching=True)
    msg = build_user_message(_base_input(questionnaire=q), GuidanceLevel.CAUTIOUS_GUIDANCE)

    assert "None" not in msg
    assert "pain_level" not in msg
    assert "duration" not in msg
    assert "rapidly_spreading" not in msg
    assert "previous_treatments" not in msg


def test_snapshot_style_prompt_contains_key_phrases() -> None:
    q = Questionnaire(
        duration="3 weeks",
        itching=True,
        pain_level=4,
        affected_area="forehead",
        current_products=["shea butter cream"],
    )
    input_data = _base_input(questionnaire=q)
    messages = build_messages(input_data, GuidanceLevel.CAUTIOUS_GUIDANCE)

    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"

    user_content = messages[1]["content"]
    assert "Condition label: Acne" in user_content
    assert "Skin context tone_group: melanin_rich" in user_content
    assert "Questionnaire context (only provided values):" in user_content
    assert "- duration: 3 weeks" in user_content
    assert "- current_products: ['shea butter cream']" in user_content
    assert "Return JSON only, matching RecommendationDraft fields exactly:" in user_content
    assert "- recommended_action" in user_content
