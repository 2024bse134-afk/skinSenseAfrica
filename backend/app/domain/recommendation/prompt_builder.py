"""Domain prompt builder for recommendation generation.

Single responsibility: construct provider-agnostic prompt messages from validated domain input.
Layering rule: domain code must not import databases, HTTP clients, or provider-specific SDKs.
"""

from __future__ import annotations

from app.domain.recommendation.models import GuidanceLevel, RecommendationInput

PROMPT_VERSION = "recommendation-v2"
SYSTEM_PROMPT_V1 = """You are the recommendation and explanation component of SkinSense Africa, an AI-engineering educational showcase. A separate multimodal engine produced a preliminary condition label and controlled visual findings. Do not inspect an image, independently diagnose, contradict, or replace that label. Explain why the supplied findings may support the preliminary label, acknowledge supplied alternatives, and connect questionnaire context without inventing history. Make routine guidance engaging and practical: use plain language, useful product categories such as gentle cleanser, fragrance-free moisturizer, or broad-spectrum sunscreen when relevant, and a simple morning/evening structure. Never name a brand, prescribe medication, give dosage or treatment duration, claim confirmation, or imply that a product cures a condition. For professional_review, prioritize review while allowing low-risk comfort, avoidance, and product-category guidance. For urgent_referral, prioritize immediate escalation and provide no routine, product, or treatment steps. Return JSON matching the supplied schema exactly."""


_CONDITION_DISPLAY_LABELS = {
    "acne": "Acne",
    "eczema": "Eczema",
    "fungal_infection": "Possible fungal infection",
    "scabies": "Possible scabies",
    "impetigo": "Possible impetigo",
    "psoriasis": "Possible psoriasis",
    "folliculitis": "Possible folliculitis",
    "other_or_uncertain": "Other / uncertain",
}


def _format_questionnaire(input_data: RecommendationInput) -> list[str]:
    q = input_data.questionnaire
    lines: list[str] = []

    field_order = [
        ("duration", q.duration),
        ("itching", q.itching),
        ("pain_level", q.pain_level),
        ("rapidly_spreading", q.rapidly_spreading),
        ("affected_body_area", q.affected_body_area),
        ("fever", q.fever),
        ("high_fever", q.high_fever),
        ("swelling", q.swelling),
        ("difficulty_breathing", q.difficulty_breathing),
        ("lip_tongue_throat_swelling", q.lip_tongue_throat_swelling),
        ("bleeding", q.bleeding),
        ("blistering", q.blistering),
        ("open_wound", q.open_wound),
        ("eye_involvement", q.eye_involvement),
        ("possible_infection", q.possible_infection),
        ("previous_treatment", q.previous_treatment),
        ("known_allergies", q.known_allergies),
        ("current_products", q.current_products),
        ("age_group", q.age_group),
        ("recurrent", q.recurrent),
    ]

    for key, value in field_order:
        if isinstance(value, list) and len(value) == 0:
            continue
        rendered = value.value if hasattr(value, "value") else value
        lines.append(f"- {key}: {rendered}")

    return lines


def build_user_message(input: RecommendationInput, guidance_level: GuidanceLevel) -> str:
    """Build the user prompt content for RecommendationDraft generation only."""

    condition_value = input.assessment.condition.value
    condition_label = _CONDITION_DISPLAY_LABELS.get(condition_value, condition_value)

    lines: list[str] = [
        "Generate recommendation draft content only.",
        f"Condition label: {condition_label}",
        (
            "Controlled visual findings: "
            + (
                ", ".join(finding.value for finding in input.assessment.visual_findings)
                if input.assessment.visual_findings
                else "none supplied"
            )
        ),
        (
            "Alternative conditions considered: "
            + (
                ", ".join(
                    _CONDITION_DISPLAY_LABELS.get(condition.value, condition.value)
                    for condition in input.assessment.alternative_conditions
                )
                if input.assessment.alternative_conditions
                else "none supplied"
            )
        ),
        f"More information requested by assessment engine: {input.assessment.needs_more_information}",
        (
            f"Permitted guidance level: {guidance_level.value}. "
            "Do not exceed this level of specificity."
        ),
    ]

    if guidance_level is GuidanceLevel.URGENT_REFERRAL:
        lines.append(
            "Urgent priority: explain the warning context, set recommended_action.type "
            "to referral, leave recommended_action.steps empty, and omit routine "
            "products, prevention routines, medications, and treatment advice."
        )
    elif guidance_level is GuidanceLevel.PROFESSIONAL_REVIEW:
        lines.append(
            "Review priority: clearly recommend professional review and explain why. "
            "You may include cautious non-treatment comfort measures, things to avoid, "
            "and gentle product categories while review is arranged."
        )
    else:
        lines.append(
            "Showcase guidance: make the explanation traceable to the controlled visual "
            "findings and answers. Provide 4 to 6 concise action steps, including a "
            "simple morning/evening routine when appropriate. Suggest categories and "
            "qualities of products, never brands or prescription medicines."
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
