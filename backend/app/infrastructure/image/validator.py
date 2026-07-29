"""Bounded image decoding and metadata-free sanitization."""

from __future__ import annotations

from io import BytesIO
import warnings

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.domain.assessment.models import ValidatedImage


_FORMAT_TO_MIME = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


class ImageValidationError(Exception):
    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


async def _read_bounded(upload: UploadFile, max_bytes: int) -> bytearray:
    data = bytearray()
    while True:
        chunk = await upload.read(min(64 * 1024, max_bytes + 1 - len(data)))
        if not chunk:
            return data
        data.extend(chunk)
        if len(data) > max_bytes:
            data.clear()
            raise ImageValidationError(
                "IMAGE_TOO_LARGE",
                "The image exceeds the allowed size.",
                {"max_bytes": max_bytes},
            )


def _output_format(decoded_format: str) -> tuple[str, str, dict]:
    if decoded_format == "JPEG":
        return "JPEG", "image/jpeg", {"quality": 90, "optimize": True}
    if decoded_format == "PNG":
        return "PNG", "image/png", {"optimize": True}
    return "WEBP", "image/webp", {"quality": 90, "method": 4}


def _encode_image(image: Image.Image, output_format: str, save_options: dict) -> bytes:
    with BytesIO() as output:
        image.save(output, format=output_format, **save_options)
        return output.getvalue()


async def validate_and_sanitize_image(
    upload: UploadFile,
    *,
    max_bytes: int,
    max_pixels: int,
    min_side: int,
) -> ValidatedImage:
    """Decode an allow-listed image and return metadata-free sanitized bytes."""

    original = await _read_bounded(upload, max_bytes)
    declared_mime = (upload.content_type or "").lower().strip()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(original)) as opened:
                decoded_format = (opened.format or "").upper()
                expected_mime = _FORMAT_TO_MIME.get(decoded_format)
                if expected_mime is None:
                    raise ImageValidationError(
                        "INVALID_IMAGE_TYPE",
                        "Only JPEG, PNG, and WebP images are supported.",
                    )
                if declared_mime != expected_mime:
                    raise ImageValidationError(
                        "INVALID_IMAGE_TYPE",
                        "The declared image type does not match the decoded format.",
                    )

                width, height = opened.size
                if width * height > max_pixels:
                    raise ImageValidationError(
                        "IMAGE_TOO_LARGE",
                        "The decoded image dimensions are too large.",
                        {"max_pixels": max_pixels},
                    )
                if min(width, height) < min_side:
                    raise ImageValidationError(
                        "IMAGE_QUALITY_INSUFFICIENT",
                        "The image resolution is too low for assessment.",
                        {"min_image_side": min_side},
                    )

                opened.load()
                output_format, output_mime, save_options = _output_format(decoded_format)
                with ImageOps.exif_transpose(opened) as transposed:
                    if transposed.mode in {"RGBA", "LA"}:
                        with (
                            transposed.convert("RGBA") as rgba,
                            Image.new("RGB", rgba.size, "white") as sanitized_image,
                        ):
                            sanitized_image.paste(rgba, mask=rgba.getchannel("A"))
                            content = _encode_image(
                                sanitized_image, output_format, save_options
                            )
                            sanitized_width, sanitized_height = sanitized_image.size
                    else:
                        with transposed.convert("RGB") as sanitized_image:
                            content = _encode_image(
                                sanitized_image, output_format, save_options
                            )
                            sanitized_width, sanitized_height = sanitized_image.size

                return ValidatedImage(
                    content=content,
                    content_type=output_mime,
                    format=output_format.lower(),
                    width=sanitized_width,
                    height=sanitized_height,
                )
    except ImageValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageValidationError(
            "IMAGE_TOO_LARGE",
            "The decoded image dimensions are too large.",
            {"max_pixels": max_pixels},
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise ImageValidationError(
            "IMAGE_DECODE_FAILED",
            "The uploaded image could not be decoded.",
        ) from exc
    finally:
        original.clear()
