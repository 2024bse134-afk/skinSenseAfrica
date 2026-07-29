"""Opt-in end-to-end Cortex assessment and recommendation smoke test.

The questionnaire is explicitly synthetic and must not be interpreted as
medical history belonging to the person pictured in the test image.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
from pathlib import Path
import sys

import httpx2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app
from app.settings import settings


SYNTHETIC_ROUTINE_QUESTIONNAIRE = {
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


def _require_success(response: httpx2.Response, stage: str) -> dict:
    payload = response.json()
    if response.is_error:
        error = payload.get("error", {})
        code = error.get("code", "UNKNOWN_ERROR")
        message = error.get("message", "The request failed.")
        raise SystemExit(f"{stage} failed safely: {code}: {message}")
    return payload


async def run(image_path: Path) -> None:
    if settings.image_assessment_provider != "cortex":
        raise SystemExit("Set IMAGE_ASSESSMENT_PROVIDER=cortex.")
    if settings.llm_provider != "cortex":
        raise SystemExit("Set LLM_PROVIDER=cortex.")
    if not settings.cortex_api_key or not settings.llm_api_key:
        raise SystemExit("Configure both server-side Cortex credentials.")
    if not image_path.is_file():
        raise SystemExit("The smoke-test image could not be opened.")
    if image_path.stat().st_size > settings.image_assessment_max_bytes:
        raise SystemExit("The smoke-test image exceeds the application byte limit.")

    content_type, _ = mimetypes.guess_type(image_path.name)
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise SystemExit("The smoke-test image must be JPEG, PNG, or WebP.")

    transport = httpx2.ASGITransport(app=app)
    async with httpx2.AsyncClient(
        transport=transport,
        base_url="http://testserver",
        timeout=None,
    ) as client:
        created = _require_success(
            await client.post("/v1/assessments", json={}),
            "create assessment",
        )
        assessment_id = created["id"]

        assessment = _require_success(
            await client.post(
                f"/v1/assessments/{assessment_id}/image-assessment",
                files={
                    "image": (
                        "approved-test-image",
                        image_path.read_bytes(),
                        content_type,
                    )
                },
            ),
            "image assessment",
        )

        questionnaire = _require_success(
            await client.put(
                f"/v1/assessments/{assessment_id}/questionnaire",
                json=SYNTHETIC_ROUTINE_QUESTIONNAIRE,
            ),
            "questionnaire and safety",
        )

        safety = questionnaire["safety"]
        recommendation = None
        if safety["recommendation_permission"] != "blocked":
            recommendation = _require_success(
                await client.post(
                    f"/v1/assessments/{assessment_id}/recommendation",
                    json={},
                ),
                "recommendation",
            )

    print(
        json.dumps(
            {
                "test_context": {
                    "questionnaire_profile": "synthetic_routine_no_red_flags",
                    "not_person_specific_medical_history": True,
                },
                "assessment": assessment,
                "safety": safety,
                "recommendation": recommendation,
            },
            indent=2,
            ensure_ascii=False,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the complete guarded Cortex cycle with synthetic answers."
    )
    parser.add_argument(
        "image",
        type=Path,
        help="Synthetic, public-domain, or explicitly consented JPEG/PNG/WebP.",
    )
    parser.add_argument(
        "--use-synthetic-routine-questionnaire",
        action="store_true",
        help="Confirm use of the built-in non-person-specific test answers.",
    )
    args = parser.parse_args()
    if not args.use_synthetic_routine_questionnaire:
        raise SystemExit(
            "Pass --use-synthetic-routine-questionnaire to acknowledge test answers."
        )
    asyncio.run(run(args.image))


if __name__ == "__main__":
    main()
