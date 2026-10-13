"""Database synchronization service (legacy ``admin_database`` parity).

Two directions, mirroring the legacy design:

- **SECONDARY** — an append-only *sync queue* (``sync_queue``) is drained by
  ``sync_secondary``: each pending job is applied to the secondary database and
  marked DONE (or retried / FAILED after ``sync_retry_max_attempts``).
- **LOCAL** — an incremental copy from MAIN, driven by a per-collection
  watermark stored in ``sync_state``; only documents with a newer ``updated_at``
  are transferred.

The service is transport-agnostic: it only needs three database-like handles,
so it runs unchanged against Motor in production and mongomock in tests. Ping
is injectable for hermetic tests.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Protocol

from ..core.clock import utcnow, stamp
from ..core.config import get_settings

#: Collections replicated MAIN → LOCAL. Ordered, low-churn first.
SYNC_COLLECTIONS = [
    "quotations",
    "garment_tags",
    "chat_conversations",
    "chat_messages",
]


class SyncService(Protocol):
    async def status(self) -> dict: ...
    async def sync_local(self) -> dict: ...
    async def sync_secondary(self, limit: int = 200) -> dict: ...
    async def logs(self, limit: int = 50) -> dict: ...


class MongoSyncService:
    def __init__(self, main_db, secondary_db, local_db, ping_fn=None) -> None:
        self._main = main_db
        self._secondary = secondary_db
        self._local = local_db
        self._queue = secondary_db["sync_queue"]
        self._logs = secondary_db["sync_logs"]
        self._state = local_db["sync_state"]
        self._ping = ping_fn

    async def _ping_role(self, role: str) -> bool:
        if self._ping is not None:
            return await self._ping(role)
        from ..db import ping

        return await ping(role)

    # ── status ──────────────────────────────────────────────────────────────
    async def status(self) -> dict:
        main_online = await self._ping_role("MAIN")
        secondary_online = await self._ping_role("SECONDARY")
        local_online = await self._ping_role("LOCAL")

        sync_status = "UNKNOWN"
        if secondary_online:
            failed = await self._queue.count_documents({"status": "FAILED"})
            pending = await self._queue.count_documents({"status": "PENDING"})
            sync_status = "FAILED" if failed else ("SYNCING" if pending else "SYNCHRONIZED")

        last = await self._logs.find_one({"target": "LOCAL"}, sort=[("completed_at", -1)])
        return {
            "main": {"status": "ONLINE" if main_online else "OFFLINE"},
            "secondary": {
                "status": "ONLINE" if secondary_online else "OFFLINE",
                "sync_status": sync_status,
            },
            "local": {
                "status": "ONLINE" if local_online else "OFFLINE",
                "last_sync": _iso(last.get("completed_at")) if last else None,
                "last_sync_status": last.get("status") if last else None,
            },
        }

    # ── MAIN → LOCAL ────────────────────────────────────────────────────────
    async def sync_local(self) -> dict:
        started = utcnow()
        counts: dict[str, int] = {}
        for name in SYNC_COLLECTIONS:
            state = await self._state.find_one({"_id": name})
            watermark = state.get("last_updated_at") if state else None
            query = {"updated_at": {"$gt": watermark}} if watermark else {}
            copied = 0
            newest = watermark
            async for doc in self._main[name].find(query):
                await self._local[name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                copied += 1
                ts = doc.get("updated_at") or doc.get("created_at")
                if isinstance(ts, datetime) and (newest is None or ts > newest):
                    newest = ts
            if newest is not None and newest != watermark:
                await self._state.replace_one(
                    {"_id": name}, {"_id": name, "last_updated_at": newest}, upsert=True
                )
            counts[name] = copied

        total = sum(counts.values())
        report = {
            "message": "Local synchronization complete",
            "collections": counts,
            "total": total,
            "status": "SUCCESS",
            "started_at": stamp(started),
        }
        await self._write_log(target="LOCAL", status="SUCCESS", started=started, details=report)
        return report

    # ── MAIN → SECONDARY ────────────────────────────────────────────────────
    async def sync_secondary(self, limit: int = 200) -> dict:
        settings = get_settings()
        started = utcnow()
        processed = 0
        failed = 0
        for _ in range(max(0, limit)):
            job = await self._queue.find_one({"status": "PENDING"}, sort=[("created_at", 1)])
            if not job:
                break
            await self._queue.update_one({"_id": job["_id"]}, {"$set": {"status": "PROCESSING"}})
            ok = await self._apply_job(job)
            if ok:
                await self._queue.update_one(
                    {"_id": job["_id"]},
                    {"$set": {"status": "DONE", "processed_at": utcnow()}},
                )
            else:
                failed += 1
                await self._fail_job(job, settings.sync_retry_max_attempts,
                                     settings.sync_retry_base_delay_seconds)
            processed += 1

        pending = await self._queue.count_documents({"status": "PENDING"})
        failed_total = await self._queue.count_documents({"status": "FAILED"})
        await self._write_log(
            target="SECONDARY",
            status="SUCCESS" if failed == 0 else "PARTIAL",
            started=started,
            details={"processed": processed, "failed": failed},
        )
        return {
            "message": "Secondary synchronization triggered",
            "jobs_processed": processed,
            "pending": pending,
            "failed": failed_total,
        }

    async def _apply_job(self, job: dict) -> bool:
        try:
            col = self._secondary[job["collection"]]
            if job.get("op") == "delete":
                await col.delete_one({"_id": job["doc_id"]})
            else:
                await col.replace_one({"_id": job["doc_id"]}, job["payload"], upsert=True)
            return True
        except Exception:
            return False

    async def _fail_job(self, job: dict, max_attempts: int, base_delay: int) -> None:
        attempts = int(job.get("attempts") or 0) + 1
        if attempts >= max_attempts:
            update = {"status": "FAILED", "attempts": attempts, "failed_at": utcnow()}
        else:
            delay = base_delay * (2 ** (attempts - 1))
            update = {
                "status": "PENDING",
                "attempts": attempts,
                "next_attempt_at": utcnow() + timedelta(seconds=delay),
            }
        await self._queue.update_one({"_id": job["_id"]}, {"$set": update})

    # ── logs ────────────────────────────────────────────────────────────────
    async def logs(self, limit: int = 50) -> dict:
        limit = max(1, min(limit, 200))
        out = []
        async for entry in self._logs.find().sort("started_at", -1).limit(limit):
            out.append(_format_log(entry))
        return {"logs": out}

    async def _write_log(self, target: str, status: str, started: datetime, details: dict) -> None:
        await self._logs.insert_one(
            {
                "target": target,
                "status": status,
                "started_at": started,
                "completed_at": utcnow(),
                "details": details,
            }
        )

    async def enqueue(self, collection: str, doc_id, payload: Optional[dict], op: str = "upsert") -> None:
        """Queue a MAIN→SECONDARY change (used by the sync worker / repos)."""
        await self._queue.insert_one(
            {
                "collection": collection,
                "doc_id": doc_id,
                "payload": payload,
                "op": op,
                "status": "PENDING",
                "attempts": 0,
                "created_at": utcnow(),
            }
        )


def _iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return stamp(value)
    return value


def _format_log(entry: dict) -> dict:
    out = dict(entry)
    out["id"] = str(out.pop("_id", ""))
    for key in ("started_at", "completed_at", "created_at"):
        if isinstance(out.get(key), datetime):
            out[key] = stamp(out[key])
    return out
