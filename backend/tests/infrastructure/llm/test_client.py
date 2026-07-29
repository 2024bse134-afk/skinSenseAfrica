import asyncio

import pytest

from app.infrastructure.llm.client import (
    GeminiRecommendationClient,
    MockLLMClient,
    RecommendationLLMError,
    get_llm_client,
)


class DummySettings:
    def __init__(self, provider: str = "mock") -> None:
        self.LLM_PROVIDER = provider
        self.LLM_API_KEY = "secret-key"
        self.LLM_MODEL = "gemini-1.5-flash"
        self.LLM_TIMEOUT_SECONDS = 5


def test_mock_llm_client_returns_configured_json() -> None:
    expected = '{"explanation":"ok","possible_contributing_factors":[],"skin_tone_considerations":[],"recommended_action":{"type":"self_care","urgency":"routine","steps":[],"referral_reason":null},"prevention":[],"warning_signs":[],"limitations":[]}'
    client = MockLLMClient(response_text=expected)

    result = asyncio.run(client.generate(messages=[{"role": "user", "content": "hello"}]))
    assert result == expected


def test_mock_llm_client_raises_recommendation_error_when_configured() -> None:
    client = MockLLMClient(should_raise=True)

    with pytest.raises(RecommendationLLMError, match="Mock LLM failure"):
        asyncio.run(client.generate(messages=[{"role": "user", "content": "hello"}]))


def test_get_llm_client_returns_mock_for_mock_provider() -> None:
    config = DummySettings(provider="mock")
    client = get_llm_client(config)
    assert isinstance(client, MockLLMClient)


def test_real_client_wraps_timeout_error(monkeypatch) -> None:
    client = GeminiRecommendationClient(
        api_key="secret-key",
        model="gemini-1.5-flash",
        timeout_seconds=1,
    )

    def raise_timeout(_payload: dict) -> str:
        raise TimeoutError("simulated timeout")

    client._execute_request = raise_timeout  # type: ignore[method-assign]

    async def run_inline(function, *args):
        return function(*args)

    monkeypatch.setattr(asyncio, "to_thread", run_inline)

    with pytest.raises(RecommendationLLMError, match="timed out"):
        asyncio.run(
            client.generate(
                messages=[
                    {"role": "system", "content": "sys"},
                    {"role": "user", "content": "user"},
                ]
            )
        )
