"""
Runtime configuration via environment variables.
All settings have safe defaults for local development.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Execution limits
    compile_timeout_seconds: float = 10.0
    simulate_timeout_seconds: float = 15.0
    max_shots: int = 8192
    sandbox_memory_mb: int = 512

    # CORS — comma-separated origins
    allowed_origins: str = (
        "http://localhost:4321,"
        "https://guppyfisher.dev"
    )

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
