"""Run the guarded routine recommendation path with mock providers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.recommendation.service import generate_recommendation
from app.domain.questionnaire.models import Questionnaire
from app.domain.recommendation.models import (
    GuidanceLevel,
    RecommendationAssessmentContext,
    RecommendationInput,
    SkinContext,
)
from app.domain.safety.models import SafetyResult
from app.infrastructure.llm.client import MockLLMClient


def routine_questionnaire() -> Questionnaire:
    return Questionnaire.model_validate(
        {
            "duration": "one_to_four_weeks",
            "itching": "yes",
            "pain_level": 2,
            "rapidly_spreading": "no",
            "affected_body_area": "face_or_neck",
            "fever": "no",
            "high_fever": "no",
            "swelling": "no",
            "difficulty_breathing": "no",
            "lip_tongue_throat_swelling": "no",
            "bleeding": "no",
            "blistering": "no",
            "open_wound": "no",
            "eye_involvement": "no",
            "possible_infection": "no",
            "previous_treatment": [],
            "known_allergies": [],
            "current_products": [],
            "age_group": "adult",
            "recurrent": "no",
        }
    )


async def main() -> None:
    recommendation_input = RecommendationInput(
        assessment_id="demo-guarded-routine",
        assessment=RecommendationAssessmentContext(
            condition="acne",
            confidence_level="high",
            confidence_score=0.88,
            engine_version="mock-assessment-1",
        ),
        questionnaire=routine_questionnaire(),
        safety=SafetyResult(
            urgency="routine",
            red_flags=[],
            recommendation_permission="allowed",
            policy_version="v1",
            action_message="Continue to educational guidance.",
        ),
        allowed_guidance_level=GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE,
        skin_context=SkinContext(tone_group="melanin_rich"),
    )
    result = await generate_recommendation(recommendation_input, MockLLMClient())
    print(json.dumps(result.model_dump(mode="json"), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
