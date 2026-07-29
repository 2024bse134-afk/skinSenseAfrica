from __future__ import annotations

import asyncio
from io import BytesIO
from tempfile import SpooledTemporaryFile

import pytest
from fastapi import UploadFile
from PIL import Image

from app.infrastructure.image.validator import ImageValidationError, validate_and_sanitize_image
from tests.conftest import make_image_bytes


def upload(data: bytes, mime: str = "image/jpeg") -> UploadFile:
    temporary = SpooledTemporaryFile()
    temporary.write(data)
    temporary.seek(0)
    return UploadFile(filename="synthetic", file=temporary, headers={"content-type": mime})


def validate(item: UploadFile, **overrides):
    options = {"max_bytes": 8 * 1024 * 1024, "max_pixels": 20_000_000, "min_side": 320}
    options.update(overrides)
    return asyncio.run(validate_and_sanitize_image(item, **options))


def test_oversized_file_stops_at_configured_limit() -> None:
    with pytest.raises(ImageValidationError) as caught:
        validate(upload(make_image_bytes()), max_bytes=20)
    assert caught.value.code == "IMAGE_TOO_LARGE"


def test_excessive_decoded_pixels_are_rejected() -> None:
    with pytest.raises(ImageValidationError) as caught:
        validate(upload(make_image_bytes(size=(400, 400))), max_pixels=100_000)
    assert caught.value.code == "IMAGE_TOO_LARGE"


def test_exif_is_applied_and_stripped_from_sanitized_output() -> None:
    result = validate(upload(make_image_bytes(include_exif=True)))
    with Image.open(BytesIO(result.content)) as sanitized:
        assert sanitized.size == (400, 400)
        assert len(sanitized.getexif()) == 0
        assert "exif" not in sanitized.info


def test_low_resolution_is_a_quality_error() -> None:
    with pytest.raises(ImageValidationError) as caught:
        validate(upload(make_image_bytes(size=(200, 400))))
    assert caught.value.code == "IMAGE_QUALITY_INSUFFICIENT"
