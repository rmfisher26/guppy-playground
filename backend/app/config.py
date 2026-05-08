"""
Runtime configuration via environment variables.
All settings have safe defaults for local development.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

# Versions available in the UI version picker.
# Each entry must be a valid PyPI version for guppylang.
# The first entry is the default shown on page load.
SUPPORTED_VERSIONS: list[str] = [
    "0.21.11",
    "0.21.0",
]
DEFAULT_VERSION = SUPPORTED_VERSIONS[0]

# Kept in sync with requirements.txt — used when spawning versioned workers.
SELENE_VERSION = "0.2.13"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # CORS — accepts a JSON array (["a","b"]) or comma-separated string (a,b)
    allowed_origins: str = (
        '["http://localhost:4321","https://guppyfisher.dev"]'
    )

    @property
    def origins_list(self) -> list[str]:
        import json
        v = self.allowed_origins.strip()
        if v.startswith("["):
            return json.loads(v)
        return [o.strip() for o in v.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
