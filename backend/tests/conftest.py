from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from app.domain.assessment.models import ImageAssessmentResult
from app.domain.questionnaire.models import Questionnaire


def make_image_bytes(
    image_format: str = "JPEG",
    *,
    size: tuple[int, int] = (400, 400),
    include_exif: bool = False,
) -> bytes:
    image = Image.new("RGB", size, (128, 72, 56))
    output = BytesIO()
    options: dict = {}
    if include_exif and image_format == "JPEG":
        exif = Image.Exif()
        exif[274] = 6
        exif[270] = "synthetic metadata that must be stripped"
        options["exif"] = exif
    image.save(output, format=image_format, **options)
    image.close()
    return output.getvalue()


def make_assessment_result(**overrides) -> ImageAssessmentResult:
    data = {
        "assessment_status": "completed",
        "condition": "acne",
        "confidence_level": "high",
        "confidence_score": 0.88,
        "visual_findings": ["visible_bumps"],
        "alternative_conditions": [],
        "image_quality": {"status": "acceptable", "issues": []},
        "needs_more_information": True,
        "follow_up_question_ids": ["duration"],
        "visual_safety_signals": [],
        "recommendation_status": "pending_questionnaire",
        "assessment_engine": "mock",
        "engine_version": "mock-assessment-1",
        "prompt_version": "image-assessment-v1",
        "limitations": [
            "This is a preliminary AI-assisted assessment.",
            "This is not a confirmed diagnosis.",
        ],
        "assessed_at": "2026-07-29T12:00:00Z",
        "inference_ms": 1,
    }
    data.update(overrides)
    return ImageAssessmentResult.model_validate(data)


@pytest.fixture
def questionnaire_payload() -> dict:
    return {
        "duration": "less_than_one_week",
        "itching": "no",
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


@pytest.fixture
def questionnaire(questionnaire_payload: dict) -> Questionnaire:
    return Questionnaire.model_validate(questionnaire_payload)
