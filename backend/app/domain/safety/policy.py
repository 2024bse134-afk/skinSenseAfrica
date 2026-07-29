"""Provider-independent deterministic safety precedence rules."""

from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import (
    ConfidenceLevel,
    ImageAssessmentResult,
    ImageQualityStatus,
    VisualSafetySignal,
)
from app.domain.questionnaire.models import AgeGroup, Answer, DurationBand, Questionnaire
from app.domain.safety.models import (
    ClinicianSummary,
    RecommendationPermission,
    RedFlag,
    SafetyFeedback,
    SafetyResult,
    SafetyTrigger,
    Urgency,
)
from app.domain.assessment.models import FollowUpQuestionId


EMERGENCY_MESSAGE = (
    "Seek emergency medical help now. Breathing difficulty or swelling of the lips, "
    "tongue, or throat can be life-threatening."
)
URGENT_MESSAGE = (
    "Seek urgent in-person medical care as soon as possible. Do not rely on an AI "
    "assessment for these warning signs."
)
REVIEW_MESSAGE = (
    "A qualified health professional should review this concern before condition-specific "
    "guidance is provided."
)
ROUTINE_MESSAGE = (
    "No deterministic red flag was identified from the information provided. Continue "
    "to educational guidance and seek care if symptoms worsen."
)

TRIGGER_LABELS = {
    RedFlag.DIFFICULTY_BREATHING: "Difficulty breathing was reported.",
    RedFlag.LIP_TONGUE_THROAT_SWELLING: (
        "Swelling of the lips, tongue, or throat was reported."
    ),
    RedFlag.RAPIDLY_SPREADING: "The concern was reported as spreading quickly.",
    RedFlag.HIGH_FEVER: "A high fever was reported.",
    RedFlag.SEVERE_PAIN: "The reported pain reached the severe-pain threshold.",
    RedFlag.EYE_INVOLVEMENT: "Eye or eyelid involvement was reported.",
    RedFlag.EXTENSIVE_BLISTERING: "Extensive blistering was reported.",
    RedFlag.POSSIBLE_INFECTION: "Possible signs of infection were reported.",
    RedFlag.SIGNIFICANT_BLEEDING: "Significant bleeding was reported.",
    RedFlag.OPEN_WOUND: "An open wound was reported.",
    RedFlag.PERSISTENT_OR_RECURRENT: (
        "The concern was reported as persistent or recurrent."
    ),
    RedFlag.LOW_CONFIDENCE: "The preliminary assessment confidence was low or unknown.",
    RedFlag.UNSUPPORTED_OR_UNCERTAIN_CONDITION: (
        "The preliminary condition was uncertain or outside the supported set."
    ),
    RedFlag.IMAGE_RETAKE_REQUIRED: "The image quality requires a retake.",
    RedFlag.UNSURE_SAFETY_ANSWER: (
        "At least one safety-sensitive answer was marked unsure."
    ),
    RedFlag.UNSUPPORTED_SCOPE: "The concern is outside the prototype's supported scope.",
    RedFlag.FEVER_OR_SWELLING: "Fever or swelling was reported.",
}

ANSWER_FIELDS = (
    ("itching", FollowUpQuestionId.ITCHING),
    ("rapidly_spreading", FollowUpQuestionId.RAPIDLY_SPREADING),
    ("fever", FollowUpQuestionId.FEVER),
    ("high_fever", FollowUpQuestionId.HIGH_FEVER),
    ("swelling", FollowUpQuestionId.SWELLING),
    ("difficulty_breathing", FollowUpQuestionId.DIFFICULTY_BREATHING),
    (
        "lip_tongue_throat_swelling",
        FollowUpQuestionId.LIP_TONGUE_THROAT_SWELLING,
    ),
    ("bleeding", FollowUpQuestionId.BLEEDING),
    ("blistering", FollowUpQuestionId.BLISTERING),
    ("open_wound", FollowUpQuestionId.OPEN_WOUND),
    ("eye_involvement", FollowUpQuestionId.EYE_INVOLVEMENT),
    ("possible_infection", FollowUpQuestionId.POSSIBLE_INFECTION),
    ("recurrent", FollowUpQuestionId.RECURRENT),
)

