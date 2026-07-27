"""Domain recommendation policy rules.

Single responsibility: host deterministic recommendation guidance rules and policy interfaces.
Layering rule: domain code must not import databases, HTTP clients, or provider-specific SDKs.
"""

from __future__ import annotations

from app.domain.recommendation.models import GuidanceLevel, Questionnaire
from app.settings import settings


HIGH_PAIN_THRESHOLD = 7


def has_emergency_red_flag(q: Questionnaire) -> bool:
	"""Return True for symptom patterns requiring immediate escalation."""

	if q.bleeding_or_open_wound is True:
		return True
	if q.eye_involvement is True:
		return True
	if q.fever is True and q.rapidly_spreading is True:
		return True

	# Conservative escalation combinations to avoid false negatives.
	if q.fever is True and q.swelling is True:
		return True
	if q.rapidly_spreading is True and (q.pain_level is not None and q.pain_level >= 8):
		return True

	return False


def has_clinical_red_flag(q: Questionnaire) -> bool:
	"""Return True for non-emergency but clinically concerning symptom patterns."""

	if q.rapidly_spreading is True:
		return True
	if q.swelling is True:
		return True
	if q.pain_level is not None and q.pain_level >= HIGH_PAIN_THRESHOLD:
		return True
	if q.fever is True:
		return True

	return False


def decide_guidance(confidence: float, questionnaire: Questionnaire) -> GuidanceLevel:
	"""Determine guidance level from safety flags and classifier confidence."""

	if has_emergency_red_flag(questionnaire):
		return GuidanceLevel.URGENT_REFERRAL
	if has_clinical_red_flag(questionnaire):
		return GuidanceLevel.PROFESSIONAL_REVIEW
	if confidence < settings.CONFIDENCE_RETAKE_THRESHOLD:
		return GuidanceLevel.RETAKE_OR_REVIEW
	if confidence < settings.CONFIDENCE_CAUTIOUS_THRESHOLD:
		return GuidanceLevel.CAUTIOUS_GUIDANCE
	return GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE


def derive_urgency(level: GuidanceLevel) -> str:
	"""Map guidance level to backend-owned urgency value."""

	if level == GuidanceLevel.URGENT_REFERRAL:
		return "urgent"
	if level == GuidanceLevel.PROFESSIONAL_REVIEW:
		return "high"
	if level == GuidanceLevel.RETAKE_OR_REVIEW:
		return "moderate"
	if level == GuidanceLevel.CAUTIOUS_GUIDANCE:
		return "routine"
	return "routine"


def is_referral_required(level: GuidanceLevel) -> bool:
	"""Return whether the selected guidance level requires referral."""

	return level in {
		GuidanceLevel.URGENT_REFERRAL,
		GuidanceLevel.PROFESSIONAL_REVIEW,
	}
