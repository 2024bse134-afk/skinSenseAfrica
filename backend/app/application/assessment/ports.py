"""Application-layer port for replaceable image-assessment engines."""

from typing import Protocol

from app.domain.assessment.models import (
    AssessmentEngine,
    ProviderAssessmentDraft,
    ValidatedImage,
)


class AssessmentProviderError(Exception):
    """Base class for sanitized assessment-provider failures."""


class AssessmentProviderUnavailable(AssessmentProviderError):
    """The configured provider could not be reached or used."""


class AssessmentProviderTimeout(AssessmentProviderError):
    """The provider exceeded the assessment deadline."""


class AssessmentProviderOutputInvalid(AssessmentProviderError):
    """The provider returned an invalid structured result."""


class ImageAssessmentProvider(Protocol):
    @property
    def engine(self) -> AssessmentEngine: ...

    @property
    def engine_version(self) -> str: ...

    async def assess(
        self,
        image: ValidatedImage,
        *,
        prompt_version: str,
        deadline_seconds: float,
    ) -> ProviderAssessmentDraft: ...
