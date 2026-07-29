"""Application settings for backend configuration.

Single responsibility: define typed environment-backed settings used across layers.
"""

from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed settings loaded from environment variables or .env file."""

    llm_provider: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    llm_base_url: str = ""
    llm_timeout_seconds: float = 30.0
    classifier_provider: str = "mock"
    recommendation_prompt_version: str = "v1"
    image_assessment_provider: str = "mock"
    image_assessment_prompt_version: str = "image-assessment-v1"
    image_assessment_schema_version: str = "v1"
    image_assessment_timeout_seconds: float = Field(default=20.0, gt=0, le=120)
    image_assessment_max_retries: int = Field(default=1, ge=0, le=1)
    image_assessment_max_output_tokens: int = Field(default=800, ge=1, le=4096)
    image_assessment_temperature: float = Field(default=0.1, ge=0.0, le=1.0)
    image_assessment_max_bytes: int = Field(default=8 * 1024 * 1024, gt=0)
    image_assessment_max_pixels: int = Field(default=20_000_000, gt=0)
    image_assessment_min_side: int = Field(default=320, ge=64)
    image_assessment_max_images: int = Field(default=1, ge=1, le=1)
    cortex_api_key: str = ""
    cortex_base_url: str = "https://cortex-ai-gateway-zo7vz3jvhq-uc.a.run.app"
    cortex_image_model: str = Field(
        default="gemini-2.5-flash",
        pattern=r"^[A-Za-z0-9._-]+$",
        min_length=1,
        max_length=120,
    )
    safety_policy_version: str = "v1"
    severe_pain_threshold: int = Field(default=7, ge=1, le=10)
    # Prototype configuration, not clinical truth - tune after evaluation.
    CONFIDENCE_RETAKE_THRESHOLD: float = 0.60
    CONFIDENCE_CAUTIOUS_THRESHOLD: float = 0.80

    @property
    def LLM_PROVIDER(self) -> str:
        return self.llm_provider

    @property
    def LLM_API_KEY(self) -> str:
        return self.llm_api_key

    @property
    def LLM_MODEL(self) -> str:
        return self.llm_model

    @property
    def CLASSIFIER_PROVIDER(self) -> str:
        return self.classifier_provider

    @property
    def LLM_BASE_URL(self) -> str:
        return self.llm_base_url

    @property
    def LLM_TIMEOUT_SECONDS(self) -> float:
        return self.llm_timeout_seconds

    @property
    def IMAGE_ASSESSMENT_PROVIDER(self) -> str:
        return self.image_assessment_provider

    @field_validator("image_assessment_provider")
    @classmethod
    def validate_image_assessment_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"mock", "cortex"}:
            raise ValueError("image assessment provider must be mock or cortex")
        return normalized

    @field_validator("image_assessment_prompt_version")
    @classmethod
    def validate_assessment_prompt_version(cls, value: str) -> str:
        if value != "image-assessment-v1":
            raise ValueError("unsupported image assessment prompt version")
        return value

    @field_validator("image_assessment_schema_version")
    @classmethod
    def validate_assessment_schema_version(cls, value: str) -> str:
        if value != "v1":
            raise ValueError("unsupported image assessment schema version")
        return value

    @field_validator("cortex_base_url")
    @classmethod
    def validate_cortex_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlsplit(normalized)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Cortex base URL must be an HTTP(S) origin without credentials")
        return normalized

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
