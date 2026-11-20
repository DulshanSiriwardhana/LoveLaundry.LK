from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer

from .config import get_settings

DISABLED_STATUSES = {"inactive", "disabled", "suspended", "blocked", "deleted"}

security = HTTPBearer(auto_error=True)


def create_access_token(data: dict, expires_in_hours: int | None = None) -> str:
    settings = get_settings()
    payload = dict(data)
    now = datetime.now(timezone.utc)
    payload["exp"] = now + timedelta(hours=expires_in_hours or settings.jwt_expires_hours)
    payload["iat"] = now
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token") from exc


async def get_current_user(credentials: str = Security(security)) -> dict:
    payload = verify_token(credentials)
    user = await get_user_lookup(payload.get("sub"))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists.")
    if str(user.get("status") or "unset").strip().lower() in DISABLED_STATUSES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled.")
    return user


async def get_user_lookup(_auth_id: str) -> dict | None:
    raise NotImplementedError
