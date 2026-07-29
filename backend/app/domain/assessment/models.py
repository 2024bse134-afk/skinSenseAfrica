"""Strict provider-neutral contracts for skin-image assessment."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.assessment.conditions import Condition


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    UNKNOWN = "unknown"


class ImageQualityStatus(str, Enum):
    ACCEPTABLE = "acceptable"
    RETAKE_REQUIRED = "retake_required"


class ImageQualityIssue(str, Enum):
    BLURRED = "blurred"
    POOR_LIGHTING = "poor_lighting"
    TOO_FAR = "too_far"
    OBSTRUCTED = "obstructed"
    MULTIPLE_UNRELATED_AREAS = "multiple_unrelated_areas"
    NO_VISIBLE_SKIN_CONCERN = "no_visible_skin_concern"


class AssessmentEngine(str, Enum):
    MULTIMODAL_LLM_PROTOTYPE = "multimodal_llm_prototype"
    TRAINED_CLASSIFIER = "trained_classifier"
    MOCK = "mock"


class AssessmentStatus(str, Enum):
    COMPLETED = "completed"
    RETAKE_REQUIRED = "retake_required"


class RecommendationStatus(str, Enum):
    PENDING_QUESTIONNAIRE = "pending_questionnaire"
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    ESCALATION_ONLY = "escalation_only"
    COMPLETED = "completed"
    UNAVAILABLE = "unavailable"


class VisualFinding(str, Enum):
    DRY_APPEARING_PATCH = "dry_appearing_patch"
    VISIBLE_SCALING = "visible_scaling"
    VISIBLE_BUMPS = "visible_bumps"
    COLOR_CHANGE = "color_change"
    CRUSTING = "crusting"
    PUSTULES = "pustules"
    PLAQUE_LIKE_AREA = "plaque_like_area"
    NON_SPECIFIC_VISIBLE_CHANGE = "non_specific_visible_change"


class VisualSafetySignal(str, Enum):
    POSSIBLE_EYE_INVOLVEMENT = "possible_eye_involvement"
    POSSIBLE_INFECTION = "possible_infection"
    POSSIBLE_SIGNIFICANT_BLEEDING = "possible_significant_bleeding"
    POSSIBLE_OPEN_WOUND = "possible_open_wound"
    POSSIBLE_EXTENSIVE_BLISTERING = "possible_extensive_blistering"
    UNSUPPORTED_SCOPE = "unsupported_scope"


class FollowUpQuestionId(str, Enum):
    DURATION = "duration"
    ITCHING = "itching"
    PAIN_LEVEL = "pain_level"
    RAPIDLY_SPREADING = "rapidly_spreading"
    AFFECTED_BODY_AREA = "affected_body_area"
    FEVER = "fever"
    HIGH_FEVER = "high_fever"
    SWELLING = "swelling"
    DIFFICULTY_BREATHING = "difficulty_breathing"
    LIP_TONGUE_THROAT_SWELLING = "lip_tongue_throat_swelling"
    BLEEDING = "bleeding"
    BLISTERING = "blistering"
    OPEN_WOUND = "open_wound"
    EYE_INVOLVEMENT = "eye_involvement"
    POSSIBLE_INFECTION = "possible_infection"
    PREVIOUS_TREATMENT = "previous_treatment"
    KNOWN_ALLERGIES = "known_allergies"
    CURRENT_PRODUCTS = "current_products"
    AGE_GROUP = "age_group"
    RECURRENT = "recurrent"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ImageQuality(StrictModel):
    status: ImageQualityStatus
    issues: list[ImageQualityIssue] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def validate_disposition(self) -> "ImageQuality":
        if self.status is ImageQualityStatus.ACCEPTABLE and self.issues:
            raise ValueError("acceptable image quality cannot contain issues")
        if self.status is ImageQualityStatus.RETAKE_REQUIRED and not self.issues:
            raise ValueError("retake-required image quality must contain an issue")
        if len(set(self.issues)) != len(self.issues):
            raise ValueError("image quality issues must be unique")
        return self


class ProviderAssessmentDraft(StrictModel):
    """Only fields an assessment engine is permitted to produce."""

    condition: Annotated[str, Field(min_length=1, max_length=64)]
    confidence_level: ConfidenceLevel
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
    visual_findings: list[VisualFinding] = Field(default_factory=list, max_length=8)
    alternative_conditions: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(
        default_factory=list, max_length=3
    )
    image_quality: ImageQuality
    needs_more_information: bool
    follow_up_question_ids: list[FollowUpQuestionId] = Field(default_factory=list, max_length=12)
    visual_safety_signals: list[VisualSafetySignal] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def validate_lists(self) -> "ProviderAssessmentDraft":
        for values, label in (
            (self.visual_findings, "visual findings"),
            (self.alternative_conditions, "alternative conditions"),
            (self.follow_up_question_ids, "follow-up question ids"),
            (self.visual_safety_signals, "visual safety signals"),
        ):
            if len(set(values)) != len(values):
                raise ValueError(f"{label} must be unique")
        return self


class ImageAssessmentResult(StrictModel):
    """Backend-owned stable assessment result returned to all consumers."""

    assessment_status: AssessmentStatus
    condition: Condition
    confidence_level: ConfidenceLevel
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
    visual_findings: list[VisualFinding] = Field(default_factory=list, max_length=8)
    alternative_conditions: list[Condition] = Field(default_factory=list, max_length=3)
    image_quality: ImageQuality
    needs_more_information: bool
    follow_up_question_ids: list[FollowUpQuestionId] = Field(default_factory=list, max_length=12)
    visual_safety_signals: list[VisualSafetySignal] = Field(default_factory=list, max_length=6)
    recommendation_status: RecommendationStatus
    assessment_engine: AssessmentEngine
    engine_version: Annotated[str, Field(min_length=1, max_length=80)]
    prompt_version: Annotated[str, Field(min_length=1, max_length=80)]
    limitations: list[Annotated[str, Field(min_length=1, max_length=240)]] = Field(
        min_length=2, max_length=4
    )
    assessed_at: datetime
    inference_ms: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_result(self) -> "ImageAssessmentResult":
        retake = self.image_quality.status is ImageQualityStatus.RETAKE_REQUIRED
        if retake != (self.assessment_status is AssessmentStatus.RETAKE_REQUIRED):
            raise ValueError("assessment status must match image quality disposition")
        if retake and self.recommendation_status is not RecommendationStatus.BLOCKED:
            raise ValueError("retake-required assessments must block recommendation")
        if self.condition in self.alternative_conditions:
            raise ValueError("primary condition cannot also be an alternative")
        if len(set(self.alternative_conditions)) != len(self.alternative_conditions):
            raise ValueError("alternative conditions must be unique")
        return self


@dataclass(frozen=True, slots=True)
class ValidatedImage:
    """Sanitized in-request image passed to a provider and never persisted."""

    content: bytes
    content_type: str
    format: str
    width: int
    height: int