NEXT_STEPS = {
    Urgency.EMERGENCY: [
        "Seek emergency medical help now or contact your local emergency service.",
        "Do not wait for another AI assessment before seeking help.",
        "Take the reported-information summary with you if this does not delay care.",
    ],
    Urgency.URGENT: [
        "Arrange urgent in-person medical care as soon as possible.",
        "Tell the healthcare professional which warning signs triggered this result.",
        "Seek emergency help if breathing difficulty or lip, tongue, or throat swelling develops.",
    ],
    Urgency.PROFESSIONAL_REVIEW: [
        "Arrange review with a qualified healthcare professional.",
        "Use the reported-information summary to explain the concern.",
        "Seek urgent care if the concern rapidly worsens or a warning sign develops.",
    ],
}

FEEDBACK_HEADINGS = {
    Urgency.EMERGENCY: "Emergency warning signs were reported",
    Urgency.URGENT: "Urgent warning signs were reported",
    Urgency.PROFESSIONAL_REVIEW: "Professional review is the safest next step",
}

WITHHELD_REASONS = {
    Urgency.EMERGENCY: (
        "Treatment-like guidance was withheld because emergency warning signs take "
        "priority over an AI-generated recommendation."
    ),
    Urgency.URGENT: (
        "Treatment-like guidance was withheld because urgent warning signs require "
        "in-person assessment before condition-specific advice."
    ),
    Urgency.PROFESSIONAL_REVIEW: (
        "Condition-specific guidance was withheld because the available information "
        "requires professional review."
    ),
}


def _clinician_summary(
    assessment: ImageAssessmentResult,
    questionnaire: Questionnaire,
) -> ClinicianSummary:
    yes_answers: list[FollowUpQuestionId] = []
    unsure_answers: list[FollowUpQuestionId] = []
    for field_name, question_id in ANSWER_FIELDS:
        answer = getattr(questionnaire, field_name)
        if answer is Answer.YES:
            yes_answers.append(question_id)
        elif answer is Answer.UNSURE:
            unsure_answers.append(question_id)

    return ClinicianSummary(
        preliminary_condition=assessment.condition,
        confidence_level=assessment.confidence_level,
        duration=questionnaire.duration,
        affected_body_area=questionnaire.affected_body_area,
        age_group=questionnaire.age_group,
        pain_level=questionnaire.pain_level,
        reported_yes_answers=yes_answers,
        reported_unsure_answers=unsure_answers,
        previous_treatment=questionnaire.previous_treatment,
        known_allergies=questionnaire.known_allergies,
        current_products=questionnaire.current_products,
    )


def _feedback(
    urgency: Urgency,
    flags: list[RedFlag],
    assessment: ImageAssessmentResult,
    questionnaire: Questionnaire,
) -> SafetyFeedback | None:
    if urgency is Urgency.ROUTINE:
        return None
    return SafetyFeedback(
        heading=FEEDBACK_HEADINGS[urgency],
        triggers=[
            SafetyTrigger(code=flag, label=TRIGGER_LABELS[flag]) for flag in flags
        ],
        next_steps=NEXT_STEPS[urgency],
        guidance_withheld_reason=WITHHELD_REASONS[urgency],
        clinician_summary=_clinician_summary(assessment, questionnaire),
    )


def _result(
    urgency: Urgency,
    flags: list[RedFlag],
    policy_version: str,
    message: str,
    assessment: ImageAssessmentResult,
    questionnaire: Questionnaire,
) -> SafetyResult:
    unique_flags = list(dict.fromkeys(flags))
    permission = {
        Urgency.EMERGENCY: RecommendationPermission.ESCALATION_ONLY,
        Urgency.URGENT: RecommendationPermission.ESCALATION_ONLY,
        Urgency.PROFESSIONAL_REVIEW: RecommendationPermission.BLOCKED,
        Urgency.ROUTINE: RecommendationPermission.ALLOWED,
    }[urgency]
    return SafetyResult(
        urgency=urgency,
        red_flags=unique_flags,
        recommendation_permission=permission,
        policy_version=policy_version,
        action_message=message,
        feedback=_feedback(urgency, unique_flags, assessment, questionnaire),
    )


