"""Quotation persistence: protocol + in-memory and Mongo adapters.

Legacy parity: quotations and ``garment_tags`` collections, envelope-encrypted
sensitive fields, and the same tag-code minting. The replication bookkeeping
(``bump_version`` / ``enqueue_sync``) of the legacy repo is intentionally not
included here — it belongs to the sync-worker backlog item.
"""
from __future__ import annotations

import secrets
from typing import Any, Optional, Protocol

from ...core.clock import utcnow
from ...core.crypto import decrypt_dict, encrypt_dict

SENSITIVE_FIELDS = ["client_name", "quotation_title", "line_items"]


class QuotationRepository(Protocol):
    async def get_all(self) -> list[dict]: ...
    async def get_by_id(self, quotation_id: str) -> dict | None: ...
    async def get_by_tag(self, tag: str) -> list[dict]: ...
    async def create(self, data: dict) -> dict: ...
    async def update(self, quotation_id: str, data: dict) -> dict | None: ...
    async def delete(self, quotation_id: str) -> bool: ...
    async def create_tags(
        self, quotation_id: str, count: int, per_item: bool, label: Optional[str]
    ) -> list[dict] | None: ...
    async def list_tags(self, quotation_id: str) -> list[dict]: ...
    async def get_tag(self, code: str) -> dict | None: ...


class InMemoryQuotationRepository:
    """Hermetic repository used by tests."""

    def __init__(self) -> None:
        self._items: dict[str, dict] = {}
        self._tags: dict[str, dict] = {}
        self._seq = 0
        self._tag_seq = 0

    def _next_id(self) -> str:
        self._seq += 1
        return str(self._seq)

    async def get_all(self) -> list[dict]:
        docs = [dict(d) for d in self._items.values()]
        docs.sort(key=lambda d: d.get("created_at") or "", reverse=True)
        return docs

    async def get_by_id(self, quotation_id: str) -> dict | None:
        doc = self._items.get(str(quotation_id))
        return dict(doc) if doc else None

    async def get_by_tag(self, tag: str) -> list[dict]:
        docs = [dict(d) for d in self._items.values() if d.get("tag") == tag]
        docs.sort(key=lambda d: d.get("created_at") or "", reverse=True)
        return docs

    async def create(self, data: dict) -> dict:
        now = utcnow()
        stored = {
            "client_name": data["client_name"],
            "quotation_title": data.get("quotation_title"),
            "line_items": data.get("line_items", []),
            "status": data.get("status", "draft"),
            "status_history": data.get("status_history", []),
            "tag": data.get("tag", "shop"),
            "created_at": now,
            "updated_at": now,
        }
        stored["id"] = self._next_id()
        self._items[str(stored["id"])] = stored
        return dict(stored)

    async def update(self, quotation_id: str, data: dict) -> dict | None:
        doc = self._items.get(str(quotation_id))
        if doc is None:
            return None
        doc.update(data)
        doc["updated_at"] = utcnow()
        return dict(doc)

    async def delete(self, quotation_id: str) -> bool:
        return self._items.pop(str(quotation_id), None) is not None

    async def create_tags(
        self, quotation_id: str, count: int, per_item: bool, label: Optional[str]
    ) -> list[dict] | None:
        q = await self.get_by_id(quotation_id)
        if q is None:
            return None
        items = q.get("line_items") or []
        specs: list[tuple] = []
        if per_item and items:
            for it in items:
                specs.append((str(it["id"]) if it.get("id") is not None else None, it.get("item_name")))
        else:
            for _ in range(max(1, int(count or 1))):
                specs.append((None, label))

        created = []
        now = utcnow()
        for lid, lab in specs:
            code = await self._gen_tag_code()
            self._tag_seq += 1
            doc = {
                "id": str(self._tag_seq),
                "code": code,
                "quotation_id": str(quotation_id),
                "line_item_id": lid,
                "label": lab,
                "created_at": now,
            }
            self._tags[code] = doc
            created.append(dict(doc))
        return created

    async def _gen_tag_code(self) -> str:
        while True:
            code = secrets.token_urlsafe(6)
            if code not in self._tags:
                return code

    async def list_tags(self, quotation_id: str) -> list[dict]:
        out = [dict(d) for d in self._tags.values() if d["quotation_id"] == str(quotation_id)]
        out.sort(key=lambda d: d.get("created_at") or "")
        return out

    async def get_tag(self, code: str) -> dict | None:
        doc = self._tags.get(code)
        return dict(doc) if doc else None


