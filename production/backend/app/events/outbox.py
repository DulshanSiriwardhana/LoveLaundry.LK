"""Durable transactional outbox, idempotency ledger, and dead-letter store."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..core.clock import now
from .models import utc_now, validate_event

MAX_ATTEMPTS = 5


def _backoff_seconds(attempt: int) -> int:
    return min(300, 2 ** max(0, attempt - 1))


def _due(document: dict) -> bool:
    if document.get("status") not in {"pending", "failed"}:
        return False
    value = document.get("next_attempt_at") or document.get("available_at")
    if not value:
        return True
    try:
        return datetime.fromisoformat(str(value)) <= datetime.now(timezone.utc)
    except ValueError:
        return True


class OutboxStore:
    async def publish(self, event: dict) -> bool:
        raise NotImplementedError

    async def claim(self, limit: int = 50) -> list[dict]:
        raise NotImplementedError

    async def mark_published(self, event_id: str) -> None:
        raise NotImplementedError

    async def mark_failed(self, event: dict, error: str) -> bool:
        """Return True when the event was moved to the dead-letter store."""
        raise NotImplementedError

    async def dead_letters(self, limit: int = 100) -> list[dict]:
        raise NotImplementedError

    async def list_events(
        self, organization_id: str | None = None, limit: int = 5000
    ) -> list[dict]:
        raise NotImplementedError

    async def retry_dead_letter(self, event_id: str) -> bool:
        raise NotImplementedError

    async def stats(self) -> dict:
        raise NotImplementedError


class InMemoryOutbox(OutboxStore):
    def __init__(self) -> None:
        self.events: dict[str, dict] = {}
        self.dead: dict[str, dict] = {}
        self.processed: set[tuple[str, str]] = set()

    async def publish(self, event: dict) -> bool:
        validate_event(event)
        if event["event_id"] in self.events:
            return False
        document = dict(event)
        document.update(
            {
                "status": "pending",
                "attempts": 0,
                "available_at": utc_now(),
                "next_attempt_at": utc_now(),
                "created_at": utc_now(),
            }
        )
        self.events[event["event_id"]] = document
        return True

    async def claim(self, limit: int = 50) -> list[dict]:
        claimed = []
        for document in sorted(
            self.events.values(), key=lambda row: str(row.get("available_at"))
        ):
            if len(claimed) >= limit:
                break
            if not _due(document):
                continue
            document["status"] = "processing"
            claimed.append(dict(document))
        return claimed

    async def mark_published(self, event_id: str) -> None:
        document = self.events.get(event_id)
        if document is not None:
            document["status"] = "published"
            document["published_at"] = utc_now()

    async def mark_failed(self, event: dict, error: str) -> bool:
        document = self.events.get(event["event_id"])
        if document is None:
            return False
        attempts = int(document.get("attempts") or 0) + 1
        document["attempts"] = attempts
        document["last_error"] = str(error)[:1000]
        if attempts >= MAX_ATTEMPTS:
            document["status"] = "dead"
            await self._dead_letter(document)
            return True
        document["status"] = "failed"
        document["next_attempt_at"] = (
            datetime.now(timezone.utc) + timedelta(seconds=_backoff_seconds(attempts))
        ).isoformat()
        return False

    async def _dead_letter(self, document: dict) -> None:
        self.dead.setdefault(
            document["event_id"],
            {
                "event_id": document["event_id"],
                "event_type": document["event_type"],
                "organization_id": document["organization_id"],
                "reason": document.get("last_error") or "event failed",
                "attempts": document.get("attempts", 0),
                "payload": document.get("payload", {}),
                "failed_at": utc_now(),
            },
        )

    async def dead_letters(self, limit: int = 100) -> list[dict]:
        return list(self.dead.values())[:limit]

    async def list_events(self, organization_id=None, limit=5000) -> list[dict]:
        rows = sorted(
            self.events.values(), key=lambda row: str(row.get("occurred_at")), reverse=True
        )
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        return [dict(row) for row in rows[:limit]]

    async def retry_dead_letter(self, event_id: str) -> bool:
        letter = self.dead.get(event_id)
        document = self.events.get(event_id)
        if letter is None or document is None:
            return False
        document.update(
            {
                "status": "pending",
                "attempts": 0,
                "next_attempt_at": utc_now(),
                "last_error": "",
            }
        )
        self.dead.pop(event_id, None)
        return True

    async def stats(self) -> dict:
        statuses: dict[str, int] = {}
        for document in self.events.values():
            status = str(document.get("status") or "unknown")
            statuses[status] = statuses.get(status, 0) + 1
        return {
            "pending": statuses.get("pending", 0),
            "failed": statuses.get("failed", 0),
            "processing": statuses.get("processing", 0),
            "published": statuses.get("published", 0),
            "dead": statuses.get("dead", 0),
            "dead_letters": len(self.dead),
        }


class MongoOutbox(OutboxStore):
    def __init__(self, database) -> None:
        self.events = database["outbox_events"]
        self.dead = database["dead_letters"]

    async def publish(self, event: dict) -> bool:
        validate_event(event)
        document = dict(event)
        document.update(
            {
                "status": "pending",
                "attempts": 0,
                "available_at": utc_now(),
                "next_attempt_at": utc_now(),
                "created_at": utc_now(),
            }
        )
        result = await self.events.update_one(
            {"event_id": event["event_id"]},
            {"$setOnInsert": document},
            upsert=True,
        )
        return bool(getattr(result, "upserted_id", None))

    async def claim(self, limit: int = 50) -> list[dict]:
        claimed: list[dict] = []
        for _ in range(limit):
            document = await self.events.find_one_and_update(
                {
                    "status": {"$in": ["pending", "failed"]},
                    "$or": [
                        {"next_attempt_at": {"$lte": utc_now()}},
                        {"next_attempt_at": {"$exists": False}},
                    ],
                },
                {"$set": {"status": "processing", "locked_at": utc_now()}},
            )
            if document is None:
                break
            document.pop("_id", None)
            claimed.append(document)
        return claimed

    async def mark_published(self, event_id: str) -> None:
        await self.events.update_one(
            {"event_id": event_id},
            {"$set": {"status": "published", "published_at": utc_now()}},
        )

    async def mark_failed(self, event: dict, error: str) -> bool:
        attempts = int(event.get("attempts") or 0) + 1
        dead = attempts >= MAX_ATTEMPTS
        update = {
            "$set": {
                "attempts": attempts,
                "last_error": str(error)[:1000],
                "status": "dead" if dead else "failed",
                "next_attempt_at": (
                    datetime.now(timezone.utc) + timedelta(seconds=_backoff_seconds(attempts))
                ).isoformat(),
            }
        }
        await self.events.update_one({"event_id": event["event_id"]}, update)
        if dead:
            await self.dead.update_one(
                {"event_id": event["event_id"]},
                {
                    "$setOnInsert": {
                        "event_id": event["event_id"],
                        "event_type": event["event_type"],
                        "organization_id": event.get("organization_id", ""),
                        "reason": str(error)[:1000],
                        "attempts": attempts,
                        "payload": event.get("payload", {}),
                        "failed_at": utc_now(),
                    }
                },
                upsert=True,
            )
        return dead

    async def dead_letters(self, limit: int = 100) -> list[dict]:
        cursor = self.dead.find({}).sort("failed_at", -1).limit(limit)
        return [
            {key: value for key, value in row.items() if key != "_id"}
            for row in await cursor.to_list(length=limit)
        ]

    async def list_events(self, organization_id=None, limit=5000) -> list[dict]:
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.events.find(query).sort("occurred_at", -1).limit(limit)
        return [
            {key: value for key, value in row.items() if key != "_id"}
            for row in await cursor.to_list(length=limit)
        ]

    async def retry_dead_letter(self, event_id: str) -> bool:
        letter = await self.dead.find_one({"event_id": event_id})
        if letter is None:
            return False
        result = await self.events.update_one(
            {"event_id": event_id},
            {
                "$set": {
                    "status": "pending",
                    "attempts": 0,
                    "next_attempt_at": utc_now(),
                    "last_error": "",
                }
            },
        )
        if result.matched_count:
            await self.dead.delete_one({"event_id": event_id})
            return True
        return False

    async def stats(self) -> dict:
        pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        rows = await self.events.aggregate(pipeline).to_list(length=None)
        statuses = {str(row["_id"]): int(row["count"]) for row in rows}
        return {
            "pending": statuses.get("pending", 0),
            "failed": statuses.get("failed", 0),
            "processing": statuses.get("processing", 0),
            "published": statuses.get("published", 0),
            "dead": statuses.get("dead", 0),
            "dead_letters": await self.dead.count_documents({}),
        }
