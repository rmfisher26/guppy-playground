"""
Runtime configuration via environment variables.
All settings have safe defaults for local development.
"""
from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

# Empirically tested guppylang ↔ selene-sim pairs.
# To add a new version:
#   1. pip install guppylang==X.Y.Z && pip show selene-sim | grep Version
#   2. Run the test suite against that pair in a clean venv
#   3. Add the entry below with tested=True
#
# The weekly version-check workflow automates steps 1-2 and opens a PR
# updating this map when new compatible pairs are found.
#
# The first entry is the default shown on page load.
COMPATIBLE_VERSIONS: dict[str, dict] = {
    "0.21.11": {"selene_sim": "0.2.13", "tested": True    "0.21.9":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.8":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.7":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.6":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.5":  {"selene_sim": "0.2.13", "tested": True},
    "0.21.14":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.13":  {"selene_sim": "0.2.15", "tested": True},
    "0.21.10":  {"selene_sim": "0.2.15", "tested": True},
},
    "0.21.0":  {"selene_sim": "0.2.13", "tested": True},
}

SUPPORTED_VERSIONS: list[str] = list(COMPATIBLE_VERSIONS.keys())
DEFAULT_VERSION = SUPPORTED_VERSIONS[0]


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
