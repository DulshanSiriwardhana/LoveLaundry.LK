"""Durable notification inbox plus best-effort live delivery."""

from __future__ import annotations

import asyncio
from collections import defaultdict

from ..events.consumer import EventHandler
from ..events.models import utc_now

_TITLES = {
    "linen.registered": "Linen registered",
    "linen.scanned": "Linen scan recorded",
    "linen.dispatched": "Linen dispatched",
    "linen.received": "Linen received",
    "linen.missing.detected": "Missing linen detected",
    "linen.missing.resolved": "Missing linen resolved",
    "linen.unknown.scan": "Unknown QR code scanned",
    "linen.transition.rejected": "Invalid linen movement",
    "invoice.generated": "Invoice generated",
    "invoice.issued": "Invoice issued",
    "payment.recorded": "Payment recorded",
    "event.dead_letter": "Event needs attention",
}

_PRIORITIES = {
    "linen.missing.detected": "critical",
    "linen.unknown.scan": "high",
    "linen.transition.rejected": "high",
    "event.dead_letter": "critical",
    "payment.recorded": "normal",
}


class NotificationStore:
    async def save(self, notification: dict) -> bool:
        raise NotImplementedError

    async def list(self, organization_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def mark_read(self, notification_id: str, actor_id: str) -> dict | None:
        raise NotImplementedError


class InMemoryNotificationStore(NotificationStore):
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}

    async def save(self, notification: dict) -> bool:
        key = notification["notification_id"]
        if key in self.rows:
            return False
        self.rows[key] = dict(notification)
        return True

    async def list(self, organization_id=None, limit=200) -> list[dict]:
        rows = sorted(
            self.rows.values(), key=lambda row: str(row.get("created_at")), reverse=True
        )
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        return [dict(row) for row in rows[:limit]]

    async def mark_read(self, notification_id, actor_id):
        row = self.rows.get(notification_id)
        if row is None:
            return None
        row["read"] = True
        row["read_at"] = utc_now()
        row["read_by"] = actor_id
        return dict(row)


class MongoNotificationStore(NotificationStore):
    def __init__(self, database) -> None:
        self.collection = database["notifications"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def save(self, notification):
        try:
            await self.collection.insert_one(dict(notification))
            return True
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return False

    async def list(self, organization_id=None, limit=200):
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.collection.find(query).sort("created_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def mark_read(self, notification_id, actor_id):
        return self._clean(
            await self.collection.find_one_and_update(
                {"notification_id": notification_id},
                {
                    "$set": {
                        "read": True,
                        "read_at": utc_now(),
                        "read_by": actor_id,
                    }
                },
                return_document=True,
            )
        )


class NotificationHub:
    """Fan-out to live WebSocket subscribers, keyed by organization."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)

    async def subscribe(self, organization_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=50)
        self._subscribers[organization_id].add(queue)
        return queue

    async def unsubscribe(self, organization_id: str, queue: asyncio.Queue) -> None:
        subscribers = self._subscribers.get(organization_id)
        if subscribers is not None:
            subscribers.discard(queue)
            if not subscribers:
                self._subscribers.pop(organization_id, None)

    async def publish(self, notification: dict) -> None:
        organization_id = str(notification.get("organization_id") or "")
        for queue in list(self._subscribers.get(organization_id, set())):
            try:
                queue.put_nowait(notification)
            except asyncio.QueueFull:
                # The durable inbox remains authoritative; live delivery is
                # best-effort and must never block the event worker.
                continue


class NotificationEventHandler(EventHandler):
    consumer = "notifications"
    event_type = "*"

    def __init__(self, store: NotificationStore, hub: NotificationHub | None = None) -> None:
        self.store = store
        self.hub = hub or NotificationHub()

    @staticmethod
    def _message(event: dict) -> str:
        payload = event.get("payload") or {}
        parts = [
            str(payload.get("code") or ""),
            str(payload.get("description") or ""),
            str(payload.get("invoice_id") or ""),
            str(payload.get("severity") or ""),
        ]
        detail = " ".join(part for part in parts if part).strip()
        return detail or f"{event.get('event_type')} was recorded"

    async def handle(self, event: dict) -> dict:
        event_id = str(event.get("event_id") or "")
        organization_id = str(event.get("organization_id") or "")
        notification = {
            "notification_id": f"event-{event_id}",
            "recipient_id": (
                str((event.get("payload") or {}).get("operator_id") or "")
                or f"org:{organization_id}"
            ),
            "organization_id": organization_id,
            "title": _TITLES.get(
                str(event.get("event_type")), str(event.get("event_type", "Event")).replace(".", " ").title()
            ),
            "message": self._message(event),
            "priority": _PRIORITIES.get(str(event.get("event_type")), "normal"),
            "category": str(event.get("event_type") or "event").split(".")[0],
            "event_id": event_id,
            "read": False,
            "created_at": utc_now(),
        }
        inserted = await self.store.save(notification)
        if inserted:
            await self.hub.publish(notification)
        return {"notification_id": notification["notification_id"], "created": inserted}
