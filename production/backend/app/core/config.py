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
    "http://localhost:5180",
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
    event_worker_enabled: bool = Field(default=False, validation_alias="EVENT_WORKER_ENABLED")
    event_worker_interval_seconds: int = Field(
        default=5, ge=1, validation_alias="EVENT_WORKER_INTERVAL_SECONDS"
    )
    reconciliation_interval_seconds: int = Field(
        default=300, ge=30, validation_alias="RECONCILIATION_INTERVAL_SECONDS"
    )

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

    # Hybrid identity settings. No domain, supplier, EPC prefix or radio
    # frequency is embedded in code; every value comes from configuration.
    qr_base_url: str = Field(default="", validation_alias="QR_BASE_URL")
    qr_rate_limit_per_minute: int = Field(
        default=60, ge=1, validation_alias="QR_RATE_LIMIT_PER_MINUTE"
    )
    epc_prefix_hex: str = Field(default="", validation_alias="RFID_EPC_PREFIX_HEX")
    epc_length: int = Field(default=24, ge=8, le=64, validation_alias="RFID_EPC_LENGTH")
    rfid_region: str = Field(default="LK", validation_alias="RFID_REGION")
    rfid_frequency_mhz: float | None = Field(
        default=None, gt=0, validation_alias="RFID_FREQUENCY_MHZ"
    )
    rfid_mode: str = Field(default="production", validation_alias="RFID_MODE")
    rfid_allow_simulated_reads: bool = Field(
        default=False, validation_alias="RFID_ALLOW_SIMULATED_READS"
    )
    tag_inspection_threshold_cycles: int = Field(
        default=250, ge=1, validation_alias="TAG_INSPECTION_THRESHOLD_CYCLES"
    )
    tag_replacement_planning_threshold_cycles: int = Field(
        default=275, ge=1, validation_alias="TAG_REPLACEMENT_PLANNING_THRESHOLD_CYCLES"
    )
    tag_rated_limit_alert_cycles: int = Field(
        default=300, ge=1, validation_alias="TAG_RATED_LIMIT_ALERT_CYCLES"
    )

    @model_validator(mode="after")
    def merge_cors_origins(self):
        environment = self.app_env.strip().lower()
        self.rfid_mode = self.rfid_mode.strip().lower()
        if self.rfid_mode not in {"production", "development", "test"}:
            raise ValueError("RFID_MODE must be production, development or test")
        if environment == "production":
            if not self.auth_required:
                raise ValueError("AUTH_REQUIRED cannot be false in production")
            if len(self.jwt_secret) < 32 or len(self.master_key) < 32:
                raise ValueError("Production secrets must be at least 32 characters long")
            if self.rfid_mode == "production" and self.rfid_allow_simulated_reads:
                raise ValueError("Simulated RFID reads cannot be enabled in production")
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
