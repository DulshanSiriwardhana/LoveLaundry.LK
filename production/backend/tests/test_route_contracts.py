"""Frontend→backend route and response-contract regression tests.

The static checks do not import FastAPI, so they also run in minimal
environments. The TestClient checks cover the additive alias response shapes the
shipped apps depend on.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.authentication import hash_password, set_user_finder
from app.authentication.router import reset_login_throttle
from app.core.config import get_settings
from app.main import create_app
from app.runtime import reset_runtime

BACKEND = Path(__file__).resolve().parents[1]
REPOSITORY = BACKEND.parents[1]
_SPEC = importlib.util.spec_from_file_location(
    "route_contract_inventory", BACKEND / "scripts" / "check_route_contracts.py"
)
assert _SPEC and _SPEC.loader
_INVENTORY = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_INVENTORY)


def test_every_frontend_route_contract_is_registered() -> None:
    inventory = _INVENTORY.backend_inventory(BACKEND)
    missing = {
        f"{app}: {path}"
        for app, paths in _INVENTORY.frontend_expectations(REPOSITORY).items()
        for path in paths
        if path not in inventory
    }
    assert not missing, f"Missing backend routes: {sorted(missing)}"


def test_compatibility_aliases_exist_on_both_url_surfaces() -> None:
    inventory = _INVENTORY.backend_inventory(BACKEND)
    for path in (
        "/linens/transitions",
        "/bills/linens/transitions",
        "/client-portal/summary",
        "/bills/client-portal/summary",
        "/shop-bills/stats/overview",
        "/bills/shop-bills/stats/overview",
        "/day-close",
        "/bills/day-close",
        "/ws/linen",
    ):
        assert path in inventory, path


@pytest.fixture
def client() -> TestClient:
    reset_runtime()
    reset_login_throttle()
    try:
        with TestClient(create_app()) as instance:
            yield instance
    finally:
        reset_runtime()
        reset_login_throttle()
        set_user_finder(None)


def test_staff_login_accepts_username_alias(client: TestClient) -> None:
    async def finder(user_name: str):
        if user_name != "counter":
            return None
        return {
            "auth_id": "counter",
            "user_name": "counter",
            "password_hash": hash_password("secret"),
            "role": "ADMIN",
            "laundry_id": "laundry-a",
        }

    set_user_finder(finder)
    response = client.post(
        "/user/auth/login", json={"username": "counter", "password": "secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["user_name"] == "counter"


def test_client_login_refuses_to_guess_between_laundries(client: TestClient) -> None:
    password_hash = hash_password("secret")

    async def finder(auth_id: str):
        if auth_id != "shared-client":
            return None
        return [
            {
                "auth_id": auth_id,
                "user_name": auth_id,
                "password_hash": password_hash,
                "role": "HOTEL_ADMIN",
                "client_type": "HOTEL",
                "client_name": "Grand Hotel",
                "laundry_id": "laundry-a",
            },
            {
                "auth_id": auth_id,
                "user_name": auth_id,
                "password_hash": password_hash,
                "role": "HOTEL_ADMIN",
                "client_type": "HOTEL",
                "client_name": "Grand Hotel",
                "laundry_id": "laundry-b",
            },
        ]

    set_user_finder(finder)
    ambiguous = client.post(
        "/client/auth/login", json={"auth_id": "shared-client", "password": "secret"}
    )
    assert ambiguous.status_code == 409
    detail = ambiguous.json()["detail"]
    assert detail["code"] == "laundry_required"
    assert {row["laundry_id"] for row in detail["laundries"]} == {
        "laundry-a",
        "laundry-b",
    }

    chosen = client.post(
        "/client/auth/login",
        json={
            "auth_id": "shared-client",
            "password": "secret",
            "laundry_id": "laundry-b",
        },
    )
    assert chosen.status_code == 200
    assert chosen.json()["client"]["client_scope"]["laundry_id"] == "laundry-b"


def test_hotel_registry_alias_uses_paged_envelope(client: TestClient) -> None:
    response = client.get("/user/hotels?limit=20&offset=0")
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"items", "total", "limit", "offset"}
    assert isinstance(body["items"], list)


def test_shop_bills_namespace_alias_is_mounted(client: TestClient) -> None:
    response = client.get("/bills/shop-bills/stats/overview")
    assert response.status_code == 200
    assert set(response.json()) >= {
        "total_bills",
        "total_revenue",
        "total_paid",
        "total_outstanding",
        "status_counts",
    }


def test_day_close_alias_is_mounted(client: TestClient) -> None:
    response = client.get("/bills/day-close", params={"date": "not-a-date"})
    assert response.status_code == 422


def test_linen_profile_keeps_nested_shape_and_adds_scanner_projection(
    client: TestClient,
) -> None:
    registered = client.post(
        "/linen/items/register",
        json={
            "organization_id": "org-contract",
            "linen_id": "linen-contract",
            "code": "QR-CONTRACT",
            "category": "bed-sheet",
        },
    )
    assert registered.status_code == 200
    profile = client.get("/linen/items/linen-contract")
    assert profile.status_code == 200
    body = profile.json()
    assert isinstance(body["profile"], dict)
    assert isinstance(body["history"], list)
    assert body["linen_id"] == body["profile"]["linen_id"]
    assert body["status"] == body["profile"]["status"]
    assert body["current_stage"] == body["profile"]["current_stage"]


def test_linen_live_feed_handles_subscribe_and_ping(client: TestClient) -> None:
    with client.websocket_connect("/ws/linen") as socket:
        socket.send_json({"subscribe": ["laundry"]})
        assert socket.receive_json()["type"] == "subscribed"
        socket.send_json({"ping": True})
        assert socket.receive_json()["type"] == "pong"


def test_linen_live_feed_rejects_invalid_token(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    with client.websocket_connect("/ws/linen?token=invalid") as socket:
        with pytest.raises(WebSocketDisconnect) as exc:
            socket.receive_json()
    assert exc.value.code == 4401
