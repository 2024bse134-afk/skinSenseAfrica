from __future__ import annotations

import asyncio
import base64
from copy import deepcopy
from io import BytesIO
import json
import logging
from tempfile import SpooledTemporaryFile
import urllib.error
import urllib.request

import pytest
from fastapi import UploadFile

from app.api.repository import InMemoryAssessmentRepository
from app.application.assessment.ports import (
    AssessmentProviderOutputInvalid,
    AssessmentProviderTimeout,
    AssessmentProviderUnavailable,
)
from app.domain.assessment.models import AssessmentEngine, ValidatedImage
from app.infrastructure.assessment import cortex as cortex_module
from app.infrastructure.assessment.cortex import (
    CortexMultimodalAssessmentProvider,
    PROVIDER_ASSESSMENT_RESPONSE_SCHEMA,
)
from app.infrastructure.assessment.factory import build_image_assessment_provider
from app.infrastructure.assessment.mock import MockImageAssessmentProvider
from app.infrastructure.image.validator import validate_and_sanitize_image
from app.main import app
from app.settings import Settings
from tests.conftest import make_assessment_result, make_image_bytes


API_KEY = "private-cortex-test-key"
BASE_URL = "https://gateway.example.test"
MODEL = "gemini-2.5-flash"


async def run_inline(function, *args):
    return function(*args)


def valid_draft(**updates) -> dict:
    draft = {
        "condition": "acne",
        "confidence_level": "high",
        "confidence_score": 0.88,
        "visual_findings": ["visible_bumps"],
        "alternative_conditions": [],
        "image_quality": {"status": "acceptable", "issues": []},
        "needs_more_information": True,
        "follow_up_question_ids": ["duration", "itching"],
        "visual_safety_signals": [],
    }
    draft.update(updates)
    return draft


