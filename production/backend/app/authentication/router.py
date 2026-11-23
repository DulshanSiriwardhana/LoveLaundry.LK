import asyncio
import math
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from ..core.config import get_settings
from ..core.security import get_user_lookup
from .service import authenticate, issue_token

router = APIRouter(tags=["authentication"])

_finder = None

# In-process, per-identity login throttling. Forwarded IP headers are ignored:
# only the directly connected peer is used, so a client cannot rotate a header
# to bypass the limit. A multi-instance deployment must add a shared limiter.
_login_failures: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_login_blocked_until: dict[tuple[str, str], float] = {}
_login_lock = asyncio.Lock()


def reset_login_throttle() -> None:
    """Test/deployment helper to clear in-memory throttling state."""

    _login_failures.clear()
    _login_blocked_until.clear()


def _login_key(request: Request, user_name: str) -> tuple[str, str]:
    peer = request.client.host if request.client else "unknown"
    return user_name.strip().casefold(), peer


async def _check_login_throttle(key: tuple[str, str]) -> None:
    settings = get_settings()
    now = time.monotonic()
    async with _login_lock:
        blocked_until = _login_blocked_until.get(key, 0.0)
        if blocked_until > now:
            retry_after = max(1, math.ceil(blocked_until - now))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many login attempts. Try again later.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket = _login_failures[key]
        window_start = now - settings.login_window_seconds
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= settings.login_attempt_limit:
            _login_blocked_until[key] = now + settings.login_lockout_seconds
            bucket.clear()
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many login attempts. Try again later.",
                headers={"Retry-After": str(settings.login_lockout_seconds)},
            )


async def _record_login_failure(key: tuple[str, str]) -> None:
    settings = get_settings()
    now = time.monotonic()
    async with _login_lock:
        bucket = _login_failures[key]
        bucket.append(now)
        window_start = now - settings.login_window_seconds
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= settings.login_attempt_limit:
            _login_blocked_until[key] = now + settings.login_lockout_seconds
            bucket.clear()


async def _clear_login_failures(key: tuple[str, str]) -> None:
    async with _login_lock:
        _login_failures.pop(key, None)
        _login_blocked_until.pop(key, None)


def set_user_finder(fn) -> None:
    global _finder
    _finder = fn


def get_user_finder():
    if _finder is None:
        return get_user_lookup
    return _finder


class LoginRequest(BaseModel):
    user_name: str
    password: str


_PUBLIC_USER_FIELDS = (
    "auth_id",
    "user_name",
    "status",
    "role_ids",
    "permissions",
    "organization_id",
    "laundry_id",
    "hotel_id",
    "shop_id",
)


def public_user(user: dict) -> dict:
    return {field: user[field] for field in _PUBLIC_USER_FIELDS if field in user}


@router.post("/auth/login")
async def login(
    payload: LoginRequest, request: Request, finder=Depends(get_user_finder)
) -> dict:
    key = _login_key(request, payload.user_name)
    await _check_login_throttle(key)
    user = await authenticate(payload.user_name, payload.password, finder)
    if user is None:
        await _record_login_failure(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    await _clear_login_failures(key)
    return {"access_token": issue_token(user), "token_type": "bearer", "user": public_user(user)}
