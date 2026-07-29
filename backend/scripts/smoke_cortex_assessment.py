"""Opt-in Cortex image-assessment smoke test.

Use only a synthetic, public-domain, or explicitly consented local image.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import mimetypes
from pathlib import Path
import sys
from tempfile import SpooledTemporaryFile

from fastapi import UploadFile

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.application.assessment.service import assess_validated_image
from app.application.assessment.ports import AssessmentProviderError
from app.infrastructure.assessment.factory import build_image_assessment_provider
from app.infrastructure.image.validator import (
    ImageValidationError,
    validate_and_sanitize_image,
)
from app.settings import settings


async def run(image_path: Path) -> None:
    if settings.image_assessment_provider != "cortex":
        raise SystemExit("Set IMAGE_ASSESSMENT_PROVIDER=cortex to enable this smoke test.")
    if not settings.cortex_api_key:
        raise SystemExit("Set CORTEX_API_KEY to enable this smoke test.")
    if not settings.cortex_base_url or not settings.cortex_image_model:
        raise SystemExit("Set CORTEX_BASE_URL and CORTEX_IMAGE_MODEL.")
    if not image_path.is_file():
        raise SystemExit("The smoke-test image could not be opened.")

    content_type, _ = mimetypes.guess_type(image_path.name)
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise SystemExit("The smoke-test image must be JPEG, PNG, or WebP.")

    if image_path.stat().st_size > settings.image_assessment_max_bytes:
        raise SystemExit("The smoke-test image exceeds the application byte limit.")

    source_bytes = bytearray(image_path.read_bytes())
    temporary = SpooledTemporaryFile()
    temporary.write(source_bytes)
    temporary.seek(0)
    source_bytes.clear()
    upload = UploadFile(
        filename="smoke-test-image",
        file=temporary,
        headers={"content-type": content_type},
    )
    try:
        image = await validate_and_sanitize_image(
            upload,
            max_bytes=settings.image_assessment_max_bytes,
            max_pixels=settings.image_assessment_max_pixels,
            min_side=settings.image_assessment_min_side,
        )
        provider = build_image_assessment_provider(settings)
        result = await assess_validated_image(
            image,
            provider,
            prompt_version=settings.image_assessment_prompt_version,
            deadline_seconds=settings.image_assessment_timeout_seconds,
        )
    finally:
        await upload.close()

    print(
        json.dumps(
            {
                "condition": result.condition.value,
                "confidence_level": result.confidence_level.value,
                "image_quality": result.image_quality.model_dump(mode="json"),
                "visual_findings": [
                    finding.value for finding in result.visual_findings
                ],
                "follow_up_question_ids": [
                    question.value for question in result.follow_up_question_ids
                ],
                "visual_safety_signals": [
                    signal.value for signal in result.visual_safety_signals
                ],
                "engine": result.assessment_engine.value,
                "engine_version": result.engine_version,
                "prompt_version": result.prompt_version,
                "schema_version": settings.image_assessment_schema_version,
                "inference_ms": result.inference_ms,
            },
            indent=2,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run an opt-in guarded Cortex assessment of one local image."
    )
    parser.add_argument(
        "image",
        type=Path,
        help="Synthetic, public-domain, or explicitly consented JPEG/PNG/WebP.",
    )
    args = parser.parse_args()
    try:
        asyncio.run(run(args.image))
    except (AssessmentProviderError, ImageValidationError) as exc:
        raise SystemExit(f"Smoke test failed safely: {exc}") from None


if __name__ == "__main__":
    main()
