from __future__ import annotations

import bcrypt

from ..core.security import DISABLED_STATUSES, create_access_token


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


async def authenticate(user_name: str, password: str, find_user) -> dict | None:
    user = await find_user(user_name)
    if user is None:
        return None
    if not verify_password(password, str(user.get("password_hash") or "")):
        return None
    status = str(user.get("status") or "active").strip().lower()
    if status in DISABLED_STATUSES:
        return None
    return user


def _text(value) -> str:
    return str(value).strip() if value is not None else ""


def _role_names(user: dict) -> list[str]:
    values = user.get("role_ids") or user.get("roles") or user.get("role") or []
    if isinstance(values, str):
        values = [values]
    names: list[str] = []
    for value in values:
        if isinstance(value, dict):
            value = value.get("role") or value.get("role_id") or value.get("name")
        name = _text(value)
        if name:
            names.append(name)
    return names or ["ADMIN"]


def _client_type(user: dict) -> str:
    supplied = _text(user.get("client_type")).upper()
    if supplied in {"HOTEL", "SHOP"}:
        return supplied
    roles = [name.upper() for name in _role_names(user)]
    if any("SHOP" in role for role in roles):
        return "SHOP"
    if any("HOTEL" in role for role in roles):
        return "HOTEL"
    return ""


def _is_client(user: dict) -> bool:
    return _text(user.get("token_kind")).lower() == "client" or bool(_client_type(user))


def client_scope_for(user: dict) -> dict:
    """Build the scope only from fields on the authenticated account record."""

    existing = user.get("client_scope")
    scope = dict(existing) if isinstance(existing, dict) else {}
    client_type = _client_type(user) or _text(scope.get("client_type")).upper()
    hotel_id = _text(user.get("hotel_id")) or _text(scope.get("hotel_id"))
    shop_id = _text(user.get("shop_id")) or _text(scope.get("shop_id"))
    if client_type == "HOTEL":
        shop_id = ""
    elif client_type == "SHOP":
        hotel_id = ""
    return {
        "laundry_id": _text(user.get("laundry_id"))
        or _text(user.get("organization_id"))
        or _text(scope.get("laundry_id")),
        "client_name": _text(user.get("client_name"))
        or _text(user.get("hotel_name"))
        or _text(user.get("shop_name"))
        or _text(user.get("name"))
        or _text(scope.get("client_name")),
        "client_type": client_type,
        "hotel_id": hotel_id,
        "shop_id": shop_id,
    }


def issue_token(user: dict) -> str:
    """Issue a token carrying only verified identity and tenant claims.

    Client sessions need the laundry/client pair and the side (hotel or shop)
    in the token; downstream services fail closed without it. Those values are
    copied from the account record returned by the login lookup, never from the
    login request body.
    """

    auth_id = _text(user.get("auth_id") or user.get("user_id") or user.get("id"))
    roles = _role_names(user)
    claims = {
        "sub": auth_id,
        "user_id": _text(user.get("user_id") or user.get("id")) or auth_id,
        "auth_id": auth_id,
        "user_name": _text(user.get("user_name")),
        "status": _text(user.get("status")) or "active",
        "role": roles[0],
        "role_ids": roles,
        "permissions": user.get("permissions") or [],
        "platform_admin": bool(user.get("platform_admin")) or "PLATFORM_ADMIN" in roles,
        "laundry_id": _text(user.get("laundry_id") or user.get("organization_id")),
        "organization_id": _text(user.get("organization_id") or user.get("laundry_id")),
        "organization_ids": user.get("organization_ids") or user.get("laundries") or [],
        "hotel_id": _text(user.get("hotel_id")),
        "hotels": user.get("hotels") or [],
        "shop_id": _text(user.get("shop_id")),
        "shops": user.get("shops") or [],
    }
    if user.get("token_version") is not None:
        claims["token_version"] = user["token_version"]

    if _is_client(user):
        scope = client_scope_for(user)
        claims["token_kind"] = "client"
        claims["client_scope"] = scope
        claims["client_name"] = scope["client_name"]
        claims["client_type"] = scope["client_type"]
        claims["hotel_id"] = scope["hotel_id"]
        claims["shop_id"] = scope["shop_id"]
        claims["platform_admin"] = False
    return create_access_token(claims)
