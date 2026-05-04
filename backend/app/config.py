"""
Runtime configuration via environment variables.
All settings have safe defaults for local development.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


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
