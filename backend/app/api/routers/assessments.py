"""Guarded assessment workflow API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict

from app.api.dependencies import (
    get_assessment_repository,
    get_image_assessment_provider,
    get_recommendation_llm_client,
    get_referral_repository,
)
from app.api.errors import APIError, ErrorCode
from app.api.repository import (
    AssessmentRecord,
    InMemoryAssessmentRepository,
    InMemoryReferralRepository,
)
from app.application.assessment.ports import (
    AssessmentProviderOutputInvalid,
    AssessmentProviderTimeout,
    AssessmentProviderUnavailable,
    ImageAssessmentProvider,
)
from app.application.assessment.service import assess_validated_image
from app.application.recommendation.service import (
    RecommendationBlockedError,
    RecommendationUnavailableError,
    generate_recommendation,
)
from app.domain.assessment.models import ImageAssessmentResult
from app.domain.questionnaire.models import Questionnaire
from app.domain.recommendation.models import (
    RecommendationAssessmentContext,
    RecommendationInput,
    RecommendationResult,
)
from app.domain.recommendation.policy import decide_guidance
from app.domain.safety.models import RecommendationPermission, SafetyResult
from app.domain.safety.policy import evaluate_safety
from app.infrastructure.image.validator import ImageValidationError, validate_and_sanitize_image
from app.infrastructure.llm.client import LLMClient
from app.settings import settings


router = APIRouter()


class AssessmentStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    status: str


class QuestionnaireResponse(AssessmentStatusResponse):
    safety: SafetyResult


class ReferralRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    assessment_id: str
    name: str
    contact: str
    reason: str


class ReferralResponse(BaseModel):
    id: str
    status: str


def _not_found() -> APIError:
    return APIError(404, ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.")


def _state_conflict(message: str) -> APIError:
    return APIError(409, ErrorCode.ASSESSMENT_STATE_CONFLICT, message)


@router.post("/v1/assessments", response_model=AssessmentStatusResponse, status_code=201)
async def create_assessment(
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentStatusResponse:
    record = repository.create()
    return AssessmentStatusResponse(id=record.id, status=record.status)


@router.post(
    "/v1/assessments/{assessment_id}/image-assessment",
    response_model=ImageAssessmentResult,
)
async def create_image_assessment(
    assessment_id: str,
    image: UploadFile = File(...),
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
    provider: ImageAssessmentProvider = Depends(get_image_assessment_provider),
) -> ImageAssessmentResult:
    if repository.get(assessment_id) is None:
        await image.close()
        raise _not_found()

    try:
        validated = await validate_and_sanitize_image(
            image,
            max_bytes=settings.image_assessment_max_bytes,
            max_pixels=settings.image_assessment_max_pixels,
            min_side=settings.image_assessment_min_side,
        )
        result = await assess_validated_image(
            validated,
            provider,
            prompt_version=settings.image_assessment_prompt_version,
            deadline_seconds=settings.image_assessment_timeout_seconds,
        )
    except ImageValidationError as exc:
        status_code = {
            ErrorCode.INVALID_IMAGE_TYPE.value: 415,
            ErrorCode.IMAGE_TOO_LARGE.value: 413,
            ErrorCode.IMAGE_DECODE_FAILED.value: 422,
            ErrorCode.IMAGE_QUALITY_INSUFFICIENT.value: 422,
        }[exc.code]
        raise APIError(status_code, exc.code, exc.message, details=exc.details) from exc
    except AssessmentProviderTimeout as exc:
        raise APIError(
            504,
            ErrorCode.ASSESSMENT_TIMEOUT,
            "The image assessment timed out.",
            retryable=True,
        ) from exc
    except AssessmentProviderUnavailable as exc:
        raise APIError(
            503,
            ErrorCode.ASSESSMENT_PROVIDER_UNAVAILABLE,
            "The image assessment service is unavailable.",
            retryable=True,
        ) from exc
    except AssessmentProviderOutputInvalid as exc:
        raise APIError(
            502,
            ErrorCode.ASSESSMENT_OUTPUT_INVALID,
            "The image assessment returned an invalid result.",
            retryable=True,
        ) from exc
    finally:
        await image.close()

    repository.save_assessment(assessment_id, result)
    return result


@router.post("/v1/assessments/{assessment_id}/image", deprecated=True)
async def deprecated_upload_assessment_image(
    assessment_id: str,
    image: UploadFile = File(...),
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> None:
    await image.close()
    if repository.get(assessment_id) is None:
        raise _not_found()
    raise _state_conflict(
        "Separate image upload is deprecated; use the image-assessment endpoint."
    )


@router.post("/v1/assessments/{assessment_id}/classify", deprecated=True)
async def deprecated_classify_assessment(
    assessment_id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> None:
    if repository.get(assessment_id) is None:
        raise _not_found()
    raise _state_conflict(
        "The classify endpoint is deprecated; use the image-assessment endpoint."
    )


@router.put(
    "/v1/assessments/{assessment_id}/questionnaire",
    response_model=QuestionnaireResponse,
)
async def save_assessment_questionnaire(
    assessment_id: str,
    questionnaire: Questionnaire,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> QuestionnaireResponse:
    record = repository.get(assessment_id)
    if record is None:
        raise _not_found()
    if record.assessment is None or record.status != "assessment_completed":
        raise _state_conflict(
            "A completed, acceptable image assessment is required before the questionnaire."
        )

    safety = evaluate_safety(
        record.assessment,
        questionnaire,
        severe_pain_threshold=settings.severe_pain_threshold,
        policy_version=settings.safety_policy_version,
    )
    saved = repository.save_questionnaire(assessment_id, questionnaire, safety)
    assert saved is not None
    return QuestionnaireResponse(id=saved.id, status=saved.status, safety=safety)


@router.get("/v1/assessments/{assessment_id}", response_model=AssessmentRecord)
async def get_assessment(
    assessment_id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentRecord:
    record = repository.get(assessment_id)
    if record is None:
        raise _not_found()
    return record


@router.post("/v1/referrals", response_model=ReferralResponse, status_code=201)
async def create_referral(
    referral: ReferralRequest,
    repository: InMemoryReferralRepository = Depends(get_referral_repository),
) -> ReferralResponse:
    record = repository.create(**referral.model_dump())
    return ReferralResponse(id=record.id, status=record.status)


@router.post(
    "/v1/assessments/{assessment_id}/recommendation",
    response_model=RecommendationResult,
)
async def create_recommendation(
    assessment_id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
    llm_client: LLMClient = Depends(get_recommendation_llm_client),
) -> RecommendationResult:
    record = repository.get(assessment_id)
    if record is None:
        raise _not_found()
    if record.recommendation is not None and record.status == "completed":
        return record.recommendation
    if record.assessment is None or record.questionnaire is None or record.safety is None:
        raise _state_conflict("Assessment is not ready for recommendation generation.")

    if record.safety.recommendation_permission is RecommendationPermission.BLOCKED:
        raise APIError(
            409,
            ErrorCode.RECOMMENDATION_BLOCKED,
            record.safety.action_message,
            details={"urgency": record.safety.urgency.value},
        )

    guidance_level = decide_guidance(record.assessment.confidence_level, record.safety)
    recommendation_input = RecommendationInput(
        assessment_id=record.id,
        assessment=RecommendationAssessmentContext(
            condition=record.assessment.condition,
            confidence_level=record.assessment.confidence_level,
            confidence_score=record.assessment.confidence_score,
            visual_findings=record.assessment.visual_findings,
            alternative_conditions=record.assessment.alternative_conditions,
            needs_more_information=record.assessment.needs_more_information,
            engine_version=record.assessment.engine_version,
        ),
        questionnaire=record.questionnaire,
        safety=record.safety,
        allowed_guidance_level=guidance_level,
        skin_context=record.skin_context,
    )

    try:
        result = await generate_recommendation(recommendation_input, llm_client)
    except RecommendationBlockedError as exc:
        raise APIError(
            409,
            ErrorCode.RECOMMENDATION_BLOCKED,
            record.safety.action_message,
        ) from exc
    except RecommendationUnavailableError as exc:
        raise APIError(
            503,
            ErrorCode.RECOMMENDATION_UNAVAILABLE,
            "A safe recommendation could not be generated.",
            retryable=True,
        ) from exc

    repository.save_recommendation(assessment_id, result, "completed")
    return result
