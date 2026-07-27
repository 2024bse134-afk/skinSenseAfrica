from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, get_args, get_origin

import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.recommendation.service import generate_recommendation
from app.domain.recommendation.models import (
    ClassificationResult,
    Questionnaire,
    RecommendationInput,
    SkinContext,
)
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


def make_questionnaire(**candidate_overrides: Any) -> Questionnaire:
    # Realistic values are set where the model actually defines matching fields.
    overrides: dict[str, Any] = {
        "duration": "3 weeks",
        "itching": True,
        "rapidly_spreading": False,
        "bleeding_or_open_wound": False,
        "eye_involvement": False,
        "fever": False,
        "pain_level": 2,
        "swelling": False,
        "widespread": False,
    }
    overrides.update(candidate_overrides)
    return build_model_instance(Questionnaire, **overrides)


def make_skin_context() -> SkinContext:
    return build_model_instance(
        SkinContext,
        tone_group="melanin_rich",
        skin_tone_group="melanin_rich",
    )


def make_recommendation_input(
    assessment_id: str,
    condition: str,
    confidence: float,
    questionnaire: Questionnaire,
) -> RecommendationInput:
    classifier = build_model_instance(
        ClassificationResult,
        condition=condition,
        confidence=confidence,
        model_version="demo-cv-1",
    )
    return RecommendationInput(
        assessment_id=assessment_id,
        classifier=classifier,
        questionnaire=questionnaire,
        skin_context=make_skin_context(),
    )


def to_pretty_json(value: Any) -> str:
    if hasattr(value, "model_dump"):
        return json.dumps(value.model_dump(mode="json"), indent=2, ensure_ascii=False)
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def pick_emergency_questionnaire() -> Questionnaire:
    fields = set(Questionnaire.model_fields.keys())
    if "bleeding_or_open_wound" in fields:
        return make_questionnaire(bleeding_or_open_wound=True)
    if "eye_involvement" in fields:
        return make_questionnaire(eye_involvement=True)
    if "fever" in fields and "rapidly_spreading" in fields:
        return make_questionnaire(fever=True, rapidly_spreading=True)
    return make_questionnaire(rapidly_spreading=True, pain_level=8)


async def run_example(title: str, recommendation_input: RecommendationInput) -> None:
    result = await generate_recommendation(recommendation_input, MockLLMClient())
    print(f"\n=== {title} ===")
    print(
        f"Condition: {result.condition} | "
        f"Guidance level: {result.guidance_level.value} | "
        f"Referral required: {result.referral_required}"
    )
    print(to_pretty_json(result))


async def main() -> None:
    routine_input = make_recommendation_input(
        assessment_id="demo-acne-routine",
        condition="acne",
        confidence=0.88,
        questionnaire=make_questionnaire(
            duration="3 weeks",
            itching=True,
            rapidly_spreading=False,
        ),
    )

    emergency_input = make_recommendation_input(
        assessment_id="demo-red-flag",
        condition="acne",
        confidence=0.62,
        questionnaire=pick_emergency_questionnaire(),
    )

    await run_example("Routine example", routine_input)
    await run_example("Emergency example", emergency_input)


if __name__ == "__main__":
    asyncio.run(main())