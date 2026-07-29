"""Deterministic image-assessment provider for guarded prototype workflows."""

from enum import Enum

from app.application.assessment.ports import (
    AssessmentProviderTimeout,
    AssessmentProviderUnavailable,
)
from app.domain.assessment.models import (
    AssessmentEngine,
    ConfidenceLevel,
    FollowUpQuestionId,
    ImageQuality,
    ImageQualityIssue,
    ImageQualityStatus,
    ProviderAssessmentDraft,
    ValidatedImage,
    VisualFinding,
)


class MockProviderScenario(str, Enum):
    ACCEPTABLE = "acceptable"
    RETAKE_REQUIRED = "retake_required"
    UNKNOWN_CONDITION = "unknown_condition"
    LOW_CONFIDENCE = "low_confidence"
    TIMEOUT = "timeout"
    MALFORMED = "malformed"
    UNAVAILABLE = "unavailable"


class MockImageAssessmentProvider:
    """Mock that never performs inference and is configurable for tests."""

    def __init__(
        self,
        scenario: MockProviderScenario = MockProviderScenario.ACCEPTABLE,
        *,
        capture_inputs: bool = False,
    ):
        self.scenario = scenario
        self.capture_inputs = capture_inputs
        self.received_images: list[ValidatedImage] = []
        self.received_count = 0

    @property
    def engine(self) -> AssessmentEngine:
        return AssessmentEngine.MOCK

    @property
    def engine_version(self) -> str:
        return "mock-assessment-1"

    async def assess(
        self,
        image: ValidatedImage,
        *,
        prompt_version: str,
        deadline_seconds: float,
    ) -> ProviderAssessmentDraft:
        _ = prompt_version, deadline_seconds
        self.received_count += 1
        if self.capture_inputs:
            self.received_images.append(image)

        if self.scenario is MockProviderScenario.TIMEOUT:
            raise AssessmentProviderTimeout("mock assessment timed out")
        if self.scenario is MockProviderScenario.UNAVAILABLE:
            raise AssessmentProviderUnavailable("mock assessment provider unavailable")
        if self.scenario is MockProviderScenario.MALFORMED:
            return {"condition": "acne"}  # type: ignore[return-value]

        if self.scenario is MockProviderScenario.RETAKE_REQUIRED:
            quality = ImageQuality(
                status=ImageQualityStatus.RETAKE_REQUIRED,
                issues=[ImageQualityIssue.BLURRED],
            )
        else:
            quality = ImageQuality(status=ImageQualityStatus.ACCEPTABLE, issues=[])

        condition = "acne"
        confidence_level = ConfidenceLevel.HIGH
        confidence_score: float | None = 0.88
        if self.scenario is MockProviderScenario.UNKNOWN_CONDITION:
            condition = "provider_only_condition"
        elif self.scenario is MockProviderScenario.LOW_CONFIDENCE:
            confidence_level = ConfidenceLevel.LOW
            confidence_score = 0.35

        return ProviderAssessmentDraft(
            condition=condition,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            visual_findings=[VisualFinding.VISIBLE_BUMPS],
            alternative_conditions=[],
            image_quality=quality,
            needs_more_information=True,
            follow_up_question_ids=[
                FollowUpQuestionId.DURATION,
                FollowUpQuestionId.PAIN_LEVEL,
                FollowUpQuestionId.RAPIDLY_SPREADING,
            ],
            visual_safety_signals=[],
        )
