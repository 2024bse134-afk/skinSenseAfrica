"""API dependency providers.

Single responsibility: expose injectable dependencies for routers.
"""

from app.api.repository import InMemoryAssessmentRepository, InMemoryReferralRepository
from app.infrastructure.classifier.client import ClassifierClient, get_classifier_client
from app.infrastructure.llm.client import LLMClient, get_llm_client
from app.settings import settings


_assessment_repository = InMemoryAssessmentRepository()
_referral_repository = InMemoryReferralRepository()


def get_assessment_repository() -> InMemoryAssessmentRepository:
    return _assessment_repository


def get_recommendation_llm_client() -> LLMClient:
    return get_llm_client(settings)


def get_classifier() -> ClassifierClient:
    return get_classifier_client(settings)


def get_referral_repository() -> InMemoryReferralRepository:
    return _referral_repository
