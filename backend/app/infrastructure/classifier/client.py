"""Provider-agnostic classifier client selection for assessment images."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from app.domain.recommendation.models import ClassificationResult, SupportedCondition
from app.settings import settings


class ClassifierConfigurationError(Exception):
    """Raised when a configured classifier provider is not available."""


class ClassifierClient(Protocol):
    """Provider-agnostic image classification boundary."""

    async def classify(self, image: bytes, content_type: str) -> ClassificationResult:
        """Classify a temporarily stored image."""


class MockClassifierClient:
    """Deterministic prototype classifier; does not run model inference."""

    async def classify(self, image: bytes, content_type: str) -> ClassificationResult:
        _ = image, content_type
        return ClassificationResult(
            condition=SupportedCondition.ACNE,
            confidence=0.85,
            model_version="mock-cv-1",
            inference_ms=0,
            predicted_at=datetime.now(timezone.utc),
        )


def _get_setting_value(config: object, upper: str, lower: str, default: str = "") -> str:
    value = getattr(config, upper, None)
    if value is None:
        value = getattr(config, lower, default)
    return str(value)


def get_classifier_client(config: object = settings) -> ClassifierClient:
    """Return the configured classifier implementation."""

    provider = _get_setting_value(
        config, "CLASSIFIER_PROVIDER", "classifier_provider", "mock"
    ).strip().lower()
    if provider == "mock":
        return MockClassifierClient()
    raise ClassifierConfigurationError(
        "No real classifier is wired. Configure CLASSIFIER_PROVIDER=mock."
    )
