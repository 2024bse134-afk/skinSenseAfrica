"""Application settings for backend configuration.

Single responsibility: define typed environment-backed settings used across layers.
"""

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()
