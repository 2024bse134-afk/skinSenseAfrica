from __future__ import annotations

import asyncio

import pytest

from app.application.assessment.ports import ImageAssessmentProvider
from app.application.assessment.service import assess_validated_image
from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import (
    AssessmentEngine,
    ConfidenceLevel,
    ImageQualityStatus,
    ProviderAssessmentDraft,
    ValidatedImage,
)
from app.infrastructure.assessment.mock import MockImageAssessmentProvider, MockProviderScenario


IMAGE = ValidatedImage(b"sanitized", "image/jpeg", "jpeg", 400, 400)


@pytest.mark.parametrize(
    ("scenario", "condition", "confidence", "status"),
    [
        (MockProviderScenario.ACCEPTABLE, Condition.ACNE, ConfidenceLevel.HIGH, "completed"),
        (
            MockProviderScenario.RETAKE_REQUIRED,
            Condition.ACNE,
            ConfidenceLevel.HIGH,
            "retake_required",
        ),
        (
            MockProviderScenario.UNKNOWN_CONDITION,
            Condition.OTHER_OR_UNCERTAIN,
            ConfidenceLevel.UNKNOWN,
            "completed",
        ),
        (MockProviderScenario.LOW_CONFIDENCE, Condition.ACNE, ConfidenceLevel.LOW, "completed"),
    ],
)
def test_mock_scenarios_are_normalized(scenario, condition, confidence, status) -> None:
    result = asyncio.run(
        assess_validated_image(
            IMAGE,
            MockImageAssessmentProvider(scenario),
            prompt_version="image-assessment-v1",
            deadline_seconds=2,
        )
    )
    assert result.condition is condition
    assert result.confidence_level is confidence
    assert result.assessment_status.value == status
    if condition is Condition.OTHER_OR_UNCERTAIN:
        assert result.confidence_score is None
        assert result.recommendation_status.value == "blocked"


class ReplacementProvider:
    engine = AssessmentEngine.TRAINED_CLASSIFIER
    engine_version = "future-test-1"

    async def assess(self, image, *, prompt_version, deadline_seconds):
        return ProviderAssessmentDraft.model_validate(
            {
                "condition": "eczema",
                "confidence_level": "moderate",
                "confidence_score": 0.7,
                "visual_findings": ["dry_appearing_patch"],
                "alternative_conditions": [],
                "image_quality": {"status": "acceptable", "issues": []},
                "needs_more_information": True,
                "follow_up_question_ids": ["itching"],
                "visual_safety_signals": [],
            }
        )


def test_provider_replacement_contract_needs_no_orchestrator_change() -> None:
    provider: ImageAssessmentProvider = ReplacementProvider()
    result = asyncio.run(
        assess_validated_image(
            IMAGE,
            provider,
            prompt_version="image-assessment-v1",
            deadline_seconds=2,
        )
    )
    assert result.assessment_engine is AssessmentEngine.TRAINED_CLASSIFIER
    assert result.condition is Condition.ECZEMA
    assert result.image_quality.status is ImageQualityStatus.ACCEPTABLE
