"""Laundry-management persistence: a generic, encrypted, collection-oriented
repository shared by the entity resources.

The legacy service spread the same serialize/decrypt/encrypt dance across ~15
routers. Here it is centralised: every read decrypts + strips ``_id``/``_search``
and exposes ``id``; every write encrypts the resource's sensitive fields.
"""
from __future__ import annotations

from typing import Any, Optional, Protocol

from ...core.clock import utcnow
from ...core.crypto import decrypt_dict, encrypt_dict


def serialize(doc: dict | None, sensitive: list[str]) -> dict | None:
    """Decrypt + normalise a stored document to the API shape."""
    if doc is None:
        return None
    if "encryption_metadata" in doc:
        try:
            decrypted = decrypt_dict(doc, sensitive)
        except (ValueError, KeyError):
            decrypted = {
                k: v
                for k, v in doc.items()
                if k != "encryption_metadata" and not k.endswith("_search")
            }
    else:
        decrypted = {k: v for k, v in doc.items() if not k.endswith("_search")}

    result: dict = {}
    for key, val in decrypted.items():
        if key == "_id":
            result["id"] = str(val)
        else:
            result[key] = val
    return result


class LaundryRepository(Protocol):
    async def list(
        self,
        collection: str,
        sensitive: list[str],
        query: dict | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[dict], int]: ...
    async def get(self, collection: str, sensitive: list[str], oid: str) -> dict | None: ...
    async def create(self, collection: str, sensitive: list[str], doc: dict) -> dict: ...
    async def update(
        self, collection: str, sensitive: list[str], oid: str, changes: dict
    ) -> dict | None: ...
    async def delete(self, collection: str, oid: str) -> bool: ...
    async def count(self, collection: str, query: dict | None = None) -> int: ...
    async def all_docs(
        self, collection: str, sensitive: list[str], query: dict | None = None
    ) -> list[dict]: ...


class InMemoryLaundryRepository:
    """Hermetic repository used by tests."""

    def __init__(self) -> None:
        self._data: dict[str, dict[str, dict]] = {}
        self._seq: dict[str, int] = {}

    def _next_id(self, collection: str) -> str:
        self._seq[collection] = self._seq.get(collection, 0) + 1
        return str(self._seq[collection])

    def _bucket(self, collection: str) -> dict[str, dict]:
        return self._data.setdefault(collection, {})

    async def list(
        self,
        collection: str,
        sensitive: list[str],
        query: dict | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[dict], int]:
        docs = [d for d in self._bucket(collection).values() if _matches(d, query)]
        docs.sort(key=lambda d: _sort_key(d, sort), reverse=bool(sort and sort[0][1] == -1))
        total = len(docs)
        page = docs[skip : skip + limit]
        return [serialize(dict(d), sensitive) for d in page], total

    async def get(self, collection: str, sensitive: list[str], oid: str) -> dict | None:
        doc = self._bucket(collection).get(str(oid))
        return serialize(dict(doc), sensitive) if doc else None

    async def create(self, collection: str, sensitive: list[str], doc: dict) -> dict:
        stored = dict(doc)
        stored["id"] = self._next_id(collection)
        stored.setdefault("created_at", utcnow())
        stored["updated_at"] = utcnow()
        self._bucket(collection)[stored["id"]] = stored
        return serialize(dict(stored), sensitive)

    async def update(
        self, collection: str, sensitive: list[str], oid: str, changes: dict
    ) -> dict | None:
        doc = self._bucket(collection).get(str(oid))
        if doc is None:
            return None
        doc.update(changes)
        doc["updated_at"] = utcnow()
        return serialize(dict(doc), sensitive)

    async def delete(self, collection: str, oid: str) -> bool:
        return self._bucket(collection).pop(str(oid), None) is not None

    async def count(self, collection: str, query: dict | None = None) -> int:
        return len([d for d in self._bucket(collection).values() if _matches(d, query)])

    async def all_docs(
        self, collection: str, sensitive: list[str], query: dict | None = None
    ) -> list[dict]:
        docs = [d for d in self._bucket(collection).values() if _matches(d, query)]
        return [serialize(dict(d), sensitive) for d in docs]


class MongoLaundryRepository:
    """Motor-backed repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._db = db

    @staticmethod
    def _oid(value: str):
        from bson import ObjectId

        return ObjectId(value) if ObjectId.is_valid(value) else None

    async def list(
        self,
        collection: str,
        sensitive: list[str],
        query: dict | None = None,
        sort: list[tuple] | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[dict], int]:
        col = self._db[collection]
        query = query or {}
        total = await col.count_documents(query)
        cursor = col.find(query)
        if sort:
            cursor = cursor.sort(sort)
        cursor = cursor.skip(skip).limit(limit)
        return [serialize(d, sensitive) async for d in cursor], total

    async def get(self, collection: str, sensitive: list[str], oid: str) -> dict | None:
        o = self._oid(oid)
        if o is None:
            return None
        return serialize(await self._db[collection].find_one({"_id": o}), sensitive)

    async def create(self, collection: str, sensitive: list[str], doc: dict) -> dict:
        now = utcnow()
        document = {**doc, "created_at": now, "updated_at": now}
        encrypted = encrypt_dict(document, sensitive)
        result = await self._db[collection].insert_one(encrypted)
        encrypted["_id"] = result.inserted_id
        return serialize(encrypted, sensitive)

    async def update(
        self, collection: str, sensitive: list[str], oid: str, changes: dict
    ) -> dict | None:
        o = self._oid(oid)
        if o is None:
            return None
        original = await self._db[collection].find_one({"_id": o})
        if not original:
            return None
        decrypted = decrypt_dict(original, sensitive)
        decrypted.update(changes)
        decrypted.pop("created_at", None)
        decrypted.pop("_id", None)
        decrypted["updated_at"] = utcnow()
        encrypted = encrypt_dict(decrypted, sensitive)
        result = await self._db[collection].find_one_and_update(
            {"_id": o}, {"$set": encrypted}, return_document=True
        )
        if not result:
            return None
        return serialize(result, sensitive)

    async def delete(self, collection: str, oid: str) -> bool:
        o = self._oid(oid)
        if o is None:
            return False
        res = await self._db[collection].delete_one({"_id": o})
        return res.deleted_count > 0

    async def count(self, collection: str, query: dict | None = None) -> int:
        return await self._db[collection].count_documents(query or {})

    async def all_docs(
        self, collection: str, sensitive: list[str], query: dict | None = None
    ) -> list[dict]:
        cursor = self._db[collection].find(query or {})
        return [serialize(d, sensitive) async for d in cursor]


def _sort_key(doc: dict, sort: list[tuple] | None):
    if not sort:
        return str(doc.get("created_at") or "")
    field = sort[0][0]
    return str(doc.get(field) or "")


def _matches(doc: dict, query: dict | None) -> bool:
    if not query:
        return True
    for key, cond in query.items():
        val = doc.get(key)
        if isinstance(cond, dict):
            if "$gte" in cond and not (str(val or "") >= str(cond["$gte"])):
                return False
            if "$lte" in cond and not (str(val or "") <= str(cond["$lte"])):
                return False
            if "$ne" in cond and val == cond["$ne"]:
                return False
            if "$in" in cond and val not in cond["$in"]:
                return False
        elif val != cond:
            return False
    return True
