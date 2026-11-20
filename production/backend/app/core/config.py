from functools import lru_cache

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


KNOWN_ORIGINS = (
    "https://lovelaundry-manager.vercel.app",
    "https://hotels-manager.vercel.app",
    "https://hotels-manager-amber.vercel.app",
    "https://shops-manager.vercel.app",
    "https://system-lovelaundry-lk.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "https://lovelaundry-shop-app.vercel.app",
    "http://localhost",
    "http://127.0.0.1:5173",
    "http://localhost:8101",
    "http://127.0.0.1:8101",
    "http://localhost:8820",
    "http://127.0.0.1:8820",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jwt_secret: str = Field(validation_alias=AliasChoices("JWT_SECRET"))
    master_key: str = Field(validation_alias=AliasChoices("MASTER_KEY"))

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    auth_required: bool = Field(default=True, validation_alias="AUTH_REQUIRED")
    persistence: str = Field(default="mongo", validation_alias="PERSISTENCE")
    jwt_expires_hours: int = Field(default=24, validation_alias="JWT_EXPIRES_HOURS")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")

    cors_origins: list[str] = Field(default=list(KNOWN_ORIGINS), validation_alias="ALLOWED_ORIGINS")

    central_system_uri: str = Field(
        default="mongodb://127.0.0.1:27017", validation_alias="MONGODB_CENTRAL_URI"
    )
    central_system_db: str = Field(
        default="central_system", validation_alias="MONGODB_CENTRAL_DB"
    )

    laundry_internal_uri: str = Field(
        default="mongodb://127.0.0.1:27017", validation_alias="MONGODB_LAUNDRY_URI"
    )
    laundry_internal_db: str = Field(
        default="laundry_internal", validation_alias="MONGODB_LAUNDRY_DB"
    )

    linen_tracking_uri: str = Field(
        default="mongodb://127.0.0.1:27017", validation_alias="MONGODB_LINEN_URI"
    )
    linen_tracking_db: str = Field(
        default="linen_tracking", validation_alias="MONGODB_LINEN_DB"
    )

    @model_validator(mode="after")
    def merge_cors_origins(self):
        configured = [origin.strip().rstrip("/") for origin in self.cors_origins if origin.strip()]
        configured = [origin for origin in configured if origin != "*"]
        self.cors_origins = list(dict.fromkeys((*KNOWN_ORIGINS, *configured)))
        return self

    @property
    def central_system(self) -> str:
        return self.central_system_db

    @property
    def laundry_internal(self) -> str:
        return self.laundry_internal_db

    @property
    def linen_tracking(self) -> str:
        return self.linen_tracking_db


@lru_cache
def get_settings() -> Settings:
    return Settings()