def envelope(candidate: dict | str | None = None) -> str:
    if candidate is None:
        candidate = valid_draft()
    text = candidate if isinstance(candidate, str) else json.dumps(candidate)
    return json.dumps(
        {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    )


def image(content_type: str = "image/jpeg", content: bytes = b"sanitized-image") -> ValidatedImage:
    return ValidatedImage(
        content=content,
        content_type=content_type,
        format=content_type.removeprefix("image/"),
        width=400,
        height=400,
    )


def provider(*, max_retries: int = 1) -> CortexMultimodalAssessmentProvider:
    return CortexMultimodalAssessmentProvider(
        api_key=API_KEY,
        base_url=BASE_URL,
        model=MODEL,
        schema_version="v1",
        max_retries=max_retries,
        max_output_tokens=800,
        temperature=0.1,
        retry_delay_seconds=0,
        run_sync=run_inline,
    )


def assess(
    item: CortexMultimodalAssessmentProvider,
    validated_image: ValidatedImage | None = None,
):
    return asyncio.run(
        item.assess(
            validated_image or image(),
            prompt_version="image-assessment-v1",
            deadline_seconds=20,
        )
    )


def capture_payload(
    item: CortexMultimodalAssessmentProvider,
    *,
    result: str | None = None,
) -> list[dict]:
    calls: list[dict] = []

    def execute(payload: dict, timeout_seconds: float) -> str:
        assert timeout_seconds == 10
        calls.append(deepcopy(payload))
        return result or envelope()

    item._execute_request = execute  # type: ignore[method-assign]
    return calls


class FakeHTTPResponse:
    headers: dict = {}

    def __init__(self, body: str = "{}") -> None:
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def getcode(self) -> int:
        return 200

    def read(self) -> bytes:
        return self.body.encode()


def test_endpoint_headers_and_api_key_location(monkeypatch) -> None:
    captured: dict = {}

    def fake_urlopen(request: urllib.request.Request, timeout: float):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeHTTPResponse()

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    item = provider()
    assert item._execute_request({"safe": True}, 7) == "{}"

    request = captured["request"]
    headers = {name.lower(): value for name, value in request.header_items()}
    assert request.full_url == (
        f"{BASE_URL}/v1/models/{MODEL}:generateContent"
    )
    assert API_KEY not in request.full_url
    assert headers["x-api-key"] == API_KEY
    assert headers["content-type"] == "application/json"
    assert captured["timeout"] == 7


def test_request_uses_separate_text_and_inline_data_parts() -> None:
    item = provider()
    calls = capture_payload(item)
    assess(item)
    parts = calls[0]["contents"][0]["parts"]
    assert len(parts) == 2
    assert set(parts[0]) == {"text"}
    assert set(parts[1]) == {"inlineData"}
    assert set(parts[1]["inlineData"]) == {"mimeType", "data"}


def test_request_generation_configuration_and_schema() -> None:
    item = provider()
    calls = capture_payload(item)
    assess(item)
    config = calls[0]["generationConfig"]
    assert config["temperature"] == 0.1
    assert config["maxOutputTokens"] == 800
    assert config["responseMimeType"] == "application/json"
    assert config["responseSchema"] == PROVIDER_ASSESSMENT_RESPONSE_SCHEMA
    assert set(config["responseSchema"]["properties"]) == {
        "condition",
        "confidence_level",
        "confidence_score",
        "visual_findings",
        "alternative_conditions",
        "image_quality",
        "needs_more_information",
        "follow_up_question_ids",
        "visual_safety_signals",
    }


@pytest.mark.parametrize("content_type", ["image/jpeg", "image/png", "image/webp"])
def test_supported_mime_and_base64_transfer(content_type: str) -> None:
    sanitized = f"sanitized-{content_type}".encode()
    item = provider()
    calls = capture_payload(item)
    assess(item, image(content_type, sanitized))
    inline = calls[0]["contents"][0]["parts"][1]["inlineData"]
    assert inline["mimeType"] == content_type
    assert base64.b64decode(inline["data"], validate=True) == sanitized


def test_only_sanitized_not_original_bytes_are_sent() -> None:
    original = make_image_bytes(include_exif=True)
    temporary = SpooledTemporaryFile()
    temporary.write(original)
    temporary.seek(0)
    upload = UploadFile(
        filename="synthetic.jpg",
        file=temporary,
        headers={"content-type": "image/jpeg"},
    )
    sanitized = asyncio.run(
        validate_and_sanitize_image(
            upload,
            max_bytes=8 * 1024 * 1024,
            max_pixels=20_000_000,
            min_side=320,
        )
    )
    asyncio.run(upload.close())
    assert sanitized.content != original

    item = provider()
    calls = capture_payload(item)
    assess(item, sanitized)
    sent = base64.b64decode(
        calls[0]["contents"][0]["parts"][1]["inlineData"]["data"],
        validate=True,
    )
    assert sent == sanitized.content
    assert sent != original


def test_payload_never_uses_file_data() -> None:
    item = provider()
    calls = capture_payload(item)
    assess(item)
    serialized = json.dumps(calls[0])
    assert "fileData" not in serialized
    assert "file_data" not in serialized


@pytest.mark.parametrize(
    ("draft", "condition", "quality"),
    [
        (valid_draft(), "acne", "acceptable"),
        (
            valid_draft(
                condition="other_or_uncertain",
                confidence_level="unknown",
                confidence_score=None,
            ),
            "other_or_uncertain",
            "acceptable",
        ),
        (
            valid_draft(
                image_quality={
                    "status": "retake_required",
                    "issues": ["poor_lighting"],
                }
            ),
            "acne",
            "retake_required",
        ),
    ],
)
def test_valid_response_variants(draft: dict, condition: str, quality: str) -> None:
    item = provider()
    capture_payload(item, result=envelope(draft))
    result = assess(item)
    assert result.condition == condition
    assert result.image_quality.status == quality


@pytest.mark.parametrize(
    "response",
    [
        "{}",
        json.dumps({"candidates": []}),
        json.dumps({"candidates": [{"content": {"parts": []}}]}),
        json.dumps({"candidates": [{"content": {"parts": [{"text": "   "}]}}]}),
        json.dumps(
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {
                            "parts": [{"text": json.dumps(valid_draft())}]
                        },
                    }
                ]
            }
        ),
        json.dumps(
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": json.dumps(valid_draft())},
                                {"text": json.dumps(valid_draft())},
                            ]
                        }
                    }
                ]
            }
        ),
    ],
)
def test_invalid_response_envelopes_fail_closed(response: str) -> None:
    item = provider()
    capture_payload(item, result=response)
    with pytest.raises(AssessmentProviderOutputInvalid):
        assess(item)


