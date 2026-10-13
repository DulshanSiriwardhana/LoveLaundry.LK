"""Settings for the system_info scanner service."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Anchor the env file to this project (system_info/backend/.env), never the CWD.
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class ScanSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    scan_source_root: str = Field(default="")
    scan_bind_host: str = Field(default="127.0.0.1")
    scan_bind_port: int = Field(default=8810)
    scan_api_key: str = Field(default="")

    def resolved_root(self) -> Path:
        if self.scan_source_root:
            return Path(self.scan_source_root).expanduser().resolve()
        # Fallback: sibling `system-manegment` two levels above this project.
        return (Path(__file__).resolve().parents[3].parent / "system-manegment").resolve()


@lru_cache(maxsize=1)
def get_scan_settings() -> ScanSettings:
    return ScanSettings()
