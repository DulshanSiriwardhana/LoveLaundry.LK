import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api import bills as bills_api
from app.authentication.router import set_user_finder
from app.core.config import get_settings
from app.core.security import create_access_token, set_user_lookup
from app.events.consumer import EventConsumer, InMemoryProcessedStore
from app.events.models import new_event, utc_now
from app.events.outbox import InMemoryOutbox
from app.main import create_app
from app.notifications.service import (
    InMemoryNotificationStore,
    NotificationEventHandler,
    NotificationHub,
)
from app.runtime import get_runtime


def _auth(claims: dict) -> dict:
    return {"Authorization": f"Bearer {create_access_token(claims)}"}


def _manager_claims(organization_id: str = "org-a") -> dict:
    return {
        "sub": "manager-1",
        "user_id": "manager-1",
        "auth_id": "manager-1",
        "user_name": "manager",
        "role": "MANAGER",
        "status": "active",
        "laundry_id": organization_id,
    }


def _platform_claims() -> dict:
    return {
        "sub": "platform-1",
        "user_id": "platform-1",
        "auth_id": "platform-1",
        "user_name": "platform-admin",
        "role": "PLATFORM_ADMIN",
        "status": "active",
    }


@pytest.fixture()
def authenticated_client(monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    set_user_lookup(None)
    set_user_finder(None)
    try:
        with TestClient(create_app()) as client:
            yield client
    finally:
        get_settings.cache_clear()
        set_user_lookup(None)
        set_user_finder(None)


def test_linen_scans_are_idempotent_and_transitions_are_validated(client) -> None:
    registered = client.post(
        "/linen/items/register",
        json={
            "organization_id": "org-1",
            "linen_id": "linen-1",
            "code": "QR-LINEN-1",
            "category": "bed-sheet",
        },
    )
    assert registered.status_code == 200

    first = client.post(
        "/linen/items/scan",
        json={
            "organization_id": "org-1",
            "scan_id": "scan-1",
            "code": "QR-LINEN-1",
            "action": "assign",
            "scanner_id": "scanner-a",
        },
    )
    assert first.status_code == 200
    assert first.json()["result"] == "accepted"
    assert first.json()["stage"] == "assigned_to_organization"

    duplicate = client.post(
        "/linen/items/scan",
        json={
            "organization_id": "org-1",
            "scan_id": "scan-1",
            "code": "QR-LINEN-1",
            "action": "make_available",
        },
    )
    assert duplicate.json()["result"] == "duplicate"

    invalid = client.post(
        "/linen/items/scan",
        json={
            "organization_id": "org-1",
            "scan_id": "scan-2",
            "code": "QR-LINEN-1",
            "action": "mark_ready",
        },
    )
    assert invalid.json()["result"] == "invalid_transition"
    assert invalid.json()["from"] == "assigned_to_organization"

    history = client.get("/linen/items/linen-1/history").json()["history"]
    assert {row["scan_id"] for row in history} == {"scan-1", "scan-2"}


def test_unknown_qr_code_in_another_organization_is_not_accepted(client) -> None:
    client.post(
        "/linen/items/register",
        json={
            "organization_id": "org-1",
            "linen_id": "linen-2",
            "code": "QR-LINEN-2",
        },
    )
    response = client.post(
        "/linen/items/scan",
        json={
            "organization_id": "org-2",
            "scan_id": "scan-wrong-org",
            "code": "QR-LINEN-2",
            "action": "assign",
        },
    )
    assert response.json()["result"] == "unknown"

    events = asyncio.run(get_runtime().outbox.list_events("org-2"))
    assert any(row["event_type"] == "linen.unknown.scan" for row in events)

    profile = client.get("/linen/items/linen-2").json()["profile"]
    assert profile["organization_id"] == "org-1"


def test_missing_linen_alerts_are_severe_deduplicated_and_exemptions_honoured(
    client,
) -> None:
    client.post(
        "/linen/items/register",
        json={
            "organization_id": "org-1",
            "linen_id": "missing-1",
            "code": "QR-MISSING-1",
            "category": "towels",
        },
    )
    client.post(
        "/linen/items/register",
        json={
            "organization_id": "org-1",
            "linen_id": "in-progress-1",
            "code": "QR-IN-PROGRESS-1",
            "category": "towels",
        },
    )
    repository = get_runtime().linen_repository
    stale = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    repository.profiles["missing-1"]["last_seen_at"] = stale
    repository.profiles["in-progress-1"]["last_seen_at"] = stale
    repository.profiles["in-progress-1"]["current_stage"] = "collected_for_laundry"

    first = client.post(
        "/linen/missing/scan", params={"organization_id": "org-1"}
    ).json()
    assert first["alerts_created"] == 1

    alerts = client.get(
        "/linen/alerts", params={"organization_id": "org-1"}
    ).json()
    assert len(alerts) == 1
    assert alerts[0]["linen_id"] == "missing-1"
    assert alerts[0]["severity"] == "critical"

    second = client.post(
        "/linen/missing/scan", params={"organization_id": "org-1"}
    ).json()
    assert second["alerts_created"] == 0
    assert second["flagged"] == 1


def test_invoice_totals_use_effective_rates_and_retries_are_idempotent(client) -> None:
    repository = get_runtime().billing_repository
    repository.rates["rate-old"] = {
        "rate_card_id": "rate-old",
        "organization_id": "org-1",
        "service": "wash",
        "unit": "kg",
        "unit_rate": 2.5,
        "tax_rate": 0.1,
        "fixed_charge": 5.0,
        "effective_from": "2026-01-01",
        "effective_to": "2026-11-15",
    }
    repository.rates["rate-new"] = {
        "rate_card_id": "rate-new",
        "organization_id": "org-1",
        "service": "wash",
        "unit": "kg",
        "unit_rate": 5.0,
        "tax_rate": 0.0,
        "fixed_charge": 0.0,
        "effective_from": "2026-11-16",
        "effective_to": "",
    }
    repository.transactions["txn-1"] = {
        "transaction_id": "txn-1",
        "organization_id": "org-1",
        "hotel_id": "hotel-1",
        "service": "wash",
        "occurred_at": "2026-11-01T09:00:00+00:00",
        "quantity": 10,
    }
    repository.transactions["txn-2"] = {
        "transaction_id": "txn-2",
        "organization_id": "org-1",
        "hotel_id": "hotel-1",
        "service": "wash",
        "occurred_at": "2026-11-20T09:00:00+00:00",
        "quantity": 2,
    }

    payload = {
        "organization_id": "org-1",
        "hotel_id": "hotel-1",
        "period_start": "2026-11-01",
        "period_end": "2026-11-30",
    }
    first = client.post("/billing/invoices/generate", json=payload)
    assert first.status_code == 200
    invoice = first.json()["invoice"]
    assert invoice["total"] == pytest.approx(42.5)
    assert {line["unit_rate"] for line in invoice["line_items"]} == {2.5, 5.0}

    retry = client.post("/billing/invoices/generate", json=payload)
    assert retry.json()["duplicate"] is True
    assert retry.json()["invoice"]["invoice_id"] == invoice["invoice_id"]

    events = asyncio.run(get_runtime().outbox.list_events("org-1"))
    generated = [row for row in events if row["event_type"] == "invoice.generated"]
    assert len(generated) == 1


def test_event_retry_dead_letter_and_recovery() -> None:
    from app.events.consumer import EventHandler

    class FailingHandler(EventHandler):
        consumer = "failing"
        event_type = "test.failure"

        async def handle(self, event):
            raise RuntimeError("downstream unavailable")

    class RecoveryHandler(EventHandler):
        consumer = "failing"
        event_type = "test.failure"

        async def handle(self, event):
            return {"recovered": event["event_id"]}

    outbox = InMemoryOutbox()
    processed = InMemoryProcessedStore()
    event = new_event("test.failure", "org-1", "test", "entity-1", {"value": 1})
    asyncio.run(outbox.publish(event))

    consumer = EventConsumer(outbox, processed, [FailingHandler()])
    for _ in range(5):
        asyncio.run(consumer.run_once())
        # Deterministically advance retry backoff instead of sleeping.
        for document in outbox.events.values():
            if document.get("status") == "failed":
                document["next_attempt_at"] = utc_now()

    assert len(asyncio.run(outbox.dead_letters())) == 1
    assert asyncio.run(outbox.stats())["dead"] == 1
    assert asyncio.run(outbox.retry_dead_letter(event["event_id"])) is True

    recovered = EventConsumer(outbox, processed, [RecoveryHandler()])
    outcome = asyncio.run(recovered.run_once())
    assert outcome["applied"] == 1
    assert asyncio.run(outbox.dead_letters()) == []


def test_notifications_are_durable_and_fanned_out_live() -> None:
    store = InMemoryNotificationStore()
    hub = NotificationHub()
    queue = asyncio.run(hub.subscribe("org-1"))
    handler = NotificationEventHandler(store, hub)
    event = new_event(
        "linen.missing.detected",
        "org-1",
        "missing-monitor",
        "linen-1",
        {"code": "QR-1", "severity": "critical"},
    )
    result = asyncio.run(handler.handle(event))
    assert result["created"] is True

    notifications = asyncio.run(store.list("org-1"))
    assert notifications[0]["priority"] == "critical"
    assert queue.get_nowait()["notification_id"] == result["notification_id"]


def test_tenant_token_cannot_read_or_mutate_another_organization(
    authenticated_client,
) -> None:
    service = bills_api._service()
    asyncio.run(
        service.bill_repository.save(
            {
                "bill_id": "bill-a",
                "organization_id": "org-a",
                "status": "outstanding",
                "amount": 100,
                "period": "2026-11",
            }
        )
    )
    asyncio.run(
        service.bill_repository.save(
            {
                "bill_id": "bill-b",
                "organization_id": "org-b",
                "status": "outstanding",
                "amount": 900,
                "period": "2026-11",
            }
        )
    )
    headers = _auth(_manager_claims("org-a"))

    bills = authenticated_client.get(
        "/bills", params={"period": "2026-11"}, headers=headers
    ).json()
    assert [row["bill_id"] for row in bills] == ["bill-a"]

    denied = authenticated_client.post(
        "/bills/bill-b/edit",
        json={"amount": 1, "reason": "cross-tenant attempt"},
        headers=headers,
    )
    assert denied.status_code == 404

    snapshot = authenticated_client.get(
        "/operations/snapshot", params={"period": "2026-11"}, headers=headers
    ).json()
    assert snapshot["financial"]["outstanding"] == pytest.approx(100)

    invoice = authenticated_client.post(
        "/billing/invoices/generate",
        json={
            "organization_id": "org-b",
            "hotel_id": "hotel-1",
            "period_start": "2026-11-01",
            "period_end": "2026-11-30",
        },
        headers=headers,
    )
    assert invoice.status_code == 403


def test_platform_admin_routes_are_blocked_for_tenants_and_accept_real_writes(
    authenticated_client,
) -> None:
    manager = authenticated_client.get(
        "/platform/summary", headers=_auth(_manager_claims())
    )
    assert manager.status_code == 403

    headers = _auth(_platform_claims())
    summary = authenticated_client.get("/platform/summary", headers=headers)
    assert summary.status_code == 200
    assert "counts" in summary.json()

    announcement = authenticated_client.post(
        "/platform/announcements",
        json={
            "title": "Scheduled maintenance",
            "body": "Service window moved to 02:00 UTC.",
            "applications": ["laundry-internal"],
        },
        headers=headers,
    )
    assert announcement.status_code == 200
    assert announcement.json()["announcement_id"]

    theme = authenticated_client.post(
        "/platform/themes",
        json={"theme": {"primary": "#123456"}, "scope": "global"},
        headers=headers,
    )
    assert theme.status_code == 200
    assert theme.json()["settings_id"]

    assert authenticated_client.get(
        "/platform/announcements", headers=headers
    ).json()[0]["title"] == "Scheduled maintenance"
    assert len(authenticated_client.get("/platform/themes", headers=headers).json()) == 1


def test_production_configuration_rejects_disabled_authentication(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_REQUIRED", "false")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValidationError):
            get_settings()
    finally:
        get_settings.cache_clear()