def test_incomplete_response_reports_only_controlled_finish_reason() -> None:
    item = provider()
    response = json.dumps(
        {
            "candidates": [
                {
                    "finishReason": "MAX_TOKENS",
                    "content": {"parts": [{"text": json.dumps(valid_draft())}]},
                }
            ]
        }
    )
    capture_payload(item, result=response)
    with pytest.raises(
        AssessmentProviderOutputInvalid,
        match=r"incomplete \(MAX_TOKENS\)",
    ):
        assess(item)


@pytest.mark.parametrize(
    "candidate",
    [
        '{"condition":',
        "```json\n" + json.dumps(valid_draft()) + "\n```",
        valid_draft(protected_backend_field="forbidden"),
        {key: value for key, value in valid_draft().items() if key != "condition"},
        valid_draft(visual_findings=["unapproved_finding"]),
    ],
)
def test_invalid_candidate_json_fails_closed(candidate: dict | str) -> None:
    item = provider()
    capture_payload(item, result=envelope(candidate))
    with pytest.raises(AssessmentProviderOutputInvalid):
        assess(item)


def test_unsupported_mime_fails_before_transport() -> None:
    item = provider()
    calls = capture_payload(item)
    with pytest.raises(AssessmentProviderOutputInvalid):
        assess(item, image("image/gif"))
    assert calls == []


def test_encoded_size_limit_fails_before_transport(monkeypatch) -> None:
    monkeypatch.setattr(cortex_module, "CORTEX_INLINE_REQUEST_LIMIT_BYTES", 3)
    item = provider()
    calls = capture_payload(item)
    with pytest.raises(AssessmentProviderOutputInvalid):
        assess(item, image(content=b"four"))
    assert calls == []


def test_timeout_is_retried_once_then_mapped() -> None:
    item = provider()
    count = 0

    def execute(payload: dict, timeout_seconds: float) -> str:
        nonlocal count
        count += 1
        raise TimeoutError

    item._execute_request = execute  # type: ignore[method-assign]
    with pytest.raises(AssessmentProviderTimeout):
        assess(item)
    assert count == 2


def test_connection_failure_is_retried_once_then_mapped() -> None:
    item = provider()
    count = 0

    def execute(payload: dict, timeout_seconds: float) -> str:
        nonlocal count
        count += 1
        raise urllib.error.URLError("connection refused")

    item._execute_request = execute  # type: ignore[method-assign]
    with pytest.raises(AssessmentProviderUnavailable):
        assess(item)
    assert count == 2


@pytest.mark.parametrize("status", [429, 500])
def test_retryable_http_status_is_retried_once(status: int) -> None:
    item = provider()
    count = 0

    def execute(payload: dict, timeout_seconds: float) -> str:
        nonlocal count
        count += 1
        if count == 1:
            raise urllib.error.HTTPError(
                BASE_URL, status, "provider body must not leak", {}, None
            )
        return envelope()

    item._execute_request = execute  # type: ignore[method-assign]
    assert assess(item).condition == "acne"
    assert count == 2


