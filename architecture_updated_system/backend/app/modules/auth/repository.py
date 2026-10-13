"""User persistence: protocol + in-memory and Mongo adapters.

Documents keep the legacy ``users`` shape. ``password`` is stored hashed and is
stripped from every public read in the service layer. Mongo updates never send
the immutable ``_id`` in ``$set`` (legacy bug fixed).
"""
from __future__ import annotations

from typing import Any, Protocol

from ...core.clock import utcnow


class UserRepository(Protocol):
    async def get_by_auth_id(self, auth_id: str) -> dict | None: ...
    async def get_by_id(self, user_id: str) -> dict | None: ...
    async def get_by_user_name(self, user_name: str) -> dict | None: ...
    async def get_by_email(self, email: str) -> dict | None: ...
    async def get_by_employee_id(self, employee_id: str) -> dict | None: ...
    async def list(self, limit: int = 100, offset: int = 0) -> list[dict]: ...
    async def count(self) -> int: ...
    async def create(self, doc: dict) -> dict: ...
    async def update(self, user_id: str, changes: dict) -> dict | None: ...
    async def delete(self, user_id: str) -> bool: ...


class InMemoryUserRepository:
    """Hermetic repository used by tests (no external services)."""

    def __init__(self) -> None:
        self._by_id: dict[str, dict] = {}
        self._seq = 0

    async def get_by_auth_id(self, auth_id: str) -> dict | None:
        for doc in self._by_id.values():
            if doc.get("auth_id") == auth_id:
                return dict(doc)
        return None

    async def get_by_id(self, user_id: str) -> dict | None:
        doc = self._by_id.get(str(user_id))
        return dict(doc) if doc else None

    async def get_by_user_name(self, user_name: str) -> dict | None:
        for doc in self._by_id.values():
            if doc.get("user_name") == user_name:
                return dict(doc)
        return None

    async def get_by_email(self, email: str) -> dict | None:
        for doc in self._by_id.values():
            if doc.get("email") == email:
                return dict(doc)
        return None

    async def get_by_employee_id(self, employee_id: str) -> dict | None:
        for doc in self._by_id.values():
            if doc.get("employee_id") == employee_id:
                return dict(doc)
        return None

    async def list(self, limit: int = 100, offset: int = 0) -> list[dict]:
        docs = sorted(self._by_id.values(), key=lambda d: d["id"])
        return [dict(d) for d in docs[offset : offset + limit]]

    async def count(self) -> int:
        return len(self._by_id)

    async def create(self, doc: dict) -> dict:
        self._seq += 1
        stored = dict(doc)
        stored["id"] = self._seq
        stored.setdefault("created_at", utcnow())
        stored["updated_at"] = utcnow()
        self._by_id[str(stored["id"])] = stored
        return dict(stored)

    async def update(self, user_id: str, changes: dict) -> dict | None:
        doc = self._by_id.get(str(user_id))
        if doc is None:
            return None
        doc.update(changes)
        doc["updated_at"] = utcnow()
        return dict(doc)

    async def delete(self, user_id: str) -> bool:
        return self._by_id.pop(str(user_id), None) is not None


class MongoUserRepository:
    """Motor-backed repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._col = db["users"]

    @staticmethod
    def _clean(doc: dict | None) -> dict | None:
        if doc is None:
            return None
        out = dict(doc)
        out.pop("_id", None)
        out.setdefault("id", doc.get("id"))
        return out

    async def get_by_auth_id(self, auth_id: str) -> dict | None:
        return self._clean(await self._col.find_one({"auth_id": auth_id}))

    async def get_by_id(self, user_id: str) -> dict | None:
        try:
            key: Any = int(user_id)
        except (TypeError, ValueError):
            key = user_id
        return self._clean(await self._col.find_one({"id": key}))

    async def get_by_user_name(self, user_name: str) -> dict | None:
        return self._clean(await self._col.find_one({"user_name": user_name}))

    async def get_by_email(self, email: str) -> dict | None:
        return self._clean(await self._col.find_one({"email": email}))

    async def get_by_employee_id(self, employee_id: str) -> dict | None:
        return self._clean(await self._col.find_one({"employee_id": employee_id}))

    async def list(self, limit: int = 100, offset: int = 0) -> list[dict]:
        cursor = self._col.find({}).sort("id", 1).skip(offset).limit(limit)
        return [self._clean(d) async for d in cursor]

    async def count(self) -> int:
        return await self._col.count_documents({})

    async def create(self, doc: dict) -> dict:
        payload = dict(doc)
        payload.pop("_id", None)
        if payload.get("id") is None:
            payload["id"] = await self._next_id()
        payload.setdefault("created_at", utcnow())
        payload["updated_at"] = utcnow()
        await self._col.insert_one(payload)
        return self._clean(payload)

    async def _next_id(self) -> int:
        last = await self._col.find_one({}, sort=[("id", -1)])
        return int((last or {}).get("id", 0)) + 1

    async def update(self, user_id: str, changes: dict) -> dict | None:
        try:
            key: Any = int(user_id)
        except (TypeError, ValueError):
            key = user_id
        changes = dict(changes)
        changes.pop("_id", None)  # immutable in Mongo
        changes["updated_at"] = utcnow()
        await self._col.update_one({"id": key}, {"$set": changes})
        return await self.get_by_id(str(user_id))

    async def delete(self, user_id: str) -> bool:
        try:
            key: Any = int(user_id)
        except (TypeError, ValueError):
            key = user_id
        res = await self._col.delete_one({"id": key})
        return res.deleted_count > 0
