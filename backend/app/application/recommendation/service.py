"""Recommendation application service.

Single responsibility: orchestrate recommendation flow (policy, LLM invocation, validation, protected field enforcement).
Layering rule: orchestrate dependencies through interfaces while preserving a provider-agnostic domain layer.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from pydantic import ValidationError

from app.domain.recommendation.models import (
	GuidanceLevel,
	RecommendationDraft,
	RecommendationInput,
	RecommendationResult,
)
from app.domain.recommendation.policy import (
	is_referral_required,
)
from app.domain.recommendation.prompt_builder import PROMPT_VERSION, build_messages
from app.domain.safety.models import RecommendationPermission, Urgency
from app.infrastructure.llm.client import LLMClient, RecommendationLLMError


logger = logging.getLogger(__name__)

FIXED_DISCLAIMER = (
	"This output is educational and not a medical diagnosis. "
	"If symptoms are severe, worsening, or concerning, seek qualified professional care promptly."
)

REFERRAL_OVERRIDE_REASON = (
	"Backend safety policy requires referral-oriented guidance for this risk level."
)


class RecommendationValidationError(Exception):
	"""Raised when LLM output cannot be parsed or validated as RecommendationDraft."""


class RecommendationUnavailableError(Exception):
	"""Raised when recommendation generation fails after bounded retries."""


class RecommendationBlockedError(Exception):
	"""Raised before LLM invocation when backend safety blocks guidance."""


class RedFlagEscalationRequiredError(Exception):
	"""Raised when a recommendation is requested for urgent/emergency safety state."""


def parse_llm_output(raw: str) -> RecommendationDraft:
	"""Parse and validate raw LLM JSON output as RecommendationDraft."""

	try:
		payload = json.loads(raw)
	except json.JSONDecodeError as exc:
		raise RecommendationValidationError("LLM output is not valid JSON") from exc

	if isinstance(payload, dict):
		payload = _normalize_list_fields(payload)

	try:
		return RecommendationDraft.model_validate(payload)
	except ValidationError as exc:
		raise RecommendationValidationError("LLM output failed RecommendationDraft validation") from exc


def _normalize_list_fields(payload: dict) -> dict:
	"""Accept a single text item where the provider omitted an expected JSON array."""

	normalized = payload.copy()
	for field in (
		"possible_contributing_factors",
		"skin_tone_considerations",
		"prevention",
		"warning_signs",
		"limitations",
	):
		if isinstance(normalized.get(field), str):
			normalized[field] = [normalized[field]]

	action = normalized.get("recommended_action")
	if isinstance(action, dict) and isinstance(action.get("steps"), str):
		normalized["recommended_action"] = {**action, "steps": [action["steps"]]}

	return normalized


def enforce_guidance_consistency(
	guidance_level: GuidanceLevel,
	draft: RecommendationDraft,
) -> RecommendationDraft:
	"""Correct unsafe draft actions when model output violates permitted guidance level."""

	if guidance_level not in {
		GuidanceLevel.URGENT_REFERRAL,
		GuidanceLevel.PROFESSIONAL_REVIEW,
	}:
		return draft

	action_type = draft.recommended_action.type.strip().lower()
	has_steps = len(draft.recommended_action.steps) > 0
	is_violation = action_type == "self_care" or has_steps
	if not is_violation:
		return draft

	logger.warning(
		"Model output violated permitted guidance level '%s'; overriding to referral-safe action.",
		guidance_level.value,
	)
	corrected = draft.model_copy(deep=True)
	corrected.recommended_action.type = "referral"
	corrected.recommended_action.steps = []
	if not corrected.recommended_action.referral_reason:
		corrected.recommended_action.referral_reason = REFERRAL_OVERRIDE_REASON
	return corrected


def assemble_recommendation_result(
	input: RecommendationInput,
	guidance_level: GuidanceLevel,
	draft: RecommendationDraft,
	model_version: str,
) -> RecommendationResult:
	"""Assemble final response with backend-owned protected fields."""

	return RecommendationResult(
		assessment_id=input.assessment_id,
		condition=input.assessment.condition,
		confidence_level=input.assessment.confidence_level,
		confidence_score=input.assessment.confidence_score,
		guidance_level=guidance_level,
		referral_required=is_referral_required(guidance_level),
		safety=input.safety,
		model_version=model_version,
		prompt_version=PROMPT_VERSION,
		disclaimer=FIXED_DISCLAIMER,
	  generated_at=datetime.now(timezone.utc),
		draft=draft,
	)


async def generate_recommendation(
	input: RecommendationInput,
	llm_client: LLMClient,
) -> RecommendationResult:
	"""Generate recommendation result with one retry on LLM or parse failure."""

	if input.safety.urgency in {Urgency.EMERGENCY, Urgency.URGENT}:
		raise RedFlagEscalationRequiredError("RED_FLAG_ESCALATION_REQUIRED")
	if input.safety.recommendation_permission is not RecommendationPermission.ALLOWED:
		raise RecommendationBlockedError("RECOMMENDATION_BLOCKED")

	guidance_level = input.allowed_guidance_level
	messages = build_messages(input, guidance_level)

	draft: RecommendationDraft | None = None
	for attempt in (1, 2):
		try:
			raw = await llm_client.generate(messages)
			draft = parse_llm_output(raw)
			break
		except (RecommendationLLMError, RecommendationValidationError) as exc:
			logger.warning(
				"Recommendation generation attempt %s failed: %s",
				attempt,
				str(exc),
			)
			if attempt == 2:
				raise RecommendationUnavailableError("RECOMMENDATION_UNAVAILABLE") from exc

	assert draft is not None
	safe_draft = enforce_guidance_consistency(guidance_level, draft)
	return assemble_recommendation_result(
		input=input,
		guidance_level=guidance_level,
		draft=safe_draft,
		model_version=input.assessment.engine_version,
	)
