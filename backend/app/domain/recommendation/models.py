"""Domain recommendation models.

Single responsibility: declare recommendation-related schemas and types for the domain boundary.
Layering rule: domain code must not import databases, HTTP clients, or provider-specific SDKs.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import ConfidenceLevel
from app.domain.questionnaire.models import Questionnaire
from app.domain.safety.models import SafetyResult


SupportedCondition = Condition


class GuidanceLevel(str, Enum):
	"""Guidance levels produced by the deterministic policy decision step."""

	URGENT_REFERRAL = "urgent_referral"
	PROFESSIONAL_REVIEW = "professional_review"
	RETAKE_OR_REVIEW = "retake_or_review"
	CAUTIOUS_GUIDANCE = "cautious_guidance"
	CONDITION_SPECIFIC_GUIDANCE = "condition_specific_guidance"


class ClassificationResult(BaseModel):
	"""Classifier output metadata used by recommendation orchestration."""

	condition: SupportedCondition
	confidence: float = Field(ge=0.0, le=1.0)
	model_version: str
	inference_ms: int = Field(ge=0)
	predicted_at: datetime


class SkinContext(BaseModel):
	"""User skin-context metadata used for safer and more relevant guidance framing."""

	tone_group: Literal["melanin_rich", "user_selected_tone_group", "unspecified"] = "unspecified"


class RecommendationAssessmentContext(BaseModel):
	model_config = ConfigDict(extra="forbid")

	condition: Condition
	confidence_level: ConfidenceLevel
	confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
	engine_version: str


class RecommendationInput(BaseModel):
	"""Image-free recommendation input assembled only by backend orchestration."""

	model_config = ConfigDict(extra="forbid")

	assessment_id: str
	assessment: RecommendationAssessmentContext
	questionnaire: Questionnaire
	safety: SafetyResult
	allowed_guidance_level: GuidanceLevel
	skin_context: SkinContext


class RecommendedAction(BaseModel):
	"""Action block included in recommendation payloads."""

	type: str
	urgency: str
	steps: list[str]
	referral_reason: str | None = None


class RecommendationDraft(BaseModel):
	"""LLM-producible recommendation draft without backend-protected fields."""

	explanation: str
	possible_contributing_factors: list[str]
	skin_tone_considerations: list[str]
	recommended_action: RecommendedAction
	prevention: list[str]
	warning_signs: list[str]
	limitations: list[str]


class RecommendationResult(BaseModel):
	"""Final backend-owned recommendation response contract returned to API layer."""

	assessment_id: str
	condition: Condition
	confidence_level: ConfidenceLevel
	confidence_score: float | None
	guidance_level: GuidanceLevel
	referral_required: bool
	safety: SafetyResult
	model_version: str
	prompt_version: str
	disclaimer: str
	generated_at: datetime
	draft: RecommendationDraft
