"""Authoritative condition registry for every assessment engine."""

from enum import Enum


class Condition(str, Enum):
    ECZEMA = "eczema"
    FUNGAL_INFECTION = "fungal_infection"
    SCABIES = "scabies"
    IMPETIGO = "impetigo"
    ACNE = "acne"
    PSORIASIS = "psoriasis"
    FOLLICULITIS = "folliculitis"
    OTHER_OR_UNCERTAIN = "other_or_uncertain"


_LEGACY_CONDITION_MAP = {
    "eczema_dermatitis": Condition.ECZEMA,
    "possible_fungal_infection": Condition.FUNGAL_INFECTION,
    "other_uncertain": Condition.OTHER_OR_UNCERTAIN,
    "hyperpigmentation": Condition.OTHER_OR_UNCERTAIN,
}


def normalize_condition(value: str | Condition) -> tuple[Condition, bool]:
    """Return the normalized condition and whether fallback was required."""

    if isinstance(value, Condition):
        return value, False

    normalized = value.strip().lower()
    if normalized in _LEGACY_CONDITION_MAP:
        condition = _LEGACY_CONDITION_MAP[normalized]
        return condition, condition is Condition.OTHER_OR_UNCERTAIN

    try:
        return Condition(normalized), False
    except ValueError:
        return Condition.OTHER_OR_UNCERTAIN, True
