"""Domain recommendation models.

Single responsibility: declare recommendation-related schemas and types for the domain boundary.
Layering rule: domain code must not import databases, HTTP clients, or provider-specific SDKs.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class SupportedCondition(str, Enum):
	"""Supported condition classes from the classifier output contract."""

	ACNE = "acne"
	ECZEMA_DERMATITIS = "eczema_dermatitis"
	HYPERPIGMENTATION = "hyperpigmentation"
	POSSIBLE_FUNGAL = "possible_fungal_infection"
	OTHER_UNCERTAIN = "other_uncertain"


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


class Questionnaire(BaseModel):
	"""Structured questionnaire inputs collected alongside image-based assessment."""

	duration: str | None = None
	itching: bool | None = None
	pain_level: int | None = None
	rapidly_spreading: bool | None = None
	affected_area: str | None = None
	fever: bool | None = None
	swelling: bool | None = None
	bleeding_or_open_wound: bool | None = None
	eye_involvement: bool | None = None
	previous_treatments: list[str] = Field(default_factory=list)
	known_allergies: list[str] = Field(default_factory=list)
	current_products: list[str] = Field(default_factory=list)

	def has_emergency_red_flag(self) -> bool:
		"""Evaluate emergency red-flag status via policy-layer rules."""
		from app.domain.recommendation.policy import has_emergency_red_flag

		return has_emergency_red_flag(self)

	def has_clinical_red_flag(self) -> bool:
		"""Evaluate clinical red-flag status via policy-layer rules."""
		from app.domain.recommendation.policy import has_clinical_red_flag

		return has_clinical_red_flag(self)


class SkinContext(BaseModel):
	"""User skin-context metadata used for safer and more relevant guidance framing."""

	tone_group: Literal["melanin_rich", "user_selected_tone_group", "unspecified"] = "unspecified"


class RecommendationInput(BaseModel):
	"""Full recommendation use-case input contract for application orchestration."""

	assessment_id: str
	classifier: ClassificationResult
	severity: str | None = None
	questionnaire: Questionnaire
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
	condition: SupportedCondition
	confidence: float
	guidance_level: GuidanceLevel
	referral_required: bool
	urgency: str
	model_version: str
	prompt_version: str
	disclaimer: str
	generated_at: datetime
	draft: RecommendationDraft
