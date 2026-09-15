"""Cortex Gemini-compatible guarded multimodal assessment provider."""

from __future__ import annotations

import asyncio
import base64
import json
import socket
import urllib.error
import urllib.request
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlsplit

from pydantic import ValidationError

from app.application.assessment.ports import (
    AssessmentProviderOutputInvalid,
    AssessmentProviderTimeout,
    AssessmentProviderUnavailable,
)
from app.domain.assessment.conditions import Condition
from app.domain.assessment.models import (
    AssessmentEngine,
    ConfidenceLevel,
    FollowUpQuestionId,
    ImageQualityIssue,
    ImageQualityStatus,
    ProviderAssessmentDraft,
    ValidatedImage,
    VisualFinding,
    VisualSafetySignal,
)
from app.infrastructure.assessment.prompt import build_guarded_assessment_prompt


CORTEX_INLINE_REQUEST_LIMIT_BYTES = 20 * 1024 * 1024
SUPPORTED_IMAGE_MIME_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
RETRYABLE_HTTP_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

RunSync = Callable[..., Awaitable[Any]]


def _enum_schema(enum_type: type) -> dict[str, Any]:
    return {"type": "string", "enum": [item.value for item in enum_type]}


def build_provider_response_schema() -> dict[str, Any]:
    """Build the Cortex-compatible schema from the authoritative domain enums."""

    properties: dict[str, Any] = {
        "condition": _enum_schema(Condition),
        "confidence_level": _enum_schema(ConfidenceLevel),
        "confidence_score": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 1.0,
            "nullable": True,
        },
        "visual_findings": {
            "type": "array",
            "items": _enum_schema(VisualFinding),
            "maxItems": 8,
        },
        "alternative_conditions": {
            "type": "array",
            "items": _enum_schema(Condition),
            "maxItems": 3,
        },
        "image_quality": {
            "type": "object",
            "properties": {
                "status": _enum_schema(ImageQualityStatus),
                "issues": {
                    "type": "array",
                    "items": _enum_schema(ImageQualityIssue),
                    "maxItems": 6,
                },
            },
            "required": ["status", "issues"],
            "additionalProperties": False,
        },
        "needs_more_information": {"type": "boolean"},
        "follow_up_question_ids": {
            "type": "array",
            "items": _enum_schema(FollowUpQuestionId),
            "maxItems": 12,
        },
        "visual_safety_signals": {
            "type": "array",
            "items": _enum_schema(VisualSafetySignal),
            "maxItems": 6,
        },
    }
    model_fields = set(ProviderAssessmentDraft.model_fields)
    if set(properties) != model_fields:
        raise RuntimeError("Cortex response schema is out of sync with ProviderAssessmentDraft")
    return {
        "type": "object",
        "properties": properties,
        "required": list(ProviderAssessmentDraft.model_fields),
        "additionalProperties": False,
    }


PROVIDER_ASSESSMENT_RESPONSE_SCHEMA = build_provider_response_schema()


