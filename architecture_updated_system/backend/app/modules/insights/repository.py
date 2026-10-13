"""Insights data access: protocol + in-memory and Mongo adapters.

Deliberately generic (``find`` over named collections) because the legacy
love-ai service reads several laundry-management collections in a read-only
fashion.
"""
from __future__ import annotations

from typing import Any, Optional, Protocol


class InsightsRepository(Protocol):
    async def find(
        self, collection: str, query: dict | None = None, projection: dict | None = None
    ) -> list[dict]: ...
    async def ping(self) -> bool: ...


class InMemoryInsightsRepository:
    """Hermetic repository used by tests; seed collections with ``add``."""

    def __init__(self) -> None:
        self._data: dict[str, list[dict]] = {}

    def add(self, collection: str, doc: dict) -> None:
        self._data.setdefault(collection, []).append(doc)

    async def find(
        self, collection: str, query: dict | None = None, projection: dict | None = None
    ) -> list[dict]:
        docs = self._data.get(collection, [])
        if not query:
            return [dict(d) for d in docs]
        out = []
        for d in docs:
            if _matches(d, query):
                out.append(dict(d))
        return out

    async def ping(self) -> bool:
        return True


def _matches(doc: dict, query: dict) -> bool:
    for key, cond in query.items():
        val = doc.get(key)
        if isinstance(cond, dict):
            if "$ne" in cond and val == cond["$ne"]:
                return False
            if "$gt" in cond and not (isinstance(val, (int, float)) and val > cond["$gt"]):
                return False
        elif val != cond:
            return False
    return True


class MongoInsightsRepository:
    """Motor-backed read-only repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._db = db

    async def find(
        self, collection: str, query: dict | None = None, projection: dict | None = None
    ) -> list[dict]:
        cursor = self._db[collection].find(query or {}, projection)
        return [dict(d) async for d in cursor]

    async def ping(self) -> bool:
        try:
            await self._db.command("ping")
            return True
        except Exception:
            return False
