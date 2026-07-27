from __future__ import annotations

import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any, get_args, get_origin

import pytest

from app.application.recommendation.service import generate_recommendation
from app.domain.recommendation.models import (
    ClassificationResult,
    GuidanceLevel,
    Questionnaire,
    RecommendationInput,
    SkinContext,
)
from app.domain.recommendation.policy import decide_guidance, is_referral_required
from app.infrastructure.llm.client import MockLLMClient


def _default_value_for_annotation(annotation: Any) -> Any:
    origin = get_origin(annotation)

    if origin is None:
        if annotation is datetime:
            return datetime.now(timezone.utc)

        if isinstance(annotation, type):
            if issubclass(annotation, Enum):
                return next(iter(annotation))
            if issubclass(annotation, bool):
                return False
            if issubclass(annotation, int):
                return 0
            if issubclass(annotation, float):
                return 0.0
            if issubclass(annotation, str):
                return ""
            if issubclass(annotation, list):
                return []
            if issubclass(annotation, dict):
                return {}
            if hasattr(annotation, "model_fields"):
                return build_model_instance(annotation)
        return None

    if origin is list:
        return []
    if origin is dict:
        return {}
    if origin is tuple:
        return ()
    if origin is set:
        return set()

    args = [arg for arg in get_args(annotation) if arg is not type(None)]
    if args:
        return _default_value_for_annotation(args[0])

    return None


def build_model_instance(model_cls: Any, **overrides: Any) -> Any:
    data: dict[str, Any] = {}

    for name, field in model_cls.model_fields.items():
        if name in overrides:
            data[name] = overrides[name]
            continue

        if field.default_factory is not None:
            data[name] = field.default_factory()
            continue

        if not field.is_required():
            data[name] = field.default
            continue

        data[name] = _default_value_for_annotation(field.annotation)

    data.update(overrides)
    return model_cls.model_validate(data)


def build_llm_response(guidance_level: GuidanceLevel, condition: str) -> str:
    action_type = "self_care" if guidance_level == GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE else "referral"
    urgency_map = {
        GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE: "routine",
        GuidanceLevel.PROFESSIONAL_REVIEW: "review",
        GuidanceLevel.URGENT_REFERRAL: "urgent",
    }
    referral_reason = (
        None
        if guidance_level == GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
        else "Backend safety policy requires referral-oriented guidance for this risk level."
    )

    payload = {
        "explanation": f"Assessment aligns with {condition}.",
        "possible_contributing_factors": ["occlusive products", "humidity"],
        "skin_tone_considerations": [
            "Minimize irritation to reduce post-inflammatory marks."
        ],
        "recommended_action": {
            "type": action_type,
            "urgency": urgency_map[guidance_level],
            "steps": ["Use gentle cleansing", "Avoid harsh scrubbing"],
            "referral_reason": referral_reason,
        },
        "prevention": ["Patch test new products", "Use sunscreen"],
        "warning_signs": ["Rapid worsening", "Eye involvement"],
        "limitations": ["Educational guidance only"],
    }
    return json.dumps(payload)


def make_questionnaire(**candidate_overrides: Any) -> Questionnaire:
    return build_model_instance(Questionnaire, **candidate_overrides)


def make_input(
    assessment_id: str,
    condition: str,
    confidence: float,
    questionnaire: Questionnaire,
) -> RecommendationInput:
    classifier = build_model_instance(
        ClassificationResult,
        condition=condition,
        confidence=confidence,
        model_version="cv-test-1",
    )
    skin_context = build_model_instance(SkinContext)
    return RecommendationInput(
        assessment_id=assessment_id,
        classifier=classifier,
        questionnaire=questionnaire,
        skin_context=skin_context,
    )


def pick_questionnaire_for_guidance(target: GuidanceLevel) -> Questionnaire:
    fields = set(Questionnaire.model_fields.keys())

    if target == GuidanceLevel.URGENT_REFERRAL:
        if "eye_involvement" in fields:
            return make_questionnaire(eye_involvement=True)
        if "bleeding_or_open_wound" in fields:
            return make_questionnaire(bleeding_or_open_wound=True)
        if "fever" in fields and "rapidly_spreading" in fields:
            return make_questionnaire(fever=True, rapidly_spreading=True)
        raise AssertionError("No known emergency red-flag fields found in Questionnaire model")

    if target == GuidanceLevel.PROFESSIONAL_REVIEW:
        if "pain_level" in fields:
            return make_questionnaire(pain_level=7)
        if "swelling" in fields:
            return make_questionnaire(swelling=True)
        if "widespread" in fields:
            return make_questionnaire(widespread=True)
        raise AssertionError("No known clinical-review fields found in Questionnaire model")

    return make_questionnaire()


SCENARIOS = [
    ("acne", 0.92, GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE),
    ("eczema_dermatitis", 0.74, GuidanceLevel.PROFESSIONAL_REVIEW),
    ("hyperpigmentation", 0.88, GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE),
    ("possible_fungal_infection", 0.63, GuidanceLevel.URGENT_REFERRAL),
    ("other_uncertain", 0.58, GuidanceLevel.PROFESSIONAL_REVIEW),
    ("acne", 0.55, GuidanceLevel.URGENT_REFERRAL),
]


@pytest.mark.anyio
@pytest.mark.parametrize("condition,confidence,expected_guidance", SCENARIOS)
async def test_recommendation_scenarios_end_to_end(
    condition: str,
    confidence: float,
    expected_guidance: GuidanceLevel,
) -> None:
    questionnaire = pick_questionnaire_for_guidance(expected_guidance)
    recommendation_input = make_input(
        assessment_id=f"scenario-{condition}-{expected_guidance.value}",
        condition=condition,
        confidence=confidence,
        questionnaire=questionnaire,
    )

    actual_guidance = decide_guidance(
        recommendation_input.classifier.confidence,
        recommendation_input.questionnaire,
    )
    assert actual_guidance == expected_guidance

    llm_client = MockLLMClient(
        response_text=build_llm_response(expected_guidance, condition)
    )
    result = await generate_recommendation(recommendation_input, llm_client)

    assert result.guidance_level == expected_guidance
    assert result.referral_required is is_referral_required(expected_guidance)

    expected_action_type = (
        "self_care"
        if expected_guidance == GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE
        else "referral"
    )
    assert result.draft.recommended_action.type == expected_action_type