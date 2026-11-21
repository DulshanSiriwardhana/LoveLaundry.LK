from __future__ import annotations

from datetime import datetime, timezone


EVENT_VERSION = 1


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_event(
    event_type: str,
    organization_id: str,
    source: str,
    entity_id: str,
    payload: dict,
    correlation_id: str = "",
    event_id: str | None = None,
    occurred_at: str | None = None,
) -> dict:
    import uuid

    return {
        "event_id": event_id or str(uuid.uuid4()),
        "event_type": event_type,
        "event_version": EVENT_VERSION,
        "organization_id": organization_id,
        "source": source,
        "entity_id": entity_id,
        "correlation_id": correlation_id or str(uuid.uuid4()),
        "occurred_at": occurred_at or utc_now(),
        "payload": payload,
    }


def validate_event(event: dict) -> None:
    required = (
        "event_id",
        "event_type",
        "event_version",
        "organization_id",
        "source",
        "occurred_at",
        "payload",
    )
    missing = [field for field in required if not event.get(field)]
    if missing:
        raise ValueError(f"Event is missing required fields: {', '.join(missing)}")
    if int(event.get("event_version") or 0) < 1:
        raise ValueError("Event version must be a positive integer")
    if not isinstance(event.get("payload"), dict):
        raise ValueError("Event payload must be an object")
