from datetime import datetime, timedelta, timezone

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


async def get_user_lookup(auth_id: str) -> dict | None:
    if not auth_id:
        return None
    if _user_lookup is not None:
        return await _user_lookup(auth_id)
    try:
        return await _database_user_lookup(auth_id)
    except Exception:
        return None


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
    user = await get_user_lookup(auth_id)
    if user is None:
        # The token is signed with the platform secret, so its claims are a
        # valid fallback when the local user projection has not been seeded.
        user = dict(payload)
    status_value = str(user.get("status") or payload.get("status") or "unset").strip().lower()
    if status_value in DISABLED_STATUSES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled.")
    try:
        return normalize_principal(user, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
