"""Backend-owned safety result contracts."""

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import ConfidenceLevel, FollowUpQuestionId
from app.domain.questionnaire.models import (
    AffectedBodyArea,
    AgeGroup,
    BoundedItem,
    DurationBand,
)


class Urgency(str, Enum):
    ROUTINE = "routine"
    PROFESSIONAL_REVIEW = "professional_review"
    URGENT = "urgent"
    EMERGENCY = "emergency"


class RecommendationPermission(str, Enum):
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    ESCALATION_ONLY = "escalation_only"


class RedFlag(str, Enum):
    DIFFICULTY_BREATHING = "difficulty_breathing"
    LIP_TONGUE_THROAT_SWELLING = "lip_tongue_throat_swelling"
    RAPIDLY_SPREADING = "rapidly_spreading"
    HIGH_FEVER = "high_fever"
    SEVERE_PAIN = "severe_pain"
    EYE_INVOLVEMENT = "eye_involvement"
    EXTENSIVE_BLISTERING = "extensive_blistering"
    POSSIBLE_INFECTION = "possible_infection"
    SIGNIFICANT_BLEEDING = "significant_bleeding"
    OPEN_WOUND = "open_wound"
    PERSISTENT_OR_RECURRENT = "persistent_or_recurrent"
    LOW_CONFIDENCE = "low_confidence"
    UNSUPPORTED_OR_UNCERTAIN_CONDITION = "unsupported_or_uncertain_condition"
    IMAGE_RETAKE_REQUIRED = "image_retake_required"
    UNSURE_SAFETY_ANSWER = "unsure_safety_answer"
    UNSUPPORTED_SCOPE = "unsupported_scope"
    FEVER_OR_SWELLING = "fever_or_swelling"


class StrictSafetyModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SafetyTrigger(StrictSafetyModel):
    code: RedFlag
    label: Annotated[str, Field(min_length=1, max_length=160)]


class ClinicianSummary(StrictSafetyModel):
    preliminary_condition: Condition
    confidence_level: ConfidenceLevel
    duration: DurationBand
    affected_body_area: AffectedBodyArea
    age_group: AgeGroup
    pain_level: int = Field(ge=0, le=10)
    reported_yes_answers: list[FollowUpQuestionId] = Field(
        default_factory=list, max_length=20
    )
    reported_unsure_answers: list[FollowUpQuestionId] = Field(
        default_factory=list, max_length=20
    )
    previous_treatment: list[BoundedItem] = Field(default_factory=list, max_length=10)
    known_allergies: list[BoundedItem] = Field(default_factory=list, max_length=10)
    current_products: list[BoundedItem] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def validate_answer_groups(self) -> "ClinicianSummary":
        if len(set(self.reported_yes_answers)) != len(self.reported_yes_answers):
            raise ValueError("reported yes answers must be unique")
        if len(set(self.reported_unsure_answers)) != len(
            self.reported_unsure_answers
        ):
            raise ValueError("reported unsure answers must be unique")
        if set(self.reported_yes_answers) & set(self.reported_unsure_answers):
            raise ValueError("reported answer groups must be disjoint")
        return self


class SafetyFeedback(StrictSafetyModel):
    heading: Annotated[str, Field(min_length=1, max_length=120)]
    triggers: list[SafetyTrigger] = Field(min_length=1, max_length=15)
    next_steps: list[Annotated[str, Field(min_length=1, max_length=240)]] = Field(
        min_length=2, max_length=4
    )
    guidance_withheld_reason: Annotated[str, Field(min_length=1, max_length=320)]
    clinician_summary: ClinicianSummary


class SafetyResult(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    urgency: Urgency
    red_flags: list[RedFlag] = Field(default_factory=list, max_length=15)
    recommendation_permission: RecommendationPermission
    policy_version: Annotated[str, Field(min_length=1, max_length=40)]
    action_message: Annotated[str, Field(min_length=1, max_length=320)]
    feedback: SafetyFeedback | None = None

    @model_validator(mode="after")
    def validate_precedence_contract(self) -> "SafetyResult":
        if len(set(self.red_flags)) != len(self.red_flags):
            raise ValueError("red flags must be unique")
        hard_review_blocks = {
            RedFlag.UNSUPPORTED_OR_UNCERTAIN_CONDITION,
            RedFlag.IMAGE_RETAKE_REQUIRED,
            RedFlag.UNSUPPORTED_SCOPE,
        }
        expected = {
            Urgency.ROUTINE: RecommendationPermission.ALLOWED,
            Urgency.PROFESSIONAL_REVIEW: (
                RecommendationPermission.BLOCKED
                if hard_review_blocks.intersection(self.red_flags)
                else RecommendationPermission.ALLOWED
            ),
            Urgency.URGENT: RecommendationPermission.ESCALATION_ONLY,
            Urgency.EMERGENCY: RecommendationPermission.ESCALATION_ONLY,
        }[self.urgency]
        if self.recommendation_permission is not expected:
            raise ValueError("recommendation permission does not match urgency")
        if self.urgency is Urgency.ROUTINE and self.red_flags:
            raise ValueError("routine safety result cannot contain red flags")
        if self.urgency is Urgency.ROUTINE and self.feedback is not None:
            raise ValueError("routine safety result cannot contain blocked feedback")
        if self.urgency is not Urgency.ROUTINE and self.feedback is None:
            raise ValueError("non-routine safety result requires safety feedback")
        if self.feedback is not None:
            feedback_flags = [trigger.code for trigger in self.feedback.triggers]
            if feedback_flags != self.red_flags:
                raise ValueError("feedback triggers must match red flags in order")
        return self
