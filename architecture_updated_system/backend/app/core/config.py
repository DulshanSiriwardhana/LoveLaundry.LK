"""Typed application settings.

Mirrors the legacy ``config.py`` shape but centralises every service's settings
into one object. Secrets have no defaults: a missing ``JWT_SECRET`` or
``MASTER_KEY`` is a hard startup error, matching legacy behaviour.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from typing import Annotated

from pydantic import AliasChoices, BeforeValidator, Field
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Anchor the env file to this project (backend/.env), NOT the process CWD, so a
# stray `.env` elsewhere on disk can never be loaded implicitly.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _parse_origins(value):
    """Accept a JSON list, a comma-separated string, or ``*`` (legacy env style).

    ``NoDecode`` stops pydantic-settings from JSON-decoding the raw env string
    before this runs, so both ``ALLOWED_ORIGINS=a,b`` and ``ALLOWED_ORIGINS=*``
    work instead of raising a settings parse error.
    """
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("["):
            return json.loads(value)
        return [o.strip() for o in value.split(",") if o.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    # ── Required shared secrets ──────────────────────────────────────────────
    jwt_secret: str = Field(validation_alias=AliasChoices("JWT_SECRET"))
    master_key: str = Field(validation_alias=AliasChoices("MASTER_KEY"))

    # ── Application ──────────────────────────────────────────────────────────
    app_env: str = Field(default="development", validation_alias=AliasChoices("APP_ENV"))
    tz: str = Field(default="Asia/Colombo", validation_alias=AliasChoices("TZ"))
    cors_origins: Annotated[list[str], NoDecode, BeforeValidator(_parse_origins)] = Field(
        default=["*"], validation_alias=AliasChoices("ALLOWED_ORIGINS", "CORS_ORIGINS")
    )
    jwt_algorithm: str = "HS256"
    jwt_expires_hours: int = 24

    # ── Love AI signed-request auth ──────────────────────────────────────────
    ai_api_keys: str = Field(
        default="", validation_alias=AliasChoices("LOVE_AI_API_KEYS", "AI_API_KEYS")
    )
    signature_ttl_seconds: int = 300

    @property
    def ai_api_keys_raw(self) -> list[str]:
        return [k.strip() for k in self.ai_api_keys.split(",") if k.strip()]

    # ── Legacy fallbacks ─────────────────────────────────────────────────────
    mongo_uri: str | None = Field(
        default=None, validation_alias=AliasChoices("MONGO_URI", "DATABASE_URL")
    )
    mongo_db_name: str | None = Field(
        default=None, validation_alias=AliasChoices("MONGO_DB_NAME")
    )

    # ── Three-database role model ────────────────────────────────────────────
    mongodb_main_uri: str | None = None
    mongodb_main_db: str | None = None
    mongodb_secondary_uri: str | None = None
    mongodb_secondary_db: str | None = None
    mongodb_local_uri: str | None = None
    mongodb_local_db: str | None = None

    # ── Sync worker ──────────────────────────────────────────────────────────
    sync_enabled: bool = True
    sync_worker_poll_seconds: float = 1.0
    sync_retry_max_attempts: int = 5
    sync_retry_base_delay_seconds: int = 3

    # ── Resolved role accessors (legacy fallback semantics) ──────────────────
    def resolve_main_uri(self) -> str:
        return self.mongodb_main_uri or self.mongo_uri or "mongodb://localhost:27017"

    def resolve_main_db(self) -> str:
        return self.mongodb_main_db or self.mongo_db_name or "lovelaundry"

    def resolve_secondary_uri(self) -> str:
        return self.mongodb_secondary_uri or self.mongo_uri or "mongodb://localhost:27017"

    def resolve_secondary_db(self) -> str:
        return self.mongodb_secondary_db or f"{self.resolve_main_db()}_secondary"

    def resolve_local_uri(self) -> str:
        return self.mongodb_local_uri or self.mongo_uri or "mongodb://localhost:27017"

    def resolve_local_db(self) -> str:
        return self.mongodb_local_db or f"{self.resolve_main_db()}_local"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()
