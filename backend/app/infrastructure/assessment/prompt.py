"""Versioned, provider-neutral guarded image-assessment prompt."""

from __future__ import annotations

from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import (
    ConfidenceLevel,
    FollowUpQuestionId,
    ImageQualityIssue,
    ImageQualityStatus,
    VisualFinding,
    VisualSafetySignal,
)


SUPPORTED_PROMPT_VERSION = "image-assessment-v1"
SUPPORTED_SCHEMA_VERSION = "v1"


def _values(enum_type: type) -> str:
    return ", ".join(item.value for item in enum_type)


def build_guarded_assessment_prompt(
    *,
    prompt_version: str,
    schema_version: str,
) -> str:
    """Return the reviewed prompt for the requested immutable versions."""

    if prompt_version != SUPPORTED_PROMPT_VERSION:
        raise ValueError("unsupported image assessment prompt version")
    if schema_version != SUPPORTED_SCHEMA_VERSION:
        raise ValueError("unsupported image assessment schema version")

    return f"""
You are a guarded preliminary skin-image assessment component.
Prompt version: {prompt_version}. Output schema version: {schema_version}.

Assess only visible features in the supplied image. This is not a diagnosis.
Do not invent symptoms or medical history. Do not infer race, ethnicity,
nationality, identity, gender, or age from appearance. Do not provide treatment,
medication, dosage, product, or duration advice.

Return exactly one JSON object matching ProviderAssessmentDraft. Return no markdown,
code fences, prose, or fields outside that schema. Never return
urgency, red flags, recommendation permission, limitations, engine identity,
timestamps, prompt version, or other backend-owned fields.

Allowed condition values: {_values(Condition)}.
Use other_or_uncertain whenever visual evidence is insufficient.
Allowed confidence levels: {_values(ConfidenceLevel)}.
Allowed visual findings: {_values(VisualFinding)}.
Allowed image-quality statuses: {_values(ImageQualityStatus)}.
Allowed image-quality issues: {_values(ImageQualityIssue)}.
Allowed follow-up question IDs: {_values(FollowUpQuestionId)}.
Allowed visual safety signals: {_values(VisualSafetySignal)}.

Use only approved codes. For acceptable image quality, issues must be empty.
For retake_required, provide at least one approved quality issue. Describe no
feature that is not visibly supported. Alternatives must use allowed condition
values and must not repeat the primary condition.
""".strip()