class CortexMultimodalAssessmentProvider:
    """Send a sanitized image to Cortex and return only a strict provider draft."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        schema_version: str,
        max_retries: int = 1,
        max_output_tokens: int = 800,
        temperature: float = 0.1,
        retry_delay_seconds: float = 0.1,
        run_sync: RunSync = asyncio.to_thread,
    ) -> None:
        if not api_key:
            raise AssessmentProviderUnavailable("Cortex image assessment is not configured")
        parsed_base_url = urlsplit(base_url.strip())
        if (
            parsed_base_url.scheme not in {"http", "https"}
            or not parsed_base_url.netloc
            or parsed_base_url.username is not None
            or parsed_base_url.password is not None
            or parsed_base_url.query
            or parsed_base_url.fragment
        ):
            raise AssessmentProviderUnavailable("Cortex image assessment is not configured")
        allowed_model_characters = (
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-"
        )
        if not model or any(
            character not in allowed_model_characters for character in model
        ):
            raise AssessmentProviderUnavailable("Cortex image assessment model is invalid")
        if schema_version != "v1":
            raise AssessmentProviderUnavailable("Cortex image assessment schema is unsupported")
        if max_retries not in {0, 1, 2, 3}:
            raise AssessmentProviderUnavailable("Cortex retry configuration is invalid")
        if not 1 <= max_output_tokens <= 4096:
            raise AssessmentProviderUnavailable("Cortex output-token configuration is invalid")
        if not 0.0 <= temperature <= 1.0:
            raise AssessmentProviderUnavailable("Cortex temperature configuration is invalid")

        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._schema_version = schema_version
        self._max_retries = max_retries
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature
        self._retry_delay_seconds = max(0.0, retry_delay_seconds)
        self._run_sync = run_sync

    @property
    def engine(self) -> AssessmentEngine:
        return AssessmentEngine.MULTIMODAL_LLM_PROTOTYPE

    @property
    def engine_version(self) -> str:
        return f"cortex:{self._model}"

    @property
    def endpoint(self) -> str:
        return f"{self._base_url}/v1/models/{self._model}:generateContent"

    async def assess(
        self,
        image: ValidatedImage,
        *,
        prompt_version: str,
        deadline_seconds: float,
    ) -> ProviderAssessmentDraft:
        if image.content_type not in SUPPORTED_IMAGE_MIME_TYPES:
            raise AssessmentProviderOutputInvalid(
                "sanitized image has an unsupported media type"
            )

        try:
            prompt = build_guarded_assessment_prompt(
                prompt_version=prompt_version,
                schema_version=self._schema_version,
            )
        except ValueError as exc:
            raise AssessmentProviderOutputInvalid(
                "image assessment prompt configuration is invalid"
            ) from exc

        payload = self._build_payload(
            prompt=prompt,
            image=image,
        )
        attempt_timeout_seconds = deadline_seconds / (self._max_retries + 1)
        try:
            try:
                draft = await asyncio.wait_for(
                    self._execute_and_parse_with_retries(
                        payload,
                        attempt_timeout_seconds=attempt_timeout_seconds,
                    ),
                    timeout=deadline_seconds,
                )
                return draft
            except TimeoutError as exc:
                raise AssessmentProviderTimeout(
                    "Cortex image assessment timed out"
                ) from exc
        finally:
            payload = {}

    def _build_payload(
        self,
        *,
        prompt: str,
        image: ValidatedImage,
    ) -> dict[str, Any]:
        encoded_bytes = base64.b64encode(image.content)
        if len(encoded_bytes) > CORTEX_INLINE_REQUEST_LIMIT_BYTES:
            raise AssessmentProviderOutputInvalid(
                "sanitized image exceeds the Cortex inline request limit"
            )
        try:
            encoded_image = encoded_bytes.decode("ascii")
            return {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": image.content_type,
                                    "data": encoded_image,
                                }
                            },
                        ],
                    }
                ],
                "generationConfig": {
                    "temperature": self._temperature,
                    "maxOutputTokens": self._max_output_tokens,
                    "responseMimeType": "application/json",
                    "responseSchema": PROVIDER_ASSESSMENT_RESPONSE_SCHEMA,
                },
            }
        finally:
            encoded_bytes = b""

    async def _execute_and_parse_with_retries(
        self,
        payload: dict[str, Any],
        *,
        attempt_timeout_seconds: float,
    ) -> ProviderAssessmentDraft:
        for attempt in range(self._max_retries + 1):
            try:
                response_text = await self._run_sync(
                    self._execute_request,
                    payload,
                    attempt_timeout_seconds,
                )
                return self._parse_response(response_text)
            except urllib.error.HTTPError as exc:
                if (
                    exc.code in RETRYABLE_HTTP_STATUS_CODES
                    and attempt < self._max_retries
                ):
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue
                if exc.code in {400, 405, 409, 422}:
                    raise AssessmentProviderOutputInvalid(
                        "Cortex rejected the assessment request"
                    ) from exc
                raise AssessmentProviderUnavailable(
                    "Cortex image assessment is unavailable"
                ) from exc
            except (TimeoutError, socket.timeout) as exc:
                if attempt < self._max_retries:
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue
                raise AssessmentProviderTimeout(
                    "Cortex image assessment timed out"
                ) from exc
            except urllib.error.URLError as exc:
                if isinstance(exc.reason, (TimeoutError, socket.timeout)):
                    if attempt < self._max_retries:
                        await asyncio.sleep(self._retry_delay_seconds)
                        continue
                    raise AssessmentProviderTimeout(
                        "Cortex image assessment timed out"
                    ) from exc
                if attempt < self._max_retries:
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue
                raise AssessmentProviderUnavailable(
                    "Cortex image assessment is unavailable"
                ) from exc
            except ConnectionError as exc:
                if attempt < self._max_retries:
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue
                raise AssessmentProviderUnavailable(
                    "Cortex image assessment is unavailable"
                ) from exc
            except AssessmentProviderOutputInvalid:
                if attempt < self._max_retries:
                    await asyncio.sleep(self._retry_delay_seconds)
                    continue
                raise

        raise AssessmentProviderUnavailable("Cortex image assessment is unavailable")

    def _execute_request(
        self,
        payload: dict[str, Any],
        timeout_seconds: float,
    ) -> str:
        request = urllib.request.Request(
            url=self.endpoint,
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-api-key": self._api_key,
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            status = response.getcode()
            if status < 200 or status >= 300:
                raise urllib.error.HTTPError(
                    self.endpoint,
                    status,
                    "Cortex request failed",
                    response.headers,
                    None,
                )
            return response.read().decode("utf-8")

    @staticmethod
    def _parse_response(response_text: str) -> ProviderAssessmentDraft:
        try:
            envelope = json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise AssessmentProviderOutputInvalid(
                "Cortex returned an invalid response envelope"
            ) from exc

        try:
            candidates = envelope["candidates"]
            if not isinstance(candidates, list) or len(candidates) != 1:
                raise TypeError
            candidate = candidates[0]
            finish_reason = candidate.get("finishReason")
            if finish_reason not in {None, "STOP"}:
                safe_finish_reasons = {
                    "MAX_TOKENS",
                    "SAFETY",
                    "RECITATION",
                    "BLOCKLIST",
                    "PROHIBITED_CONTENT",
                    "SPII",
                    "OTHER",
                }
                reported_reason = (
                    finish_reason
                    if finish_reason in safe_finish_reasons
                    else "UNRECOGNIZED"
                )
                raise AssessmentProviderOutputInvalid(
                    f"Cortex assessment output was incomplete ({reported_reason})"
                )
            parts = candidate["content"]["parts"]
            if not isinstance(parts, list) or len(parts) != 1:
                raise TypeError
            text = parts[0]["text"]
            if not isinstance(text, str) or not text.strip():
                raise TypeError
        except AssessmentProviderOutputInvalid:
            raise
        except (KeyError, IndexError, TypeError) as exc:
            raise AssessmentProviderOutputInvalid(
                "Cortex response is missing one JSON text candidate"
            ) from exc

        candidate_text = text.strip()
        if "```" in candidate_text:
            raise AssessmentProviderOutputInvalid(
                "Cortex returned markdown instead of plain JSON"
            )
        try:
            candidate_json = json.loads(candidate_text)
        except json.JSONDecodeError as exc:
            raise AssessmentProviderOutputInvalid(
                "Cortex returned malformed assessment JSON"
            ) from exc
        if not isinstance(candidate_json, dict):
            raise AssessmentProviderOutputInvalid(
                "Cortex assessment JSON must be an object"
            )
        try:
            return ProviderAssessmentDraft.model_validate(candidate_json)
        except ValidationError as exc:
            raise AssessmentProviderOutputInvalid(
                "Cortex assessment JSON failed schema validation"
            ) from exc
