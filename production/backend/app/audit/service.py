"""Append-only audit projection of canonical events."""

from __future__ import annotations

from ..events.consumer import EventHandler
from ..events.models import utc_now


class AuditStore:
    async def append(self, entry: dict) -> bool:
        raise NotImplementedError

    async def list(self, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def count(self) -> int:
        raise NotImplementedError


class InMemoryAuditStore(AuditStore):
    def __init__(self) -> None:
        self.entries: dict[str, dict] = {}

    async def append(self, entry):
        if entry["audit_id"] in self.entries:
            return False
        self.entries[entry["audit_id"]] = dict(entry)
        return True

    async def list(self, limit=200):
        rows = sorted(
            self.entries.values(), key=lambda row: str(row.get("occurred_at")), reverse=True
        )
        return [dict(row) for row in rows[:limit]]

    async def count(self) -> int:
        return len(self.entries)


class MongoAuditStore(AuditStore):
    def __init__(self, database) -> None:
        self.collection = database["audit_events"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def append(self, entry):
        try:
            await self.collection.insert_one(dict(entry))
            return True
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return False

    async def list(self, limit=200):
        cursor = self.collection.find({}).sort("occurred_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def count(self) -> int:
        return await self.collection.count_documents({})


class AuditEventHandler(EventHandler):
    consumer = "audit"
    event_type = "*"

    def __init__(self, store: AuditStore) -> None:
        self.store = store

    async def handle(self, event: dict) -> dict:
        entry = {
            "audit_id": f"audit-{event.get('event_id')}",
            "event_id": event.get("event_id"),
            "event_type": event.get("event_type"),
            "organization_id": event.get("organization_id", ""),
            "actor_id": str((event.get("payload") or {}).get("operator_id") or ""),
            "entity_id": event.get("entity_id", ""),
            "source": event.get("source", ""),
            "occurred_at": event.get("occurred_at") or utc_now(),
            "recorded_at": utc_now(),
        }
        inserted = await self.store.append(entry)
        return {"audit_id": entry["audit_id"], "created": inserted}
