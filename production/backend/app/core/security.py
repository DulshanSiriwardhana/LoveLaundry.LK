from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings
from .principal import normalize_principal

DISABLED_STATUSES = {"inactive", "disabled", "suspended", "blocked", "deleted"}

security = HTTPBearer(auto_error=False)

_user_lookup = None


def set_user_lookup(fn) -> None:
    global _user_lookup
    _user_lookup = fn


async def _database_user_lookup(auth_id: str) -> dict | None:
    from ..db.connection import DatabaseKind, get_database

    database = get_database(DatabaseKind.CENTRAL_SYSTEM)
    user = await database.users.find_one(
        {"$or": [{"auth_id": auth_id}, {"user_id": auth_id}, {"sub": auth_id}]}
    )
    if user is None:
        return None
    user["auth_id"] = str(user.get("auth_id") or auth_id)
    return user


async def get_user_lookup(auth_id: str, *, required: bool = False) -> dict | None:
    """Resolve a live user record.

    ``required=True`` is used for authenticated requests: a signed token is not
    sufficient if the account was deleted, disabled or the identity store is
    unavailable. Callers that merely want an optional projection (for example
    the login finder) keep the old non-raising behaviour.
    """

    if not auth_id:
        if required:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")
        return None
    try:
        if _user_lookup is not None:
            user = await _user_lookup(auth_id)
        else:
            user = await _database_user_lookup(auth_id)
    except HTTPException:
        raise
    except Exception as exc:
        if required:
            # Never include driver errors or connection strings in a response.
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, "Account lookup is unavailable"
            ) from exc
        return None
    if required and user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")
    return user


def _token_issued_at(payload: dict) -> datetime | None:
    value = payload.get("iat")
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    return None


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def token_is_revoked(user: dict, payload: dict) -> bool:
    """Honour operator-set revocation markers on the live user record."""

    if bool(user.get("token_revoked")):
        return True
    revoked_at = _parse_timestamp(user.get("token_revoked_at"))
    issued_at = _token_issued_at(payload)
    if revoked_at is not None:
        if issued_at is None:
            return True
        if issued_at <= revoked_at:
            return True
    expected_version = user.get("token_version")
    actual_version = payload.get("token_version")
    if expected_version is not None and actual_version is not None:
        return str(expected_version) != str(actual_version)
    return False


def create_access_token(data: dict, expires_in_hours: int | None = None) -> str:
    settings = get_settings()
    payload = dict(data)
    now = datetime.now(timezone.utc)
    payload["exp"] = now + timedelta(hours=expires_in_hours or settings.jwt_expires_hours)
    payload["iat"] = now
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _token_identity(payload: dict) -> str:
    for key in ("sub", "auth_id", "user_id"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token") from exc
    if not _token_identity(payload):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token")
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    settings = get_settings()
    if not settings.auth_required:
        if settings.app_env.strip().lower() == "production":
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Authentication cannot be disabled in production",
            )
        return normalize_principal(
            {
                "auth_id": "local",
                "user_name": "local",
                "status": "active",
                "role_ids": ["PLATFORM_ADMIN"],
                "permissions": ["*"],
            }
        )
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    payload = verify_token(credentials.credentials)
    auth_id = _token_identity(payload)
    user = await get_user_lookup(auth_id, required=True)
    status_value = str(user.get("status") or "unset").strip().lower()
    if status_value in DISABLED_STATUSES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled.")
    if token_is_revoked(user, payload):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked")
    try:
        # Claims still supply role/tenant snapshots; the live record wins on
        # status and explicit revocation markers.
        return normalize_principal(user, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