def test_http_400_is_not_retried() -> None:
    item = provider()
    count = 0

    def execute(payload: dict, timeout_seconds: float) -> str:
        nonlocal count
        count += 1
        raise urllib.error.HTTPError(
            BASE_URL, 400, "sensitive provider body", {}, BytesIO(b"secret")
        )

    item._execute_request = execute  # type: ignore[method-assign]
    with pytest.raises(AssessmentProviderOutputInvalid) as caught:
        assess(item)
    assert count == 1
    assert "sensitive provider body" not in str(caught.value)
    assert "secret" not in str(caught.value)


def test_http_401_is_not_retried_and_body_is_not_leaked(caplog) -> None:
    item = provider()
    count = 0

    def execute(payload: dict, timeout_seconds: float) -> str:
        nonlocal count
        count += 1
        raise urllib.error.HTTPError(
            BASE_URL,
            401,
            "credential rejected with sensitive detail",
            {},
            BytesIO(b"raw-private-error-body"),
        )

    item._execute_request = execute  # type: ignore[method-assign]
    with caplog.at_level(logging.DEBUG), pytest.raises(
        AssessmentProviderUnavailable
    ) as caught:
        assess(item)
    assert count == 1
    combined = caplog.text + str(caught.value)
    assert API_KEY not in combined
    assert "raw-private-error-body" not in combined
    assert "credential rejected" not in combined


def test_logs_never_contain_api_key_or_base64(caplog) -> None:
    item = provider(max_retries=0)
    encoded = base64.b64encode(b"unique-image-secret").decode()

    def execute(payload: dict, timeout_seconds: float) -> str:
        raise urllib.error.URLError("offline")

    item._execute_request = execute  # type: ignore[method-assign]
    with caplog.at_level(logging.DEBUG), pytest.raises(
        AssessmentProviderUnavailable
    ):
        assess(item, image(content=b"unique-image-secret"))
    assert API_KEY not in caplog.text
    assert encoded not in caplog.text
    assert "unique-image-secret" not in caplog.text


def test_mock_remains_default_provider() -> None:
    selected = build_image_assessment_provider(Settings(_env_file=None))
    assert isinstance(selected, MockImageAssessmentProvider)
    assert selected.engine is AssessmentEngine.MOCK


def test_cortex_is_selected_from_configuration() -> None:
    config = Settings(
        _env_file=None,
        image_assessment_provider="cortex",
        cortex_api_key=API_KEY,
        cortex_base_url=BASE_URL,
        cortex_image_model=MODEL,
    )
    selected = build_image_assessment_provider(config)
    assert isinstance(selected, CortexMultimodalAssessmentProvider)
    assert selected.engine is AssessmentEngine.MULTIMODAL_LLM_PROTOTYPE
    assert selected.engine_version == f"cortex:{MODEL}"


def test_public_route_contract_is_unchanged() -> None:
    operation = app.openapi()["paths"][
        "/v1/assessments/{assessment_id}/image-assessment"
    ]["post"]
    assert operation["requestBody"]["content"]["multipart/form-data"]
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert schema["$ref"].endswith("/ImageAssessmentResult")


def test_repository_stores_normalized_result_and_has_no_image_store() -> None:
    repository = InMemoryAssessmentRepository()
    record = repository.create()
    result = make_assessment_result(
        assessment_engine="multimodal_llm_prototype",
        engine_version=f"cortex:{MODEL}",
    )
    repository.save_assessment(record.id, result)
    stored = repository.get(record.id)
    assert stored is not None
    assert stored.assessment == result
    assert not hasattr(repository, "_images")
    assert not hasattr(repository, "save_image")
    assert not hasattr(repository, "get_image")


@pytest.mark.parametrize(
    "updates",
    [
        {"image_assessment_provider": "unknown"},
        {"image_assessment_prompt_version": "unreviewed"},
        {"image_assessment_schema_version": "v2"},
        {"image_assessment_max_retries": 2},
        {"cortex_base_url": "https://user:secret@example.test?key=secret"},
        {"cortex_image_model": "models/gemini"},
    ],
)
def test_invalid_assessment_configuration_is_rejected(updates: dict) -> None:
    with pytest.raises(ValueError):
        Settings(_env_file=None, **updates)
