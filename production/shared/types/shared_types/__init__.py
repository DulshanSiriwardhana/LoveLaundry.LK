from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict


class User(BaseModel):
    model_config = ConfigDict(extra="allow")

    auth_id: str
    user_name: str
    email: str | None = None
    status: str = "active"
    role_ids: list[str] = []
    organization_id: str | None = None
    created_at: datetime = datetime.now(timezone.utc)
    updated_at: datetime = datetime.now(timezone.utc)


class Role(BaseModel):
    model_config = ConfigDict(extra="allow")

    role_id: str
    name: str
    capabilities: list[str] = []


class Permission(BaseModel):
    model_config = ConfigDict(extra="allow")

    permission_id: str
    name: str
    description: str | None = None


class Organization(BaseModel):
    model_config = ConfigDict(extra="allow")

    organization_id: str
    name: str
    created_at: datetime = datetime.now(timezone.utc)


class Membership(BaseModel):
    model_config = ConfigDict(extra="allow")

    membership_id: str
    user_id: str
    organization_id: str
    status: str = "active"
    created_at: datetime = datetime.now(timezone.utc)


class Device(BaseModel):
    model_config = ConfigDict(extra="allow")

    device_id: str
    organization_id: str
    platform: str | None = None
    status: str = "active"
    created_at: datetime = datetime.now(timezone.utc)


class Session(BaseModel):
    model_config = ConfigDict(extra="allow")

    session_id: str
    user_id: str
    token_jti: str
    expires_at: datetime
    created_at: datetime = datetime.now(timezone.utc)


class AuditEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    audit_id: str
    actor_id: str
    action: str
    target_id: str | None = None
    detail: dict = {}
    created_at: datetime = datetime.now(timezone.utc)


class SecurityLog(BaseModel):
    model_config = ConfigDict(extra="allow")

    log_id: str
    event: str
    actor_id: str | None = None
    detail: dict = {}
    created_at: datetime = datetime.now(timezone.utc)


class SystemConfig(BaseModel):
    model_config = ConfigDict(extra="allow")

    config_key: str
    value: dict = {}
    updated_at: datetime | None = None
