"""Assessments API router.

Single responsibility: expose assessment workflow endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.dependencies import (
    get_assessment_repository,
    get_classifier,
    get_recommendation_llm_client,
    get_referral_repository,
)
from app.api.repository import (
    AssessmentRecord,
    InMemoryAssessmentRepository,
    InMemoryReferralRepository,
)
from app.application.classification.service import classify_uploaded_image
from app.application.recommendation.service import (
    RecommendationUnavailableError,
    generate_recommendation,
)
from app.domain.recommendation.models import (
    ClassificationResult,
    Questionnaire,
    RecommendationInput,
    RecommendationResult,
)
from app.infrastructure.classifier.client import ClassifierClient, ClassifierConfigurationError
from app.infrastructure.llm.client import LLMClient


router = APIRouter()


class AssessmentStatusResponse(BaseModel):
    id: str
    status: str


class ReferralRequest(BaseModel):
    assessment_id: str
    name: str
    contact: str
    reason: str


class ReferralResponse(BaseModel):
    id: str
    status: str

_RECOMMENDATION_UNAVAILABLE_RESPONSE = {
    "error": {
        "code": "RECOMMENDATION_UNAVAILABLE",
        "message": "A safe recommendation could not be generated.",
        "retryable": True,
        "details": None,
    }
}

_VALID_RECOMMENDATION_STATUSES = {
    "questionnaire_completed",
    "completed",
    "professional_review_required",
}


@router.post("/v1/assessments", response_model=AssessmentStatusResponse, status_code=201)
async def create_assessment(
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentStatusResponse:
    record = repository.create()
    return AssessmentStatusResponse(id=record.id, status=record.status)


@router.post("/v1/assessments/{id}/image", response_model=AssessmentStatusResponse)
async def upload_assessment_image(
    id: str,
    image: UploadFile = File(...),
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentStatusResponse:
    if repository.get(id) is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image")

    record = repository.save_image(id, await image.read(), image.content_type)
    assert record is not None  # existence is checked above
    return AssessmentStatusResponse(id=record.id, status=record.status)


@router.post("/v1/assessments/{id}/classify", response_model=ClassificationResult)
async def classify_assessment(
    id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
    classifier: ClassifierClient = Depends(get_classifier),
) -> ClassificationResult:
    if repository.get(id) is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    uploaded_image = repository.get_image(id)
    if uploaded_image is None:
        raise HTTPException(status_code=409, detail="An image must be uploaded before classification")

    try:
        result = await classify_uploaded_image(*uploaded_image, classifier)
    except ClassifierConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    repository.save_classification(id, result)
    return result


@router.put("/v1/assessments/{id}/questionnaire", response_model=AssessmentStatusResponse)
async def save_assessment_questionnaire(
    id: str,
    questionnaire: Questionnaire,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentStatusResponse:
    record = repository.get(id)
    if record is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if record.classification is None or record.status != "classified":
        raise HTTPException(status_code=409, detail="Assessment must be classified before questionnaire submission")

    record = repository.save_questionnaire(id, questionnaire)
    assert record is not None
    return AssessmentStatusResponse(id=record.id, status=record.status)


@router.get("/v1/assessments/{id}", response_model=AssessmentRecord)
async def get_assessment(
    id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
) -> AssessmentRecord:
    record = repository.get(id)
    if record is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return record


@router.post("/v1/referrals", response_model=ReferralResponse, status_code=201)
async def create_referral(
    referral: ReferralRequest,
    repository: InMemoryReferralRepository = Depends(get_referral_repository),
) -> ReferralResponse:
    record = repository.create(**referral.model_dump())
    return ReferralResponse(id=record.id, status=record.status)


@router.post("/v1/assessments/{id}/recommendation", response_model=RecommendationResult)
async def create_recommendation(
    id: str,
    repository: InMemoryAssessmentRepository = Depends(get_assessment_repository),
    llm_client: LLMClient = Depends(get_recommendation_llm_client),
) -> RecommendationResult | JSONResponse:
    record = repository.get(id)
    if record is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if (
        record.status not in _VALID_RECOMMENDATION_STATUSES
        or record.classification is None
        or record.questionnaire is None
    ):
        raise HTTPException(
            status_code=409,
            detail="Assessment is not ready for recommendation generation",
        )

    recommendation_input = RecommendationInput(
        assessment_id=record.id,
        classifier=record.classification,
        questionnaire=record.questionnaire,
        skin_context=record.skin_context,
    )

    try:
        result = await generate_recommendation(recommendation_input, llm_client)
    except RecommendationUnavailableError:
        return JSONResponse(status_code=503, content=_RECOMMENDATION_UNAVAILABLE_RESPONSE)

    next_status = "professional_review_required" if result.referral_required else "completed"
    repository.save_recommendation(id, result, next_status)
    return result
