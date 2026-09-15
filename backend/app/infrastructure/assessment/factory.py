"""Configuration-driven image-assessment provider selection."""

from __future__ import annotations

from app.application.assessment.ports import (
    AssessmentProviderUnavailable,
    ImageAssessmentProvider,
)
from app.infrastructure.assessment.cortex import CortexMultimodalAssessmentProvider
from app.infrastructure.assessment.mock import MockImageAssessmentProvider


def build_image_assessment_provider(
    config: object,
    *,
    mock_provider: ImageAssessmentProvider | None = None,
) -> ImageAssessmentProvider:
    provider_name = str(getattr(config, "image_assessment_provider", "mock")).strip().lower()
    if provider_name == "mock":
        return mock_provider or MockImageAssessmentProvider()
    if provider_name == "cortex":
        return CortexMultimodalAssessmentProvider(
            api_key=str(getattr(config, "cortex_api_key", "")),
            base_url=str(getattr(config, "cortex_base_url", "")),
            model=str(getattr(config, "cortex_image_model", "")),
            schema_version=str(
                getattr(config, "image_assessment_schema_version", "")
            ),
            max_retries=int(getattr(config, "image_assessment_max_retries", 3)),
            max_output_tokens=int(
                getattr(config, "image_assessment_max_output_tokens", 800)
            ),
            temperature=float(
                getattr(config, "image_assessment_temperature", 0.1)
            ),
        )
    raise AssessmentProviderUnavailable("Unsupported image assessment provider")
