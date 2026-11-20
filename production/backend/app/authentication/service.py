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
    return create_access_token({"sub": user["auth_id"], "role_ids": user.get("role_ids") or []})
