"""Domain prompt builder for recommendation generation.

Single responsibility: construct provider-agnostic prompt messages from validated domain input.
Layering rule: domain code must not import databases, HTTP clients, or provider-specific SDKs.
"""

from __future__ import annotations

from app.domain.recommendation.models import GuidanceLevel, RecommendationInput

PROMPT_VERSION = "v1"
SYSTEM_PROMPT_V1 = """You are the controlled recommendation component of SkinSense Africa, an educational AI-assisted skin screening prototype.  A separate computer-vision model has already produced the condition label. Do not inspect an image, independently diagnose, contradict, or replace that label.  Your permitted tasks are: 1. Explain the supplied condition in plain language. 2. List common contributing factors without claiming they apply to the user. 3. Give considerations relevant to melanin-rich skin when appropriate. 4. Provide only the level of guidance permitted by the backend. 5. List prevention practices and warning signs. 6. Return JSON matching the supplied schema.  Never claim confirmation, prescribe medication, give a dosage, invent medical history, recommend an unapproved brand, or ignore the permitted guidance level. When the permitted level is professional_review or urgent_referral, prioritize referral and do not provide routine treatment instructions."""


_CONDITION_DISPLAY_LABELS = {
    "acne": "Acne",
    "eczema_dermatitis": "Eczema / Dermatitis",
    "hyperpigmentation": "Hyperpigmentation",
    "possible_fungal_infection": "Possible fungal infection",
    "other_uncertain": "Other / uncertain",
}


def _format_questionnaire(input_data: RecommendationInput) -> list[str]:
    q = input_data.questionnaire
    lines: list[str] = []

    field_order = [
        ("duration", q.duration),
        ("itching", q.itching),
        ("pain_level", q.pain_level),
        ("rapidly_spreading", q.rapidly_spreading),
        ("affected_area", q.affected_area),
        ("fever", q.fever),
        ("swelling", q.swelling),
        ("bleeding_or_open_wound", q.bleeding_or_open_wound),
        ("eye_involvement", q.eye_involvement),
        ("previous_treatments", q.previous_treatments),
        ("known_allergies", q.known_allergies),
        ("current_products", q.current_products),
    ]

    for key, value in field_order:
        if value is None:
            continue
        if isinstance(value, list) and len(value) == 0:
            continue
        lines.append(f"- {key}: {value}")

    return lines


def build_user_message(input: RecommendationInput, guidance_level: GuidanceLevel) -> str:
    """Build the user prompt content for RecommendationDraft generation only."""

    condition_value = input.classifier.condition.value
    condition_label = _CONDITION_DISPLAY_LABELS.get(condition_value, condition_value)

    lines: list[str] = [
        "Generate recommendation draft content only.",
        f"Condition label: {condition_label}",
        (
            f"Permitted guidance level: {guidance_level.value}. "
            "Do not exceed this level of specificity or provide routine treatment "
            "instructions if the level is professional_review or urgent_referral."
        ),
    ]

    if guidance_level in {
        GuidanceLevel.URGENT_REFERRAL,
        GuidanceLevel.PROFESSIONAL_REVIEW,
    }:
        lines.append(
            "Referral priority instruction: prioritize referral language and omit routine self-care steps."
        )

    lines.append(f"Skin context tone_group: {input.skin_context.tone_group}")

    questionnaire_lines = _format_questionnaire(input)
    if questionnaire_lines:
        lines.append("Questionnaire context (only provided values):")
        lines.extend(questionnaire_lines)

    lines.extend(
        [
            "Return JSON only, matching RecommendationDraft fields exactly:",
            "- explanation",
            "- possible_contributing_factors",
            "- skin_tone_considerations",
            "- recommended_action",
            "- prevention",
            "- warning_signs",
            "- limitations",
            "For recommended_action include fields: type, urgency, steps, referral_reason.",
        ]
    )

    return "\n".join(lines)


def build_messages(input: RecommendationInput, guidance_level: GuidanceLevel) -> list[dict[str, str]]:
    """Build provider-agnostic system and user messages for LLM invocation."""

    return [
        {"role": "system", "content": SYSTEM_PROMPT_V1},
        {"role": "user", "content": build_user_message(input=input, guidance_level=guidance_level)},
    ]
