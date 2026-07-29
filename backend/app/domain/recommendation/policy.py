"""Recommendation guidance mapping after deterministic safety evaluation."""

from app.domain.assessment.models import ConfidenceLevel
from app.domain.recommendation.models import GuidanceLevel
from app.domain.safety.models import RecommendationPermission, SafetyResult, Urgency


def decide_guidance(
    confidence_level: ConfidenceLevel,
    safety: SafetyResult,
) -> GuidanceLevel:
    """Map backend-owned assessment confidence and safety to allowed guidance."""

    if safety.urgency is Urgency.EMERGENCY:
        return GuidanceLevel.URGENT_REFERRAL
    if safety.urgency is Urgency.URGENT:
        return GuidanceLevel.URGENT_REFERRAL
    if safety.urgency is Urgency.PROFESSIONAL_REVIEW:
        return GuidanceLevel.PROFESSIONAL_REVIEW
    if safety.recommendation_permission is not RecommendationPermission.ALLOWED:
        return GuidanceLevel.RETAKE_OR_REVIEW
    if confidence_level is ConfidenceLevel.MODERATE:
        return GuidanceLevel.CAUTIOUS_GUIDANCE
    if confidence_level is ConfidenceLevel.HIGH:
        return GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
    return GuidanceLevel.RETAKE_OR_REVIEW


def is_referral_required(level: GuidanceLevel) -> bool:
    return level in {
        GuidanceLevel.URGENT_REFERRAL,
        GuidanceLevel.PROFESSIONAL_REVIEW,
    }
