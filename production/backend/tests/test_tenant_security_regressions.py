"""Regression tests for cross-tenant access-control fixes in the core backend."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import get_settings
from app.core.security import create_access_token, set_user_lookup
from app.main import create_app
from app.runtime import get_runtime
from tests.live_lookup import clear as clear_users, lookup as user_lookup, register


def _auth(claims: dict) -> dict:
    register(claims)
    return {"Authorization": f"Bearer {create_access_token(claims)}"}


def _token(claims: dict) -> str:
    return _auth(claims)["Authorization"].split(" ", 1)[1]


def _manager_claims(organization_id: str) -> dict:
    return {
        "sub": "manager-1",
        "user_id": "manager-1",
        "auth_id": "manager-1",
        "user_name": "manager",
        "role": "MANAGER",
        "status": "active",
        "laundry_id": organization_id,
    }


@pytest.fixture()
def authenticated_client(monkeypatch):
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    clear_users()
    set_user_lookup(user_lookup)
    try:
        with TestClient(create_app()) as client:
            yield client
    finally:
        get_settings.cache_clear()
        set_user_lookup(None)
        clear_users()


def _seed_alert(client, alert_id: str, organization_id: str) -> None:
    # The TestClient lifespan has already built the runtime; seeding through it
    # exercises the same repository object the API uses.
    import asyncio

    asyncio.run(
        get_runtime().linen_repository.save_alert(
            {
                "alert_id": alert_id,
                "linen_id": f"linen-{alert_id}",
                "organization_id": organization_id,
                "severity": "amber",
                "status": "open",
                "days_since_last_seen": 20,
                "threshold_days": 15,
            }
        )
    )


def test_resolve_alert_denied_for_foreign_tenant(authenticated_client) -> None:
    _seed_alert(authenticated_client, "alert-b", "org-b")

    response = authenticated_client.post(
        "/linen/alerts/alert-b/resolve", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 403
    alerts = get_runtime().linen_repository.alerts
    assert alerts["alert-b"]["status"] == "open"
    assert "resolved_by" not in alerts["alert-b"]


def test_resolve_alert_allowed_for_owner(authenticated_client) -> None:
    _seed_alert(authenticated_client, "alert-a", "org-a")

    response = authenticated_client.post(
        "/linen/alerts/alert-a/resolve", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
    assert response.json()["resolved_by"] == "manager-1"


def test_missing_scan_rejects_foreign_organization(authenticated_client) -> None:
    response = authenticated_client.post(
        "/linen/missing/scan",
        params={"organization_id": "org-b"},
        headers=_auth(_manager_claims("org-a")),
    )
    assert response.status_code == 403

    allowed = authenticated_client.post(
        "/linen/missing/scan",
        params={"organization_id": "org-a"},
        headers=_auth(_manager_claims("org-a")),
    )
    assert allowed.status_code == 200


def _seed_verified_batch(client, organization_id: str) -> None:
    import asyncio

    asyncio.run(
        get_runtime().identity_repository.save_batch(
            {
                "batch_id": "BATCH-1",
                "organization_id": organization_id,
                "status": "VERIFIED",
                "expected_quantity": 1,
            }
        )
    )


def test_mapping_import_rejects_foreign_row_organization(authenticated_client) -> None:
    _seed_verified_batch(authenticated_client, "org-a")

    response = authenticated_client.post(
        "/tags/imports",
        json={
            "batch_id": "BATCH-1",
            "rows": [
                {
                    "linen_id": "LL-000001",
                    "qr_id": "QR-FOREIGN-1",
                    "epc": "3039" + "A" * 20,
                    "organization_id": "org-b",
                }
            ],
        },
        headers=_auth(_manager_claims("org-a")),
    )

    assert response.status_code == 403
    assert get_runtime().identity_repository.imports == {}


def test_mapping_activation_rejects_foreign_row_organization(authenticated_client) -> None:
    _seed_verified_batch(authenticated_client, "org-a")
    import asyncio

    asyncio.run(
        get_runtime().identity_repository.save_import(
            {
                "import_id": "IMP-000001",
                "batch_id": "BATCH-1",
                "organization_id": "org-a",
                "status": "VERIFIED",
                "valid": True,
                "rows": [
                    {
                        "linen_id": "LL-000002",
                        "qr_id": "QR-FOREIGN-2",
                        "epc": "3039" + "B" * 20,
                        "organization_id": "org-b",
                    }
                ],
            }
        )
    )

    response = authenticated_client.post(
        "/tags/imports/IMP-000001/activate",
        headers=_auth(_manager_claims("org-a")),
    )

    assert response.status_code == 403
    assert get_runtime().identity_repository.items == {}


def _platform_claims() -> dict:
    return {
        "sub": "platform-1",
        "user_id": "platform-1",
        "auth_id": "platform-1",
        "user_name": "platform-admin",
        "role": "PLATFORM_ADMIN",
        "status": "active",
    }


def test_dead_letters_are_scoped_to_caller_organization(authenticated_client) -> None:
    outbox = get_runtime().outbox
    outbox.dead["event-a"] = {
        "event_id": "event-a",
        "organization_id": "org-a",
        "failed_at": "2026-11-01T00:00:00+00:00",
    }
    outbox.dead["event-b"] = {
        "event_id": "event-b",
        "organization_id": "org-b",
        "failed_at": "2026-11-01T00:00:00+00:00",
    }

    response = authenticated_client.get(
        "/events/dead-letters", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 200
    assert [row["event_id"] for row in response.json()] == ["event-a"]


def test_dead_letter_retry_denied_for_foreign_organization(authenticated_client) -> None:
    outbox = get_runtime().outbox
    outbox.dead["event-b"] = {
        "event_id": "event-b",
        "organization_id": "org-b",
        "failed_at": "2026-11-01T00:00:00+00:00",
    }
    outbox.events["event-b"] = {"event_id": "event-b", "organization_id": "org-b"}

    response = authenticated_client.post(
        "/events/dead-letters/event-b/retry", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 200
    assert response.json()["retried"] is False
    assert "event-b" in outbox.dead


def test_reconciliation_history_is_scoped_to_caller_organization(authenticated_client) -> None:
    store = get_runtime().reconciliation_store
    store.runs["run-a"] = {"run_id": "run-a", "organization_id": "org-a", "started_at": "2026-11-01T00:00:00+00:00"}
    store.runs["run-b"] = {"run_id": "run-b", "organization_id": "org-b", "started_at": "2026-11-01T00:00:00+00:00"}

    response = authenticated_client.get(
        "/events/reconciliation", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 200
    assert [row["run_id"] for row in response.json()] == ["run-a"]


def test_platform_dashboard_requires_platform_admin(authenticated_client) -> None:
    denied = authenticated_client.get(
        "/dashboards/platform", headers=_auth(_manager_claims("org-a"))
    )
    assert denied.status_code == 403

    allowed = authenticated_client.get(
        "/dashboards/platform", headers=_auth(_platform_claims())
    )
    assert allowed.status_code == 200


def test_notification_mark_read_denied_for_foreign_organization(authenticated_client) -> None:
    store = get_runtime().notification_store
    store.rows["notification-b"] = {
        "notification_id": "notification-b",
        "organization_id": "org-b",
        "read": False,
    }

    response = authenticated_client.post(
        "/notifications/notification-b/read", headers=_auth(_manager_claims("org-a"))
    )

    assert response.status_code == 404
    assert store.rows["notification-b"]["read"] is False


def test_notification_stream_rejects_disabled_account(authenticated_client) -> None:
    claims = _manager_claims("org-a")
    claims["status"] = "disabled"
    with authenticated_client.websocket_connect(
        "/notifications/stream"
    ) as websocket:
        websocket.send_json({"token": _token(claims)})
        with pytest.raises(Exception) as exc_info:
            websocket.receive_json()
        assert getattr(exc_info.value, "code", None) == 1008


def test_notification_stream_requires_view_notifications(authenticated_client) -> None:
    claims = {
        "sub": "limited-1",
        "user_id": "limited-1",
        "auth_id": "limited-1",
        "role": "CUSTOM",
        "status": "active",
        "laundry_id": "org-a",
    }
    with authenticated_client.websocket_connect(
        "/notifications/stream"
    ) as websocket:
        websocket.send_json({"token": _token(claims)})
        with pytest.raises(Exception) as exc_info:
            websocket.receive_json()
        assert getattr(exc_info.value, "code", None) == 1008


def test_notification_stream_rejects_untrusted_origin(authenticated_client) -> None:
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with authenticated_client.websocket_connect(
            "/notifications/stream", headers={"origin": "https://evil.example"}
        ):
            pass
    assert exc_info.value.code == 1008
    assert exc_info.value.reason == "Origin not allowed"


def test_mapping_activation_uses_batch_organization(authenticated_client) -> None:
    _seed_verified_batch(authenticated_client, "org-a")
    import asyncio

    asyncio.run(
        get_runtime().identity_repository.save_import(
            {
                "import_id": "IMP-000002",
                "batch_id": "BATCH-1",
                "organization_id": "org-a",
                "status": "VERIFIED",
                "valid": True,
                "rows": [
                    {
                        "linen_id": "LL-000003",
                        "qr_id": "QR-LOCAL-3",
                        "epc": "3039" + "C" * 20,
                        "organization_id": "",
                    }
                ],
            }
        )
    )

    response = authenticated_client.post(
        "/tags/imports/IMP-000002/activate",
        headers=_auth(_manager_claims("org-a")),
    )

    assert response.status_code == 200
    items = get_runtime().identity_repository.items
    assert list(items.values())[0]["organization_id"] == "org-a"