class MongoQuotationRepository:
    """Motor-backed repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._col = db["quotations"]
        self._tags = db["garment_tags"]

    @staticmethod
    def _oid(value: str) -> Optional[Any]:
        from bson import ObjectId

        try:
            return ObjectId(value)
        except Exception:
            return None

    def _serialize(self, doc: dict | None) -> dict | None:
        if not doc:
            return None
        doc = decrypt_dict(doc, SENSITIVE_FIELDS)
        if "_id" in doc:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
        return doc

    async def get_all(self) -> list[dict]:
        cursor = self._col.find().sort("created_at", -1)
        out = []
        async for doc in cursor:
            out.append(self._serialize(doc))
        return out

    async def get_by_id(self, quotation_id: str) -> dict | None:
        oid = self._oid(quotation_id)
        if oid is None:
            return None
        return self._serialize(await self._col.find_one({"_id": oid}))

    async def get_by_tag(self, tag: str) -> list[dict]:
        cursor = self._col.find({"tag": tag}).sort("created_at", -1)
        out = []
        async for doc in cursor:
            out.append(self._serialize(doc))
        return out

    async def create(self, data: dict) -> dict:
        now = utcnow()
        document = {
            "client_name": data["client_name"],
            "quotation_title": data.get("quotation_title"),
            "line_items": data.get("line_items", []),
            "status": data.get("status", "draft"),
            "status_history": data.get("status_history", []),
            "tag": data.get("tag", "shop"),
            "created_at": now,
            "updated_at": now,
        }
        encrypted = encrypt_dict(document, SENSITIVE_FIELDS)
        result = await self._col.insert_one(encrypted)
        encrypted["_id"] = result.inserted_id
        return self._serialize(encrypted)

    async def update(self, quotation_id: str, data: dict) -> dict | None:
        oid = self._oid(quotation_id)
        if oid is None:
            return None
        original = await self._col.find_one({"_id": oid})
        if not original:
            return None
        decrypted = decrypt_dict(original, SENSITIVE_FIELDS)
        decrypted.update(data)
        decrypted.pop("created_at", None)
        decrypted.pop("_id", None)
        decrypted["updated_at"] = utcnow()
        encrypted = encrypt_dict(decrypted, SENSITIVE_FIELDS)
        result = await self._col.find_one_and_update(
            {"_id": oid}, {"$set": encrypted}, return_document=True
        )
        if not result:
            return None
        return self._serialize(result)

    async def delete(self, quotation_id: str) -> bool:
        oid = self._oid(quotation_id)
        if oid is None:
            return False
        res = await self._col.delete_one({"_id": oid})
        return res.deleted_count > 0

    async def create_tags(
        self, quotation_id: str, count: int, per_item: bool, label: Optional[str]
    ) -> list[dict] | None:
        q = await self.get_by_id(quotation_id)
        if q is None:
            return None
        items = q.get("line_items") or []
        specs: list[tuple] = []
        if per_item and items:
            for it in items:
                specs.append((str(it["id"]) if it.get("id") is not None else None, it.get("item_name")))
        else:
            for _ in range(max(1, int(count or 1))):
                specs.append((None, label))

        created = []
        now = utcnow()
        for lid, lab in specs:
            code = await self._gen_tag_code()
            doc = {
                "code": code,
                "quotation_id": str(quotation_id),
                "line_item_id": lid,
                "label": lab,
                "created_at": now,
            }
            result = await self._tags.insert_one(doc)
            doc["id"] = str(result.inserted_id)
            doc.pop("_id", None)
            created.append(doc)
        return created

    async def _gen_tag_code(self) -> str:
        while True:
            code = secrets.token_urlsafe(6)
            if await self._tags.find_one({"code": code}) is None:
                return code

    async def list_tags(self, quotation_id: str) -> list[dict]:
        out = []
        cursor = self._tags.find({"quotation_id": str(quotation_id)}).sort("created_at", 1)
        async for d in cursor:
            d["id"] = str(d.pop("_id"))
            out.append(d)
        return out

    async def get_tag(self, code: str) -> dict | None:
        d = await self._tags.find_one({"code": code})
        if not d:
            return None
        d["id"] = str(d.pop("_id"))
        return d
