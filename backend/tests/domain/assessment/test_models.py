import pytest
from pydantic import ValidationError

from app.domain.assessment.conditions import Condition, normalize_condition
from app.domain.assessment.models import ImageAssessmentResult, ImageQuality, ProviderAssessmentDraft
from app.domain.questionnaire.models import Questionnaire
from tests.conftest import make_assessment_result


def test_authoritative_condition_registry_is_exact() -> None:
    assert {value.value for value in Condition} == {
        "eczema",
        "fungal_infection",
        "scabies",
        "impetigo",
        "acne",
        "psoriasis",
        "folliculitis",
        "other_or_uncertain",
    }


def test_legacy_and_unknown_condition_normalization() -> None:
    assert normalize_condition("eczema_dermatitis") == (Condition.ECZEMA, False)
    assert normalize_condition("provider-only") == (Condition.OTHER_OR_UNCERTAIN, True)


def test_quality_cross_field_validation() -> None:
    with pytest.raises(ValidationError):
        ImageQuality.model_validate({"status": "acceptable", "issues": ["blurred"]})
    with pytest.raises(ValidationError):
        ImageQuality.model_validate({"status": "retake_required", "issues": []})


def test_models_forbid_extra_and_unrestricted_findings() -> None:
    data = make_assessment_result().model_dump(mode="json")
    data["provider_narrative"] = "unrestricted"
    with pytest.raises(ValidationError):
        ImageAssessmentResult.model_validate(data)

    draft = {
        "condition": "acne",
        "confidence_level": "high",
        "image_quality": {"status": "acceptable", "issues": []},
        "needs_more_information": True,
        "visual_findings": ["provider wrote arbitrary prose"],
    }
    with pytest.raises(ValidationError):
        ProviderAssessmentDraft.model_validate(draft)


def test_questionnaire_is_strict_and_bounded(questionnaire_payload) -> None:
    invalid = {**questionnaire_payload, "pain_level": 11}
    with pytest.raises(ValidationError):
        Questionnaire.model_validate(invalid)
    invalid = {**questionnaire_payload, "eye_involvement": None}
    with pytest.raises(ValidationError):
        Questionnaire.model_validate(invalid)
    invalid = {**questionnaire_payload, "unrestricted_chat": "hello"}
    with pytest.raises(ValidationError):
        Questionnaire.model_validate(invalid)
