"""Idempotent event consumers with retry and dead-letter escalation."""

from __future__ import annotations

from .models import new_event, utc_now
from .outbox import OutboxStore


class ProcessedStore:
    async def already_processed(self, event_id: str, consumer: str) -> bool:
        raise NotImplementedError

    async def mark_processed(self, event_id: str, consumer: str, result: dict) -> None:
        raise NotImplementedError


class InMemoryProcessedStore(ProcessedStore):
    def __init__(self) -> None:
        self.records: set[tuple[str, str]] = set()

    async def already_processed(self, event_id: str, consumer: str) -> bool:
        return (event_id, consumer) in self.records

    async def mark_processed(self, event_id: str, consumer: str, result: dict) -> None:
        self.records.add((event_id, consumer))


class MongoProcessedStore(ProcessedStore):
    def __init__(self, database) -> None:
        self.collection = database["processed_events"]

    async def already_processed(self, event_id: str, consumer: str) -> bool:
        return await self.collection.find_one({"event_id": event_id, "consumer": consumer}) is not None

    async def mark_processed(self, event_id: str, consumer: str, result: dict) -> None:
        await self.collection.update_one(
            {"event_id": event_id, "consumer": consumer},
            {
                "$setOnInsert": {
                    "event_id": event_id,
                    "consumer": consumer,
                    "processed_at": utc_now(),
                    "result": result,
                }
            },
            upsert=True,
        )


class EventHandler:
    consumer: str = "default"
    event_type: str = ""

    async def handle(self, event: dict) -> dict:
        raise NotImplementedError


class EventConsumer:
    def __init__(
        self,
        outbox: OutboxStore,
        processed: ProcessedStore,
        handlers: list[EventHandler] | None = None,
    ) -> None:
        self.outbox = outbox
        self.processed = processed
        self.handlers = {handler.event_type: handler for handler in (handlers or [])}

    def register(self, handler: EventHandler) -> None:
        self.handlers[handler.event_type] = handler

    async def run_once(self, limit: int = 50) -> dict:
        claimed = await self.outbox.claim(limit)
        outcome = {"claimed": len(claimed), "applied": 0, "skipped": 0, "failed": 0}
        for event in claimed:
            handler = self.handlers.get(str(event.get("event_type"))) or self.handlers.get("*")
            if handler is None:
                await self.outbox.mark_published(event["event_id"])
                outcome["skipped"] += 1
                continue
            try:
                if await self.processed.already_processed(
                    event["event_id"], handler.consumer
                ):
                    await self.outbox.mark_published(event["event_id"])
                    outcome["skipped"] += 1
                    continue
                result = await handler.handle(event)
                await self.processed.mark_processed(event["event_id"], handler.consumer, result)
                await self.outbox.mark_published(event["event_id"])
                outcome["applied"] += 1
            except Exception as exc:  # failed events are retained, never discarded
                dead = await self.outbox.mark_failed(event, repr(exc))
                outcome["failed"] += 1
                outcome["dead_lettered"] = outcome.get("dead_lettered", 0) + int(dead)
                if dead:
                    await self.outbox.publish(
                        new_event(
                            "event.dead_letter",
                            str(event.get("organization_id") or ""),
                            "event-plane",
                            str(event.get("event_id") or ""),
                            {
                                "failed_event_id": event.get("event_id"),
                                "event_type": event.get("event_type"),
                                "reason": repr(exc)[:500],
                            },
                        )
                    )
        return outcome
