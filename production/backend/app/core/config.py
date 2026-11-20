from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jwt_secret: str = Field(validation_alias=AliasChoices("JWT_SECRET"))
    master_key: str = Field(validation_alias=AliasChoices("MASTER_KEY"))

    app_env: str = Field(default="development", validation_alias="APP_ENV")
    jwt_expires_hours: int = Field(default=24, validation_alias="JWT_EXPIRES_HOURS")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")

    cors_origins: list[str] = Field(
        default=[
            "https://lovelaundry-manager.vercel.app",
            "https://hotels-manager.vercel.app",
            "https://hotels-manager-amber.vercel.app",
            "https://shops-manager.vercel.app",
            "https://system-lovelaundry-lk.vercel.app",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://localhost:3000",
        ],
        validation_alias="ALLOWED_ORIGINS",
    )

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
