import pytest

from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import (
    FollowUpQuestionId,
    ImageQualityIssue,
    VisualFinding,
    VisualSafetySignal,
)
from app.infrastructure.assessment.prompt import build_guarded_assessment_prompt


def test_guarded_prompt_contains_every_controlled_value() -> None:
    prompt = build_guarded_assessment_prompt(
        prompt_version="image-assessment-v1",
        schema_version="v1",
    )
    for enum_type in (
        Condition,
        VisualFinding,
        ImageQualityIssue,
        FollowUpQuestionId,
        VisualSafetySignal,
    ):
        for item in enum_type:
            assert item.value in prompt


def test_guarded_prompt_prohibits_diagnosis_inference_and_treatment() -> None:
    prompt = build_guarded_assessment_prompt(
        prompt_version="image-assessment-v1",
        schema_version="v1",
    ).lower()
    for required_instruction in (
        "not a diagnosis",
        "do not invent symptoms",
        "do not infer race",
        "do not provide treatment",
        "no markdown",
        "other_or_uncertain",
        "backend-owned fields",
    ):
        assert required_instruction in prompt


@pytest.mark.parametrize(
    ("prompt_version", "schema_version"),
    [("unreviewed", "v1"), ("image-assessment-v1", "v2")],
)
def test_unknown_prompt_or_schema_version_is_rejected(
    prompt_version: str,
    schema_version: str,
) -> None:
    with pytest.raises(ValueError):
        build_guarded_assessment_prompt(
            prompt_version=prompt_version,
            schema_version=schema_version,
        )
