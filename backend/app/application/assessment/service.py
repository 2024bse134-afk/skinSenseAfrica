"""Normalize provider output into the stable backend-owned assessment result."""

from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter

from pydantic import ValidationError

from app.application.assessment.ports import (
    AssessmentProviderOutputInvalid,
    ImageAssessmentProvider,
)
from app.domain.assessment.conditions import Condition, normalize_condition
from app.domain.assessment.models import (
    AssessmentStatus,
    ConfidenceLevel,
    ImageAssessmentResult,
    ImageQualityStatus,
    ProviderAssessmentDraft,
    RecommendationStatus,
    ValidatedImage,
)


FIXED_ASSESSMENT_LIMITATIONS = [
    "This is a preliminary AI-assisted assessment.",
    "This is not a confirmed diagnosis.",
]


async def assess_validated_image(
    image: ValidatedImage,
    provider: ImageAssessmentProvider,
    *,
    prompt_version: str,
    deadline_seconds: float,
) -> ImageAssessmentResult:
    """Call a replaceable provider and assemble protected result fields."""

    started = perf_counter()
    raw_draft = await provider.assess(
        image,
        prompt_version=prompt_version,
        deadline_seconds=deadline_seconds,
    )
    try:
        draft = ProviderAssessmentDraft.model_validate(raw_draft)
    except ValidationError as exc:
        raise AssessmentProviderOutputInvalid("assessment draft validation failed") from exc

    condition, used_fallback = normalize_condition(draft.condition)
    confidence_level = draft.confidence_level
    confidence_score = draft.confidence_score
    needs_more_information = draft.needs_more_information

    if used_fallback or condition is Condition.OTHER_OR_UNCERTAIN:
        if confidence_level not in {ConfidenceLevel.LOW, ConfidenceLevel.UNKNOWN}:
            confidence_level = ConfidenceLevel.UNKNOWN
        confidence_score = None
        needs_more_information = True

    alternatives: list[Condition] = []
    for alternative_value in draft.alternative_conditions:
        alternative, _ = normalize_condition(alternative_value)
        if alternative is condition or alternative in alternatives:
            continue
        alternatives.append(alternative)

    retake_required = draft.image_quality.status is ImageQualityStatus.RETAKE_REQUIRED
    assessment_status = (
        AssessmentStatus.RETAKE_REQUIRED if retake_required else AssessmentStatus.COMPLETED
    )
    recommendation_status = (
        RecommendationStatus.BLOCKED
        if retake_required or condition is Condition.OTHER_OR_UNCERTAIN
        else RecommendationStatus.PENDING_QUESTIONNAIRE
    )

    return ImageAssessmentResult(
        assessment_status=assessment_status,
        condition=condition,
        confidence_level=confidence_level,
        confidence_score=confidence_score,
        visual_findings=draft.visual_findings,
        alternative_conditions=alternatives,
        image_quality=draft.image_quality,
        needs_more_information=needs_more_information,
        follow_up_question_ids=draft.follow_up_question_ids,
        visual_safety_signals=draft.visual_safety_signals,
        recommendation_status=recommendation_status,
        assessment_engine=provider.engine,
        engine_version=provider.engine_version,
        prompt_version=prompt_version,
        limitations=FIXED_ASSESSMENT_LIMITATIONS,
        assessed_at=datetime.now(timezone.utc),
        inference_ms=max(0, round((perf_counter() - started) * 1000)),
    )
