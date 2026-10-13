"""Worker persistence: protocol + in-memory and Mongo adapters.

Mongo documents keep the legacy shape and envelope-encrypt sensitive fields
with the shared crypto helpers, plus a deterministic ``worker_name_search``
token for exact-match lookups. Updates never send ``_id`` in ``$set``.
"""
from __future__ import annotations

from typing import Any, Optional, Protocol

from ...core.clock import utcnow
from ...core.crypto import decrypt_dict, encrypt_dict, get_search_token

WORKER_SENSITIVE_FIELDS = ["worker_name", "phone", "notes"]
LOG_SENSITIVE_FIELDS = [
    "worker_name",
    "tasks",
    "machines_used",
    "chemicals_used",
    "quality_notes",
    "notes",
]


class WorkerRepository(Protocol):
    async def get_all_workers(self, active_only: bool = False) -> list[dict]: ...
    async def get_worker_by_id(self, worker_id: str) -> dict | None: ...
    async def create_worker(self, data: dict) -> dict: ...
    async def update_worker(self, worker_id: str, data: dict) -> dict | None: ...
    async def delete_worker(self, worker_id: str) -> bool: ...

    async def get_all_logs(
        self,
        work_date: Optional[str] = None,
        worker_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> list[dict]: ...
    async def get_log_by_id(self, log_id: str) -> dict | None: ...
    async def create_log(self, data: dict) -> dict: ...
    async def update_log(self, log_id: str, data: dict) -> dict | None: ...
    async def delete_log(self, log_id: str) -> bool: ...


def _norm_tasks(doc: dict) -> dict:
    for t in doc.get("tasks", []) or []:
        if isinstance(t, dict):
            t.setdefault("unit", "PIECES")
    return doc


class InMemoryWorkerRepository:
    """Hermetic repository used by tests (no external services)."""

    def __init__(self) -> None:
        self._workers: dict[str, dict] = {}
        self._logs: dict[str, dict] = {}
        self._seq = 0

    def _next_id(self) -> str:
        self._seq += 1
        return str(self._seq)

    # ── Workers ──
    async def get_all_workers(self, active_only: bool = False) -> list[dict]:
        docs = [dict(d) for d in self._workers.values()]
        if active_only:
            docs = [d for d in docs if d.get("is_active")]
        docs.sort(key=lambda d: str(d.get("worker_name", "")))
        return docs

    async def get_worker_by_id(self, worker_id: str) -> dict | None:
        doc = self._workers.get(str(worker_id))
        return dict(doc) if doc else None

    async def create_worker(self, data: dict) -> dict:
        stored = dict(data)
        stored["id"] = self._next_id()
        stored["created_at"] = utcnow()
        stored["updated_at"] = utcnow()
        self._workers[str(stored["id"])] = stored
        return dict(stored)

    async def update_worker(self, worker_id: str, data: dict) -> dict | None:
        doc = self._workers.get(str(worker_id))
        if doc is None:
            return None
        doc.update(data)
        doc["updated_at"] = utcnow()
        return dict(doc)

    async def delete_worker(self, worker_id: str) -> bool:
        return self._workers.pop(str(worker_id), None) is not None

    # ── Daily logs ──
    async def get_all_logs(
        self,
        work_date: Optional[str] = None,
        worker_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> list[dict]:
        docs = [dict(d) for d in self._logs.values()]
        if work_date:
            docs = [d for d in docs if d.get("work_date") == work_date]
        else:
            if date_from:
                docs = [d for d in docs if str(d.get("work_date", "")) >= date_from]
            if date_to:
                docs = [d for d in docs if str(d.get("work_date", "")) <= date_to]
        if worker_name:
            docs = [d for d in docs if d.get("worker_name") == worker_name]
        docs.sort(key=lambda d: (str(d.get("work_date", "")), str(d.get("worker_name", ""))), reverse=True)
        return docs

    async def get_log_by_id(self, log_id: str) -> dict | None:
        doc = self._logs.get(str(log_id))
        return _norm_tasks(dict(doc)) if doc else None

    async def create_log(self, data: dict) -> dict:
        stored = dict(data)
        stored["id"] = self._next_id()
        stored["created_at"] = utcnow()
        stored["updated_at"] = utcnow()
        self._logs[str(stored["id"])] = stored
        return _norm_tasks(dict(stored))

    async def update_log(self, log_id: str, data: dict) -> dict | None:
        doc = self._logs.get(str(log_id))
        if doc is None:
            return None
        doc.update(data)
        doc["updated_at"] = utcnow()
        return _norm_tasks(dict(doc))

    async def delete_log(self, log_id: str) -> bool:
        return self._logs.pop(str(log_id), None) is not None


class MongoWorkerRepository:
    """Motor-backed repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._workers = db["workers"]
        self._logs = db["daily_task_logs"]

    @staticmethod
    def _oid(value: str) -> Optional[Any]:
        from bson import ObjectId

        try:
            return ObjectId(value)
        except Exception:
            return None

    def _serialize(self, doc: dict | None, sensitive: list[str]) -> dict | None:
        if not doc:
            return None
        doc = decrypt_dict(doc, sensitive)
        if "_id" in doc:
            doc["id"] = str(doc["_id"])
            doc.pop("_id", None)
        return doc

    # ── Workers ──
    async def get_all_workers(self, active_only: bool = False) -> list[dict]:
        query = {"is_active": True} if active_only else {}
        cursor = self._workers.find(query).sort("worker_name", 1)
        out = []
        async for doc in cursor:
            out.append(self._serialize(doc, WORKER_SENSITIVE_FIELDS))
        return out

    async def get_worker_by_id(self, worker_id: str) -> dict | None:
        oid = self._oid(worker_id)
        if oid is None:
            return None
        return self._serialize(await self._workers.find_one({"_id": oid}), WORKER_SENSITIVE_FIELDS)

    async def create_worker(self, data: dict) -> dict:
        now = utcnow()
        document = {**data, "created_at": now, "updated_at": now}
        encrypted = encrypt_dict(document, WORKER_SENSITIVE_FIELDS)
        result = await self._workers.insert_one(encrypted)
        encrypted["_id"] = result.inserted_id
        return self._serialize(encrypted, WORKER_SENSITIVE_FIELDS)

    async def update_worker(self, worker_id: str, data: dict) -> dict | None:
        oid = self._oid(worker_id)
        if oid is None:
            return None
        original = await self._workers.find_one({"_id": oid})
        if not original:
            return None
        decrypted = decrypt_dict(original, WORKER_SENSITIVE_FIELDS)
        decrypted.update(data)
        decrypted.pop("created_at", None)
        decrypted.pop("_id", None)
        decrypted["updated_at"] = utcnow()
        encrypted = encrypt_dict(decrypted, WORKER_SENSITIVE_FIELDS)
        result = await self._workers.find_one_and_update(
            {"_id": oid}, {"$set": encrypted}, return_document=True
        )
        if not result:
            return None
        return self._serialize(result, WORKER_SENSITIVE_FIELDS)

    async def delete_worker(self, worker_id: str) -> bool:
        oid = self._oid(worker_id)
        if oid is None:
            return False
        res = await self._workers.delete_one({"_id": oid})
        return res.deleted_count > 0

    # ── Daily logs ──
    async def get_all_logs(
        self,
        work_date: Optional[str] = None,
        worker_name: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> list[dict]:
        query: dict = {}
        if work_date:
            query["work_date"] = work_date
        else:
            date_query: dict = {}
            if date_from:
                date_query["$gte"] = date_from
            if date_to:
                date_query["$lte"] = date_to
            if date_query:
                query["work_date"] = date_query
        if worker_name:
            query["worker_name_search"] = get_search_token(worker_name)

        cursor = self._logs.find(query).sort([("work_date", -1), ("worker_name", 1)])
        out = []
        async for doc in cursor:
            out.append(_norm_tasks(self._serialize(doc, LOG_SENSITIVE_FIELDS)))
        return out

    async def get_log_by_id(self, log_id: str) -> dict | None:
        oid = self._oid(log_id)
        if oid is None:
            return None
        doc = await self._logs.find_one({"_id": oid})
        return _norm_tasks(self._serialize(doc, LOG_SENSITIVE_FIELDS))

    async def create_log(self, data: dict) -> dict:
        now = utcnow()
        document = {
            **data,
            "worker_name_search": get_search_token(data.get("worker_name", "")),
            "created_at": now,
            "updated_at": now,
        }
        encrypted = encrypt_dict(document, LOG_SENSITIVE_FIELDS)
        result = await self._logs.insert_one(encrypted)
        encrypted["_id"] = result.inserted_id
        return _norm_tasks(self._serialize(encrypted, LOG_SENSITIVE_FIELDS))

    async def update_log(self, log_id: str, data: dict) -> dict | None:
        oid = self._oid(log_id)
        if oid is None:
            return None
        original = await self._logs.find_one({"_id": oid})
        if not original:
            return None
        decrypted = decrypt_dict(original, LOG_SENSITIVE_FIELDS)
        decrypted.update(data)
        decrypted.pop("created_at", None)
        decrypted.pop("_id", None)
        if "worker_name" in data:
            decrypted["worker_name_search"] = get_search_token(data["worker_name"])
        decrypted["updated_at"] = utcnow()
        encrypted = encrypt_dict(decrypted, LOG_SENSITIVE_FIELDS)
        result = await self._logs.find_one_and_update(
            {"_id": oid}, {"$set": encrypted}, return_document=True
        )
        if not result:
            return None
        return _norm_tasks(self._serialize(result, LOG_SENSITIVE_FIELDS))

    async def delete_log(self, log_id: str) -> bool:
        oid = self._oid(log_id)
        if oid is None:
            return False
        res = await self._logs.delete_one({"_id": oid})
        return res.deleted_count > 0
