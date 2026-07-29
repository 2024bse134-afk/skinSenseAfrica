"""Strict structured symptom and safety questionnaire."""

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Answer(str, Enum):
    YES = "yes"
    NO = "no"
    UNSURE = "unsure"


class DurationBand(str, Enum):
    LESS_THAN_ONE_WEEK = "less_than_one_week"
    ONE_TO_FOUR_WEEKS = "one_to_four_weeks"
    ONE_TO_SIX_MONTHS = "one_to_six_months"
    MORE_THAN_SIX_MONTHS = "more_than_six_months"
    UNSURE = "unsure"


class AffectedBodyArea(str, Enum):
    FACE_OR_NECK = "face_or_neck"
    SCALP = "scalp"
    CHEST_OR_BACK = "chest_or_back"
    ARMS_OR_HANDS = "arms_or_hands"
    LEGS_OR_FEET = "legs_or_feet"
    GROIN_OR_SKIN_FOLDS = "groin_or_skin_folds"
    OTHER = "other"
    UNSURE = "unsure"


class AgeGroup(str, Enum):
    INFANT = "infant"
    CHILD = "child"
    ADOLESCENT = "adolescent"
    ADULT = "adult"
    OLDER_ADULT = "older_adult"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


BoundedItem = Annotated[str, Field(min_length=1, max_length=100)]


class Questionnaire(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    duration: DurationBand
    itching: Answer
    pain_level: int = Field(ge=0, le=10)
    rapidly_spreading: Answer
    affected_body_area: AffectedBodyArea
    fever: Answer
    high_fever: Answer
    swelling: Answer
    difficulty_breathing: Answer
    lip_tongue_throat_swelling: Answer
    bleeding: Answer
    blistering: Answer
    open_wound: Answer
    eye_involvement: Answer
    possible_infection: Answer
    previous_treatment: list[BoundedItem] = Field(default_factory=list, max_length=10)
    known_allergies: list[BoundedItem] = Field(default_factory=list, max_length=10)
    current_products: list[BoundedItem] = Field(default_factory=list, max_length=10)
    age_group: AgeGroup
    recurrent: Answer

    @field_validator("previous_treatment", "known_allergies", "current_products")
    @classmethod
    def require_unique_items(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values]
        if len(set(value.casefold() for value in normalized)) != len(normalized):
            raise ValueError("list items must be unique")
        return normalized
