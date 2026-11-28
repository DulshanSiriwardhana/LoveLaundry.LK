"""Tenant-scoped reads and writes for the operational collections.

The client portal and the older staff apps were built against a document model
that stores gate passes, deliveries, bills, shop bills and linen events in
named collections. This repository is the single place that knows which logical
database owns each collection, so routers never hardcode a connection or mix
linen records with billing records.
"""

from __future__ import annotations

import inspect
from typing import Any, Iterable

from ..db.connection import DatabaseKind, get_database

LAUNDRY_COLLECTIONS = frozenset(
    {"gatepasses", "deliveries", "bills", "shop_bills", "payments", "bill_templates"}
)
LINEN_COLLECTIONS = frozenset({"linens", "linen_events", "linen_tag_sequences"})


def _document_ids(value: str) -> list[Any]:
    """Accept both string ids in memory and ObjectIds in MongoDB."""

    text = str(value or "")
    candidates: list[Any] = [text]
    try:
        from bson import ObjectId

        parsed = ObjectId(text)
        if parsed not in candidates:
            candidates.append(parsed)
    except Exception:
        pass
    return candidates


class OperationalRepository:
    def __init__(self, laundry_database=None, linen_database=None) -> None:
        self._laundry = laundry_database
        self._linen = linen_database

    def _database(self, name: str):
        if name in LAUNDRY_COLLECTIONS:
            if self._laundry is None:
                self._laundry = get_database(DatabaseKind.LAUNDRY_INTERNAL)
            return self._laundry
        if name in LINEN_COLLECTIONS:
            if self._linen is None:
                self._linen = get_database(DatabaseKind.LINEN_TRACKING)
            return self._linen
        raise ValueError(f"Unknown operational collection: {name}")

    def collection(self, name: str):
        return self._database(name)[name]

    @staticmethod
    def id_query(value: str, **extra) -> dict:
        return {"_id": {"$in": _document_ids(value)}, **extra}

    async def count(self, name: str, query: dict | None = None) -> int:
        return int(await self.collection(name).count_documents(query or {}))

    async def list(
        self,
        name: str,
        query: dict | None = None,
        *,
        sort: str | Iterable[tuple[str, int]] | None = None,
        direction: int = -1,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        cursor = self.collection(name).find(query or {})
        if inspect.isawaitable(cursor):
            cursor = await cursor
        if sort:
            cursor = (
                cursor.sort(sort, direction)
                if isinstance(sort, str)
                else cursor.sort(list(sort))
            )
        if skip:
            cursor = cursor.skip(skip)
        rows = cursor.to_list(length=limit)
        if inspect.isawaitable(rows):
            rows = await rows
        return [dict(row) for row in rows]

    async def find_one(
        self,
        name: str,
        query: dict | None = None,
        *,
        sort: str | Iterable[tuple[str, int]] | None = None,
        direction: int = -1,
    ) -> dict | None:
        collection = self.collection(name)
        if hasattr(collection, "find_one"):
            kwargs = {}
            if sort:
                kwargs["sort"] = (
                    [(sort, direction)]
                    if isinstance(sort, str)
                    else list(sort)
                )
            row = collection.find_one(query or {}, **kwargs)
            if hasattr(row, "__await__"):
                row = await row
            return dict(row) if row is not None else None
        rows = await self.list(name, query, sort=sort, direction=direction, limit=1)
        return rows[0] if rows else None

    async def by_id(self, name: str, document_id: str, **extra) -> dict | None:
        return await self.find_one(name, self.id_query(document_id, **extra))

    async def insert(self, name: str, document: dict) -> dict:
        result = await self.collection(name).insert_one(dict(document))
        saved = dict(document)
        inserted_id = getattr(result, "inserted_id", None)
        if inserted_id is not None:
            saved["_id"] = inserted_id
        return saved

    async def update(
        self, name: str, query: dict, update: dict, *, upsert: bool = False
    ) -> None:
        await self.collection(name).update_one(query, update, upsert=upsert)

    async def next_sequence(self, key: str, start: int = 1) -> int:
        """Return the next unique tag sequence for one registry-derived scope."""

        result = await self.collection("linen_tag_sequences").find_one_and_update(
            {"scope_key": key},
            {
                "$inc": {"sequence": 1},
                "$setOnInsert": {"scope_key": key},
            },
            upsert=True,
            return_document=True,
        )
        if hasattr(result, "__await__"):
            result = await result
        sequence = int((result or {}).get("sequence") or start)
        return max(start, sequence)
