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


def issue_token(user: dict) -> str:
    auth_id = str(user.get("auth_id") or user.get("user_id") or user.get("id") or "")
    claims = {
        "sub": auth_id,
        "user_id": user.get("user_id") or user.get("id") or auth_id,
        "auth_id": auth_id,
        "user_name": user.get("user_name", ""),
        "status": user.get("status", "active"),
        "role": (user.get("role_ids") or ["ADMIN"])[0],
        "role_ids": user.get("role_ids") or [],
        "permissions": user.get("permissions") or [],
        "platform_admin": "PLATFORM_ADMIN" in (user.get("role_ids") or []),
        "laundry_id": user.get("laundry_id") or user.get("organization_id") or "",
        "organization_id": user.get("organization_id") or user.get("laundry_id") or "",
    }
    return create_access_token(claims)
