"""LLM client wrapper.

Single responsibility: wrap the configured LLM provider client for outbound model invocation.
Layering rule: keep provider SDK details confined to infrastructure so domain has no provider-specific imports.
"""

from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import urllib.request
from typing import Protocol

from app.settings import settings


RECOMMENDATION_DRAFT_SCHEMA = {
	"type": "object",
	"properties": {
		"explanation": {"type": "string"},
		"possible_contributing_factors": {"type": "array", "items": {"type": "string"}},
		"skin_tone_considerations": {"type": "array", "items": {"type": "string"}},
		"recommended_action": {
			"type": "object",
			"properties": {
				"type": {"type": "string"},
				"urgency": {"type": "string"},
				"steps": {"type": "array", "items": {"type": "string"}},
				"referral_reason": {"type": "string", "nullable": True},
			},
			"required": ["type", "urgency", "steps", "referral_reason"],
		},
		"prevention": {"type": "array", "items": {"type": "string"}},
		"warning_signs": {"type": "array", "items": {"type": "string"}},
		"limitations": {"type": "array", "items": {"type": "string"}},
	},
	"required": [
		"explanation",
		"possible_contributing_factors",
		"skin_tone_considerations",
		"recommended_action",
		"prevention",
		"warning_signs",
		"limitations",
	],
}


class RecommendationLLMError(Exception):
	"""Raised when provider invocation fails or times out."""


class LLMClient(Protocol):
	"""Provider-agnostic client interface for recommendation generation."""

	async def generate(self, messages: list[dict]) -> str:
		"""Generate a raw JSON string from the configured language model."""


class GeminiRecommendationClient:
	"""Gemini-backed recommendation client using JSON response mode."""

	def __init__(self, api_key: str, model: str, timeout_seconds: float = 30.0):
		if not api_key:
			raise RecommendationLLMError("LLM API key is not configured")
		if not model:
			raise RecommendationLLMError("LLM model is not configured")

		self.api_key = api_key
		self.model = model
		self.timeout_seconds = timeout_seconds

	async def generate(self, messages: list[dict]) -> str:
		"""Invoke Gemini and return the raw model text output."""

		payload = self._build_payload(messages)
		try:
			response_text = await asyncio.to_thread(self._execute_request, payload)
			response_json = json.loads(response_text)
			return self._extract_text(response_json)
		except RecommendationLLMError:
			raise
		except (TimeoutError, socket.timeout) as exc:
			raise RecommendationLLMError("LLM request timed out") from exc
		except urllib.error.HTTPError as exc:
			detail = self._read_http_error(exc)
			raise RecommendationLLMError(f"LLM HTTP error: {exc.code} {detail}") from exc
		except urllib.error.URLError as exc:
			raise RecommendationLLMError(f"LLM network error: {exc.reason}") from exc
		except json.JSONDecodeError as exc:
			raise RecommendationLLMError("LLM returned invalid JSON envelope") from exc
		except Exception as exc:
			raise RecommendationLLMError("LLM request failed") from exc

	def _build_payload(self, messages: list[dict]) -> dict:
		system_content = ""
		user_content = ""

		for message in messages:
			role = str(message.get("role", ""))
			content = str(message.get("content", ""))
			if role == "system":
				if system_content:
					system_content = f"{system_content}\n\n{content}"
				else:
					system_content = content
			elif role == "user":
				if user_content:
					user_content = f"{user_content}\n\n{content}"
				else:
					user_content = content

		payload: dict = {
			"contents": [
				{
					"role": "user",
					"parts": [{"text": user_content}],
				}
			],
			"generationConfig": {
				"responseMimeType": "application/json",
			},
		}

		if system_content:
			payload["system_instruction"] = {
				"parts": [{"text": system_content}],
			}

		return payload

	def _execute_request(self, payload: dict) -> str:
		url = (
			f"https://generativelanguage.googleapis.com/v1beta/models/"
			f"{self.model}:generateContent?key={self.api_key}"
		)
		request = urllib.request.Request(
			url=url,
			data=json.dumps(payload).encode("utf-8"),
			headers={"Content-Type": "application/json"},
			method="POST",
		)
		with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
			status = response.getcode()
			body = response.read().decode("utf-8")

		if status < 200 or status >= 300:
			raise RecommendationLLMError(f"LLM HTTP error: {status}")

		return body

	def _extract_text(self, response_json: dict) -> str:
		try:
			return response_json["candidates"][0]["content"]["parts"][0]["text"]
		except (KeyError, IndexError, TypeError) as exc:
			raise RecommendationLLMError("LLM response missing text candidate") from exc

	@staticmethod
	def _read_http_error(exc: urllib.error.HTTPError) -> str:
		try:
			error_body = exc.read().decode("utf-8")
			return error_body[:300]
		except Exception:
			return ""


