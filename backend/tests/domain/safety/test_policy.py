from __future__ import annotations

import pytest

from app.domain.questionnaire.models import Questionnaire
from app.domain.safety.models import RecommendationPermission, RedFlag, Urgency
from app.domain.safety.policy import evaluate_safety
from tests.conftest import make_assessment_result


def with_answers(base: Questionnaire, **updates) -> Questionnaire:
    data = base.model_dump(mode="json")
    data.update(updates)
    return Questionnaire.model_validate(data)


@pytest.mark.parametrize(
    ("field", "flag"),
    [
        ("difficulty_breathing", RedFlag.DIFFICULTY_BREATHING),
        ("lip_tongue_throat_swelling", RedFlag.LIP_TONGUE_THROAT_SWELLING),
    ],
)
def test_emergency_overrides_everything(questionnaire, field, flag) -> None:
    q = with_answers(
        questionnaire,
        **{field: "yes", "rapidly_spreading": "yes", "recurrent": "yes"},
    )
    result = evaluate_safety(make_assessment_result(), q)
    assert result.urgency is Urgency.EMERGENCY
    assert flag in result.red_flags
    assert result.recommendation_permission is RecommendationPermission.ESCALATION_ONLY
    assert result.feedback is not None
    assert [trigger.code for trigger in result.feedback.triggers] == result.red_flags
    assert "emergency" in result.feedback.heading.lower()


@pytest.mark.parametrize(
    ("updates", "flag"),
    [
        ({"rapidly_spreading": "yes"}, RedFlag.RAPIDLY_SPREADING),
        ({"high_fever": "yes"}, RedFlag.HIGH_FEVER),
        ({"pain_level": 7}, RedFlag.SEVERE_PAIN),
        ({"eye_involvement": "yes"}, RedFlag.EYE_INVOLVEMENT),
        ({"blistering": "yes"}, RedFlag.EXTENSIVE_BLISTERING),
        ({"possible_infection": "yes"}, RedFlag.POSSIBLE_INFECTION),
        ({"bleeding": "yes"}, RedFlag.SIGNIFICANT_BLEEDING),
        ({"open_wound": "yes"}, RedFlag.OPEN_WOUND),
    ],
)
def test_each_urgent_rule_overrides_review(questionnaire, updates, flag) -> None:
    q = with_answers(questionnaire, recurrent="yes", **updates)
    result = evaluate_safety(make_assessment_result(), q)
    assert result.urgency is Urgency.URGENT
    assert flag in result.red_flags
    assert result.recommendation_permission is RecommendationPermission.ESCALATION_ONLY
    assert result.feedback is not None
    assert result.feedback.guidance_withheld_reason.startswith(
        "Treatment-like guidance was withheld"
    )


@pytest.mark.parametrize(
    "assessment_updates,questionnaire_updates",
    [
        ({"condition": "other_or_uncertain", "confidence_level": "unknown", "confidence_score": None, "recommendation_status": "blocked"}, {}),
        ({"confidence_level": "low", "confidence_score": 0.3}, {}),
        (
            {
                "assessment_status": "retake_required",
                "image_quality": {
                    "status": "retake_required",
                    "issues": ["blurred"],
                },
                "recommendation_status": "blocked",
            },
            {},
        ),
        ({}, {"recurrent": "yes"}),
        ({}, {"duration": "more_than_six_months"}),
        ({}, {"eye_involvement": "unsure"}),
        ({"visual_safety_signals": ["unsupported_scope"]}, {}),
    ],
)
def test_professional_review_branches(
    questionnaire, assessment_updates, questionnaire_updates
) -> None:
    q = with_answers(questionnaire, **questionnaire_updates)
    result = evaluate_safety(make_assessment_result(**assessment_updates), q)
    assert result.urgency is Urgency.PROFESSIONAL_REVIEW
    assert result.recommendation_permission is RecommendationPermission.BLOCKED
    assert result.feedback is not None
    assert result.feedback.clinician_summary.preliminary_condition.value in {
        "acne",
        "other_or_uncertain",
    }


def test_routine_branch(questionnaire) -> None:
    result = evaluate_safety(make_assessment_result(), questionnaire)
    assert result.urgency is Urgency.ROUTINE
    assert result.red_flags == []
    assert result.recommendation_permission is RecommendationPermission.ALLOWED
    assert result.feedback is None


def test_urgent_feedback_contains_exact_triggers_and_clinician_summary(
    questionnaire,
) -> None:
    q = with_answers(
        questionnaire,
        rapidly_spreading="yes",
        high_fever="yes",
        blistering="yes",
        open_wound="yes",
        fever="yes",
        swelling="yes",
        recurrent="yes",
        itching="yes",
        pain_level=6,
        duration="one_to_four_weeks",
        affected_body_area="face_or_neck",
        age_group="adolescent",
        previous_treatment=["gentle cleanser"],
        known_allergies=["fragrance"],
        current_products=["moisturizer"],
    )
    result = evaluate_safety(make_assessment_result(), q)

    assert result.urgency is Urgency.URGENT
    assert result.feedback is not None
    assert [trigger.code for trigger in result.feedback.triggers] == [
        RedFlag.RAPIDLY_SPREADING,
        RedFlag.HIGH_FEVER,
        RedFlag.EXTENSIVE_BLISTERING,
        RedFlag.OPEN_WOUND,
    ]
    assert [trigger.label for trigger in result.feedback.triggers] == [
        "The concern was reported as spreading quickly.",
        "A high fever was reported.",
        "Extensive blistering was reported.",
        "An open wound was reported.",
    ]
    summary = result.feedback.clinician_summary
    assert summary.preliminary_condition.value == "acne"
    assert summary.confidence_level.value == "high"
    assert summary.duration.value == "one_to_four_weeks"
    assert summary.affected_body_area.value == "face_or_neck"
    assert summary.age_group.value == "adolescent"
    assert summary.pain_level == 6
    assert [answer.value for answer in summary.reported_yes_answers] == [
        "itching",
        "rapidly_spreading",
        "fever",
        "high_fever",
        "swelling",
        "blistering",
        "open_wound",
        "recurrent",
    ]
    assert summary.previous_treatment == ["gentle cleanser"]
    assert summary.known_allergies == ["fragrance"]
    assert summary.current_products == ["moisturizer"]
