"""Auth/users business logic.

Guarantees (legacy parity):
  - passwords are stored bcrypt-hashed and never returned;
  - login issues an HS256 JWT carrying ``auth_id``/``role``/``user_name``;
  - disabled/deleted accounts cannot log in and are rejected on every request.
"""
from __future__ import annotations

import uuid

import bcrypt
from fastapi import HTTPException, status

from ...core.security import DISABLED_STATUSES, create_access_token
from .repository import UserRepository


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def public_user(doc: dict) -> dict:
    """Strip the password (and any private field) before returning to a client."""
    return {k: v for k, v in doc.items() if k != "password"}


class AuthService:
    def __init__(self, repo: UserRepository) -> None:
        self.repo = repo

    async def login(self, user_name: str, password: str) -> tuple[str, dict]:
        user = await self.repo.get_by_user_name(user_name)
        if user is None or not verify_password(password, user.get("password", "")):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "Invalid username or password"
            )
        if str(user.get("status") or "unset").strip().lower() in DISABLED_STATUSES:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "This account has been deactivated. Contact an administrator.",
            )
        token = create_access_token(
            {
                "auth_id": user.get("auth_id"),
                "sub": str(user.get("id")),
                "role": str(user.get("role_id") or "").upper(),
                "user_name": user.get("user_name"),
            }
        )
        return token, public_user(user)

    async def create_user(self, data: dict) -> dict:
        if await self.repo.get_by_user_name(data["user_name"]) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "user_name already exists")
        email = data.get("email")
        if email and await self.repo.get_by_email(email) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "email already exists")

        doc = dict(data)
        doc["password"] = hash_password(doc.pop("password"))
        doc["auth_id"] = doc.get("auth_id") or uuid.uuid4().hex
        created = await self.repo.create(doc)
        return public_user(created)

    async def list_users(self, limit: int, offset: int) -> list[dict]:
        return [public_user(u) for u in await self.repo.list(limit=limit, offset=offset)]

    async def get_user(self, user_id: str) -> dict:
        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(user)

    async def get_by_auth_id(self, auth_id: str) -> dict:
        user = await self.repo.get_by_auth_id(auth_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(user)

    async def get_by_email(self, email: str) -> dict:
        user = await self.repo.get_by_email(email)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(user)

    async def get_by_employee_id(self, employee_id: str) -> dict:
        user = await self.repo.get_by_employee_id(employee_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(user)

    async def count(self) -> int:
        return await self.repo.count()

    async def update_user(self, user_id: str, changes: dict) -> dict:
        clean = {k: v for k, v in changes.items() if v is not None}
        if not clean:
            return await self.get_user(user_id)
        updated = await self.repo.update(user_id, clean)
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(updated)

    async def update_profile(self, user_id: str, changes: dict) -> dict:
        return await self.update_user(user_id, changes)

    async def set_status(self, user_id: str, new_status: str) -> dict:
        updated = await self.repo.update(user_id, {"status": new_status})
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return public_user(updated)

    async def change_password(self, user_id: str, new_password: str) -> dict:
        updated = await self.repo.update(user_id, {"password": hash_password(new_password)})
        if updated is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return {"status": "password_updated", "id": updated.get("id")}

    async def delete_user(self, user_id: str) -> dict:
        deleted = await self.repo.delete(user_id)
        if not deleted:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
        return {"status": "deleted", "id": user_id}