class CortexRecommendationClient:
	"""Cortex gateway client using its Gemini-compatible generateContent API."""

	def __init__(self, api_key: str, base_url: str, model: str, timeout_seconds: float = 30.0):
		if not api_key:
			raise RecommendationLLMError("Cortex API key is not configured")
		if not base_url:
			raise RecommendationLLMError("Cortex base URL is not configured")
		if not model:
			raise RecommendationLLMError("LLM model is not configured")

		self.api_key = api_key
		self.base_url = base_url.rstrip("/")
		self.model = model
		self.timeout_seconds = timeout_seconds

	async def generate(self, messages: list[dict]) -> str:
		payload = self._build_payload(messages)
		try:
			response_text = await asyncio.to_thread(self._execute_request, payload)
			response_json = json.loads(response_text)
			return GeminiRecommendationClient._extract_text(self, response_json)
		except RecommendationLLMError:
			raise
		except (TimeoutError, socket.timeout) as exc:
			raise RecommendationLLMError("Cortex request timed out") from exc
		except urllib.error.HTTPError as exc:
			detail = GeminiRecommendationClient._read_http_error(exc)
			raise RecommendationLLMError(f"Cortex HTTP error: {exc.code} {detail}") from exc
		except urllib.error.URLError as exc:
			raise RecommendationLLMError(f"Cortex network error: {exc.reason}") from exc
		except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
			raise RecommendationLLMError("Cortex returned an invalid response") from exc

	def _build_payload(self, messages: list[dict]) -> dict:
		system_content = ""
		user_content = ""
		for message in messages:
			role = str(message.get("role", ""))
			content = str(message.get("content", ""))
			if role == "system":
				system_content = f"{system_content}\n\n{content}".strip()
			elif role == "user":
				user_content = f"{user_content}\n\n{content}".strip()

		return {
			"systemInstruction": {"parts": [{"text": system_content}]},
			"contents": [{"role": "user", "parts": [{"text": user_content}]}],
			"generationConfig": {
				"temperature": 0.0,
				"responseMimeType": "application/json",
				"responseSchema": RECOMMENDATION_DRAFT_SCHEMA,
			},
		}

	def _execute_request(self, payload: dict) -> str:
		request = urllib.request.Request(
			url=f"{self.base_url}/v1/models/{self.model}:generateContent",
			data=json.dumps(payload).encode("utf-8"),
			headers={"Content-Type": "application/json", "x-api-key": self.api_key},
			method="POST",
		)
		with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
			return response.read().decode("utf-8")


class MockLLMClient:
	"""Mock implementation for deterministic recommendation integration tests."""

	DEFAULT_RESPONSE = json.dumps(
		{
			"explanation": "This pattern may align with mild acne and should be monitored.",
			"possible_contributing_factors": ["occlusive products", "humidity"],
			"skin_tone_considerations": ["Use non-irritating products to reduce post-inflammatory marks."],
			"recommended_action": {
				"type": "self_care",
				"urgency": "routine",
				"steps": ["Cleanse gently", "Use a non-comedogenic moisturizer"],
				"referral_reason": None,
			},
			"prevention": ["Patch test new products", "Avoid harsh scrubbing"],
			"warning_signs": ["Rapid worsening", "Eye involvement"],
			"limitations": ["Educational guidance only"],
		}
	)

	def __init__(self, response_text: str | None = None, should_raise: bool = False):
		self.response_text = response_text or self.DEFAULT_RESPONSE
		self.should_raise = should_raise

	async def generate(self, messages: list[dict]) -> str:
		_ = messages
		if self.should_raise:
			raise RecommendationLLMError("Mock LLM failure")
		return self.response_text


def _get_setting_value(config: object, upper: str, lower: str, default: str = "") -> str:
	value = getattr(config, upper, None)
	if value is None:
		value = getattr(config, lower, default)
	return str(value)


def get_llm_client(config: object = settings) -> LLMClient:
	"""Return the configured LLM client implementation."""

	provider = _get_setting_value(config, "LLM_PROVIDER", "llm_provider").strip().lower()
	if provider == "mock":
		return MockLLMClient()

	api_key = _get_setting_value(config, "LLM_API_KEY", "llm_api_key")
	model = _get_setting_value(config, "LLM_MODEL", "llm_model")
	base_url = _get_setting_value(config, "LLM_BASE_URL", "llm_base_url").strip()
	timeout_raw = getattr(config, "LLM_TIMEOUT_SECONDS", None)
	if timeout_raw is None:
		timeout_raw = getattr(config, "llm_timeout_seconds", 30)

	try:
		timeout_seconds = float(timeout_raw)
	except (TypeError, ValueError) as exc:
		raise RecommendationLLMError("Invalid LLM timeout configuration") from exc

	if provider == "cortex":
		return CortexRecommendationClient(
			api_key=api_key,
			base_url=base_url,
			model=model,
			timeout_seconds=timeout_seconds,
		)

	if provider in {"", "gemini"}:
		return GeminiRecommendationClient(
		api_key=api_key,
		model=model,
		timeout_seconds=timeout_seconds,
		)

	raise RecommendationLLMError(f"Unsupported LLM provider: {provider}")
