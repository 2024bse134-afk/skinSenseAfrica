from app.domain.recommendation.models import GuidanceLevel, Questionnaire
from app.domain.recommendation.policy import (
    decide_guidance,
    derive_urgency,
    has_clinical_red_flag,
    has_emergency_red_flag,
    is_referral_required,
)


def test_has_emergency_red_flag_true_case() -> None:
    q = Questionnaire(bleeding_or_open_wound=True)
    assert has_emergency_red_flag(q) is True


def test_has_emergency_red_flag_false_case() -> None:
    q = Questionnaire(
        bleeding_or_open_wound=False,
        eye_involvement=False,
        fever=False,
        rapidly_spreading=False,
        swelling=False,
        pain_level=2,
    )
    assert has_emergency_red_flag(q) is False


def test_has_clinical_red_flag_true_case() -> None:
    q = Questionnaire(swelling=True)
    assert has_clinical_red_flag(q) is True


def test_has_clinical_red_flag_false_case() -> None:
    q = Questionnaire(
        rapidly_spreading=False,
        swelling=False,
        pain_level=2,
        fever=False,
    )
    assert has_clinical_red_flag(q) is False


def test_decide_guidance_branch_urgent_referral() -> None:
    q = Questionnaire(eye_involvement=True)
    assert decide_guidance(confidence=0.95, questionnaire=q) == GuidanceLevel.URGENT_REFERRAL


def test_decide_guidance_branch_professional_review() -> None:
    q = Questionnaire(swelling=True)
    assert decide_guidance(confidence=0.95, questionnaire=q) == GuidanceLevel.PROFESSIONAL_REVIEW


def test_decide_guidance_branch_retake_or_review() -> None:
    q = Questionnaire()
    assert decide_guidance(confidence=0.50, questionnaire=q) == GuidanceLevel.RETAKE_OR_REVIEW


def test_decide_guidance_branch_cautious_guidance() -> None:
    q = Questionnaire()
    assert decide_guidance(confidence=0.70, questionnaire=q) == GuidanceLevel.CAUTIOUS_GUIDANCE


def test_decide_guidance_branch_condition_specific_guidance() -> None:
    q = Questionnaire()
    assert (
        decide_guidance(confidence=0.90, questionnaire=q)
        == GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
    )


def test_emergency_red_flag_overrides_high_confidence() -> None:
    q = Questionnaire(bleeding_or_open_wound=True)
    assert decide_guidance(confidence=0.99, questionnaire=q) == GuidanceLevel.URGENT_REFERRAL


def test_clinical_red_flag_overrides_confidence_thresholds() -> None:
    q = Questionnaire(swelling=True)
    assert decide_guidance(confidence=0.90, questionnaire=q) == GuidanceLevel.PROFESSIONAL_REVIEW


def test_derive_urgency_for_each_guidance_level() -> None:
    expected = {
        GuidanceLevel.URGENT_REFERRAL: "urgent",
        GuidanceLevel.PROFESSIONAL_REVIEW: "high",
        GuidanceLevel.RETAKE_OR_REVIEW: "moderate",
        GuidanceLevel.CAUTIOUS_GUIDANCE: "routine",
        GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE: "routine",
    }
    for level, urgency in expected.items():
        assert derive_urgency(level) == urgency


def test_is_referral_required_for_each_guidance_level() -> None:
    expected = {
        GuidanceLevel.URGENT_REFERRAL: True,
        GuidanceLevel.PROFESSIONAL_REVIEW: True,
        GuidanceLevel.RETAKE_OR_REVIEW: False,
        GuidanceLevel.CAUTIOUS_GUIDANCE: False,
        GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE: False,
    }
    for level, referral_required in expected.items():
        assert is_referral_required(level) is referral_required


def test_questionnaire_policy_interface_calls_policy_functions() -> None:
    emergency_q = Questionnaire(bleeding_or_open_wound=True)
    clinical_q = Questionnaire(swelling=True)
    assert emergency_q.has_emergency_red_flag() is True
    assert clinical_q.has_clinical_red_flag() is True
