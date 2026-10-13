"""JWT authentication + authorization dependencies (legacy parity).

Keeps HS256 tokens signed with ``JWT_SECRET`` and the "reload the user on every
request" revocation semantics. The user lookup is injected by the auth module to
avoid an import cycle (``app.modules.auth`` -> ``app.core.security`` only).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer

from .config import get_settings

DISABLED_STATUSES = {"inactive", "disabled", "suspended", "blocked", "deleted"}

security = HTTPBearer(auto_error=True)

# Pluggable async lookup: auth_id -> user dict | None. Registered by the auth module.
_user_lookup = None


def set_user_lookup(fn) -> None:
    """Register an async ``auth_id -> user dict | None`` callable."""
    global _user_lookup
    _user_lookup = fn


def create_access_token(data: dict, expires_in_hours: int | None = None) -> str:
    s = get_settings()
    payload = dict(data)
    now = datetime.now(timezone.utc)
    payload["exp"] = now + timedelta(hours=expires_in_hours or s.jwt_expires_hours)
    payload["iat"] = now
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def verify_token(token: str) -> dict:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token")


async def get_current_user(credentials=Security(security)) -> dict:
    payload = verify_token(credentials.credentials)

    auth_id = payload.get("auth_id")
    if auth_id and _user_lookup is not None:
        fresh = await _user_lookup(auth_id)
        if fresh is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists.")
        if str(fresh.get("status") or "unset").strip().lower() in DISABLED_STATUSES:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "This account has been deactivated. Contact an administrator.",
            )
        fresh_role = str(fresh.get("role_id") or "").upper()
        if fresh_role:
            payload["role"] = fresh_role
        payload["status"] = fresh.get("status")
        payload["user_name"] = fresh.get("user_name") or payload.get("user_name")

    return payload


def require_role(allowed_roles: list[str]):
    allowed = {r.upper() for r in allowed_roles}

    async def dependency(current_user: dict = Security(get_current_user)) -> dict:
        role = str(current_user.get("role") or "").upper()
        if role not in allowed:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Role '{current_user.get('role')}' is not authorized to access this resource",
            )
        return current_user

    return dependency
