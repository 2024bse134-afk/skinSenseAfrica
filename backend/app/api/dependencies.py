"""API dependency providers.

Single responsibility: expose injectable dependencies for routers.
"""

from app.api.repository import InMemoryAssessmentRepository, InMemoryReferralRepository
from app.api.errors import APIError, ErrorCode
from app.infrastructure.classifier.client import ClassifierClient, get_classifier_client
from app.application.assessment.ports import (
    AssessmentProviderUnavailable,
    ImageAssessmentProvider,
)
from app.infrastructure.assessment.factory import build_image_assessment_provider
from app.infrastructure.assessment.mock import MockImageAssessmentProvider
from app.infrastructure.llm.client import LLMClient, get_llm_client
from app.settings import settings


_assessment_repository = InMemoryAssessmentRepository()
_referral_repository = InMemoryReferralRepository()
_image_assessment_provider = MockImageAssessmentProvider()


async def get_assessment_repository() -> InMemoryAssessmentRepository:
    return _assessment_repository


async def get_recommendation_llm_client() -> LLMClient:
    return get_llm_client(settings)


async def get_classifier() -> ClassifierClient:
    return get_classifier_client(settings)


async def get_referral_repository() -> InMemoryReferralRepository:
    return _referral_repository


async def get_image_assessment_provider() -> ImageAssessmentProvider:
    try:
        return build_image_assessment_provider(
            settings,
            mock_provider=_image_assessment_provider,
        )
    except AssessmentProviderUnavailable as exc:
        raise APIError(
            503,
            ErrorCode.ASSESSMENT_PROVIDER_UNAVAILABLE,
            "The image assessment service is not configured.",
            retryable=False,
        ) from exc
