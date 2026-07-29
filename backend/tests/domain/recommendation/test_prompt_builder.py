from app.domain.recommendation.models import GuidanceLevel
from app.domain.recommendation.prompt_builder import build_messages
from tests.application.recommendation.test_service import recommendation_input


def test_prompt_is_image_free_and_uses_normalized_context(questionnaire) -> None:
    input_data = recommendation_input(questionnaire=questionnaire)
    messages = build_messages(input_data, GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE)
    combined = "\n".join(message["content"] for message in messages)
    assert "Condition label: Acne" in combined
    assert "Permitted guidance level: condition_specific_guidance" in combined
    assert "Controlled visual findings: visible_bumps" in combined
    for forbidden in (
        "image_url",
        "image_path",
        "base64",
        "original_filename",
        input_data.assessment_id,
        input_data.assessment.engine_version,
        str(input_data.assessment.confidence_score),
    ):
        assert forbidden not in combined


def test_prompt_contains_only_structured_questionnaire_values(questionnaire) -> None:
    messages = build_messages(
        recommendation_input(questionnaire=questionnaire),
        GuidanceLevel.CONDITION_SPECIFIC_GUIDANCE,
    )
    user = messages[1]["content"]
    assert "- duration: less_than_one_week" in user
    assert "- eye_involvement: no" in user
    assert "- difficulty_breathing: no" in user
    assert "- lip_tongue_throat_swelling: no" in user
    assert "simple morning/evening routine" in user
