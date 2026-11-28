import asyncio
import inspect
import math
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import AliasChoices, BaseModel, Field

from ..core.config import get_settings
from ..core.security import DISABLED_STATUSES, get_current_user, get_user_lookup
from ..runtime import get_runtime
from .service import authenticate, client_scope_for, issue_token, verify_password

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
    # Staff frontends send `username`; older clients send `user_name`.
    user_name: str = Field(validation_alias=AliasChoices("user_name", "username"))
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
    "client_name",
    "client_type",
    "client_scope",
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


def _status_user(principal: dict, client_name: str | None = None) -> dict:
    """Map a normalized principal onto the response shape clients already read."""

    return {
        "auth_id": principal.get("auth_id"),
        "user_id": principal.get("user_id"),
        "user_name": principal.get("user_name"),
        "status": principal.get("status"),
        "role_id": (principal.get("role_names") or [""])[0],
        "role_ids": principal.get("role_names") or [],
        "permissions": principal.get("capabilities") or [],
        "organization_id": principal.get("organization_id"),
        "laundry_id": principal.get("laundry_id"),
        "hotel_id": principal.get("hotel_id"),
        "shop_id": principal.get("shop_id"),
        "client_name": client_name or principal.get("client_name") or "",
        "client_type": principal.get("client_type"),
        "client_scope": principal.get("client_scope") or {},
    }


@router.get("/auth/status")
async def auth_status(user=Depends(get_current_user)) -> dict:
    """Session status for staff apps: who the token belongs to and whether it is live."""

    return {"user": _status_user(user)}


class ClientLoginRequest(BaseModel):
    auth_id: str
    password: str
    laundry_id: str = ""


async def _laundry_names() -> dict[str, str]:
    runtime = get_runtime()
    database = getattr(runtime, "central_database", None)
    if database is not None:
        cursor = database["laundries"].find({})
        if inspect.isawaitable(cursor):
            cursor = await cursor
        rows = cursor.to_list(length=500)
        if inspect.isawaitable(rows):
            rows = await rows
        return {
            str(row.get("laundry_id") or ""): str(row.get("name") or "")
            for row in rows
        }
    rows = await runtime.platform_service.organizations()
    return {
        str(row.get("organization_id") or ""): str(row.get("name") or "")
        for row in rows
        if str(row.get("type") or "") == "laundry"
    }


def _account_laundries(account: dict) -> list[str]:
    values = account.get("laundries") or []
    if isinstance(values, dict):
        values = [values]
    return [
        str(
            item.get("laundry_id") or item.get("id") or item.get("organization_id")
            if isinstance(item, dict)
            else item
        )
        for item in values
        if isinstance(item, dict) or str(item).strip()
    ]


async def _authenticate_client(payload: "ClientLoginRequest", finder) -> dict | None:
    """Pick one client account, refusing to guess between several laundries."""

    found = await finder(payload.auth_id)
    if found is None:
        return None
    candidates = found if isinstance(found, list) else [found]
    requested = str(payload.laundry_id or "").strip().lower()
    if requested:
        candidates = [
            account
            for account in candidates
            if str(account.get("laundry_id") or "").strip().lower() == requested
            or requested in {
                value.lower() for value in _account_laundries(account)
            }
        ]
    verified = [
        account
        for account in candidates
        if verify_password(
            payload.password,
            str(account.get("password_hash") or account.get("password") or ""),
        )
        and str(account.get("status") or "active").strip().lower()
        not in DISABLED_STATUSES
    ]
    if not verified:
        return None
    if len(verified) > 1:
        names = await _laundry_names()
        options = []
        for account in verified:
            laundry_id = str(account.get("laundry_id") or "")
            options.append(
                {
                    "laundry_id": laundry_id,
                    "laundry_name": names.get(laundry_id) or laundry_id,
                    "client_type": str(account.get("client_type") or ""),
                    "client_name": str(
                        account.get("client_name")
                        or account.get("hotel_name")
                        or account.get("shop_name")
                        or ""
                    ),
                }
            )
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "code": "laundry_required",
                "message": "This login is registered with more than one laundry. Choose one to continue.",
                "laundries": options,
            },
        )
    return verified[0]


@router.post("/client/auth/login")
async def client_login(
    payload: ClientLoginRequest, request: Request, finder=Depends(get_user_finder)
) -> dict:
    key = _login_key(request, payload.auth_id)
    await _check_login_throttle(key)
    try:
        user = await _authenticate_client(payload, finder)
    except HTTPException:
        # A tenant choice is a successful password check, not a failed login.
        await _clear_login_failures(key)
        raise
    if user is None:
        await _record_login_failure(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    await _clear_login_failures(key)

    scope = client_scope_for(user)
    client = {
        "auth_id": str(user.get("auth_id") or user.get("user_id") or user.get("id") or ""),
        "user_id": str(user.get("user_id") or user.get("id") or user.get("auth_id") or ""),
        "user_name": str(user.get("user_name") or ""),
        "status": str(user.get("status") or "active"),
        "role_id": str((user.get("role_ids") or ["CLIENT"])[0]),
        "laundry_id": scope["laundry_id"],
        "client_name": scope["client_name"],
        "client_type": scope["client_type"],
        "hotel_id": scope["hotel_id"],
        "shop_id": scope["shop_id"],
        "client_scope": scope,
    }
    return {"access_token": issue_token(user), "token_type": "bearer", "client": client}


@router.get("/client/auth/status")
async def client_auth_status(user=Depends(get_current_user)) -> dict:
    """Session status for hotel/shop client portals: who the token belongs to."""

    client_name = user.get("client_name") or user.get("hotel_name") or user.get("name")
    return {"client": _status_user(user, client_name)}


# Namespace aliases: the recreated-backend clients call the user-service surface
# through the same-origin proxy as `/api/user/...`, which the reverse proxy strips
# to `/user/...`. Staff and client login/status therefore exist on both surfaces.
@router.post("/user/auth/login")
async def staff_login_user(
    payload: LoginRequest, request: Request, finder=Depends(get_user_finder)
) -> dict:
    return await login(payload, request, finder)


@router.get("/user/auth/status")
async def staff_auth_status(user=Depends(get_current_user)) -> dict:
    return await auth_status(user)


@router.post("/user/client/auth/login")
async def client_login_user(
    payload: ClientLoginRequest, request: Request, finder=Depends(get_user_finder)
) -> dict:
    return await client_login(payload, request, finder)


@router.get("/user/client/auth/status")
async def client_auth_status_user(user=Depends(get_current_user)) -> dict:
    client_name = user.get("client_name") or user.get("hotel_name") or user.get("name")
    return await client_auth_status(user)