def evaluate_safety(
    assessment: ImageAssessmentResult,
    questionnaire: Questionnaire,
    *,
    severe_pain_threshold: int = 7,
    policy_version: str = "v1",
) -> SafetyResult:
    """Evaluate emergency > urgent > professional review > routine."""

    emergency: list[RedFlag] = []
    if questionnaire.difficulty_breathing is Answer.YES:
        emergency.append(RedFlag.DIFFICULTY_BREATHING)
    if questionnaire.lip_tongue_throat_swelling is Answer.YES:
        emergency.append(RedFlag.LIP_TONGUE_THROAT_SWELLING)
    if emergency:
        return _result(
            Urgency.EMERGENCY,
            emergency,
            policy_version,
            EMERGENCY_MESSAGE,
            assessment,
            questionnaire,
        )

    urgent: list[RedFlag] = []
    if questionnaire.rapidly_spreading is Answer.YES:
        urgent.append(RedFlag.RAPIDLY_SPREADING)
    if questionnaire.high_fever is Answer.YES:
        urgent.append(RedFlag.HIGH_FEVER)
    if questionnaire.pain_level >= severe_pain_threshold:
        urgent.append(RedFlag.SEVERE_PAIN)
    if questionnaire.eye_involvement is Answer.YES:
        urgent.append(RedFlag.EYE_INVOLVEMENT)
    if questionnaire.blistering is Answer.YES:
        urgent.append(RedFlag.EXTENSIVE_BLISTERING)
    if questionnaire.possible_infection is Answer.YES:
        urgent.append(RedFlag.POSSIBLE_INFECTION)
    if questionnaire.bleeding is Answer.YES:
        urgent.append(RedFlag.SIGNIFICANT_BLEEDING)
    if questionnaire.open_wound is Answer.YES:
        urgent.append(RedFlag.OPEN_WOUND)

    visual_urgent = {
        VisualSafetySignal.POSSIBLE_EYE_INVOLVEMENT: RedFlag.EYE_INVOLVEMENT,
        VisualSafetySignal.POSSIBLE_INFECTION: RedFlag.POSSIBLE_INFECTION,
        VisualSafetySignal.POSSIBLE_SIGNIFICANT_BLEEDING: RedFlag.SIGNIFICANT_BLEEDING,
        VisualSafetySignal.POSSIBLE_OPEN_WOUND: RedFlag.OPEN_WOUND,
        VisualSafetySignal.POSSIBLE_EXTENSIVE_BLISTERING: RedFlag.EXTENSIVE_BLISTERING,
    }
    urgent.extend(
        visual_urgent[signal]
        for signal in assessment.visual_safety_signals
        if signal in visual_urgent
    )
    if urgent:
        return _result(
            Urgency.URGENT,
            urgent,
            policy_version,
            URGENT_MESSAGE,
            assessment,
            questionnaire,
        )

    review: list[RedFlag] = []
    if assessment.condition is Condition.OTHER_OR_UNCERTAIN:
        review.append(RedFlag.UNSUPPORTED_OR_UNCERTAIN_CONDITION)
    if assessment.confidence_level in {ConfidenceLevel.LOW, ConfidenceLevel.UNKNOWN}:
        review.append(RedFlag.LOW_CONFIDENCE)
    if assessment.image_quality.status is ImageQualityStatus.RETAKE_REQUIRED:
        review.append(RedFlag.IMAGE_RETAKE_REQUIRED)
    if questionnaire.recurrent is Answer.YES or questionnaire.duration in {
        DurationBand.ONE_TO_SIX_MONTHS,
        DurationBand.MORE_THAN_SIX_MONTHS,
    }:
        review.append(RedFlag.PERSISTENT_OR_RECURRENT)

    relevant_answers = (
        questionnaire.rapidly_spreading,
        questionnaire.fever,
        questionnaire.high_fever,
        questionnaire.swelling,
        questionnaire.difficulty_breathing,
        questionnaire.lip_tongue_throat_swelling,
        questionnaire.bleeding,
        questionnaire.blistering,
        questionnaire.open_wound,
        questionnaire.eye_involvement,
        questionnaire.possible_infection,
    )
    if Answer.UNSURE in relevant_answers:
        review.append(RedFlag.UNSURE_SAFETY_ANSWER)
    if questionnaire.fever is Answer.YES or questionnaire.swelling is Answer.YES:
        review.append(RedFlag.FEVER_OR_SWELLING)
    if questionnaire.age_group is AgeGroup.INFANT:
        review.append(RedFlag.UNSUPPORTED_SCOPE)
    if VisualSafetySignal.UNSUPPORTED_SCOPE in assessment.visual_safety_signals:
        review.append(RedFlag.UNSUPPORTED_SCOPE)

    if review:
        return _result(
            Urgency.PROFESSIONAL_REVIEW,
            review,
            policy_version,
            REVIEW_MESSAGE,
            assessment,
            questionnaire,
        )
    return _result(
        Urgency.ROUTINE,
        [],
        policy_version,
        ROUTINE_MESSAGE,
        assessment,
        questionnaire,
    )
