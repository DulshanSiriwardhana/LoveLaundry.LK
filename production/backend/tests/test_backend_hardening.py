"""Regression tests for core backend authentication, identity and transport hardening."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.api import adjustments as adjustments_api
from app.api import bills as bills_api
from app.core.config import get_settings
from app.core.security import create_access_token, set_user_lookup
from app.core.security_headers import SECURITY_HEADERS
from app.main import create_app
from app.rfid.endpoints import parse_endpoint, validate_reader_endpoint
from tests.live_lookup import clear as clear_users, lookup as user_lookup, register


def _auth(claims: dict) -> dict:
    register(claims)
    return {"Authorization": f"Bearer {create_access_token(claims)}"}


def _manager(auth_id: str = "manager-1", organization_id: str = "org-a") -> dict:
    return {
        "sub": auth_id,
        "user_id": auth_id,
        "auth_id": auth_id,
        "user_name": auth_id,
        "role": "MANAGER",
        "status": "active",
        "laundry_id": organization_id,
    }


@pytest.fixture()
def secured_client(monkeypatch):
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


def test_token_without_live_user_is_rejected(secured_client) -> None:
    # Signed token, deleted account: no claims-only fallback.
    token = create_access_token(_manager("ghost"))
    response = secured_client.get(
        "/operations/monthly", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_live_record_overrides_stale_token_status(secured_client) -> None:
    claims = _manager("stale")
    headers = _auth(claims)
    assert secured_client.get("/operations/monthly", headers=headers).status_code == 200
    changed = dict(claims, status="disabled")
    register(changed)
    response = secured_client.get("/operations/monthly", headers=headers)
    assert response.status_code == 403


def test_revocation_marker_blocks_existing_token(secured_client) -> None:
    claims = _manager("revoked")
    headers = _auth(claims)
    register(dict(claims, token_revoked=True))
    assert secured_client.get("/operations/monthly", headers=headers).status_code == 401


def test_token_version_mismatch_blocks_existing_token(secured_client) -> None:
    claims = dict(_manager("versioned"), token_version=1)
    headers = _auth(claims)
    assert secured_client.get("/operations/monthly", headers=headers).status_code == 200
    register(dict(claims, token_version=2))
    assert secured_client.get("/operations/monthly", headers=headers).status_code == 401


def test_lookup_outage_returns_generic_503(secured_client) -> None:
    async def broken_lookup(auth_id: str):
        raise RuntimeError("connection failed: mongodb+srv://secret@host/db")

    set_user_lookup(broken_lookup)
    try:
        response = secured_client.get(
            "/operations/monthly", headers=_auth(_manager("outage"))
        )
        assert response.status_code == 503
        assert response.json() == {"detail": "Account lookup is unavailable"}
        assert "mongodb" not in response.text
        assert "secret" not in response.text
    finally:
        set_user_lookup(user_lookup)


def test_body_actor_id_cannot_forge_audit_identity(secured_client) -> None:
    asyncio.run(
        bills_api._service().bill_repository.save(
            {
                "bill_id": "bill-hardening",
                "organization_id": "org-a",
                "status": "delivered",
                "amount": 100.0,
                "period": "2026-11",
            }
        )
    )
    response = secured_client.post(
        "/bills/bill-hardening/edit",
        json={"amount": 120.0, "reason": "Correction", "actor_id": "fraudulent-user"},
        headers=_auth(_manager()),
    )
    assert response.status_code == 200
    assert response.json()["bill"]["edited_by"] == "manager-1"


def test_approver_identity_cannot_be_spoofed_in_body(secured_client) -> None:
    requester = _auth(_manager("requester-1"))
    created = secured_client.post(
        "/adjustments",
        json={
            "adjustment_id": "adj-hardening",
            "gate_pass_id": "gp-hardening",
            "item_name": "Shirt",
            "original_qty": 10,
            "corrected_qty": 8,
            "reason": "Damaged",
            "actor_id": "requester-1",
        },
        headers=requester,
    )
    assert created.status_code == 200

    approved = secured_client.post(
        "/adjustments/adj-hardening/approve",
        json={"auth_id": "requester-1", "user_name": "requester-1"},
        headers=_auth(_manager("approver-1")),
    )
    assert approved.status_code == 200
    stored = asyncio.run(
        adjustments_api._service().adjustment_repository.find("adj-hardening", "org-a")
    )
    assert stored["approved_by_id"] == "approver-1"
    assert stored["requested_by_id"] == "requester-1"


def test_login_throttle_ignores_forwarded_for_headers(client, user_finder, monkeypatch) -> None:
    monkeypatch.setenv("LOGIN_ATTEMPT_LIMIT", "3")
    monkeypatch.setenv("LOGIN_WINDOW_SECONDS", "60")
    monkeypatch.setenv("LOGIN_LOCKOUT_SECONDS", "300")
    get_settings.cache_clear()
    try:
        statuses = []
        for index in range(3):
            response = client.post(
                "/auth/login",
                json={"user_name": "admin", "password": f"wrong-{index}"},
                headers={"X-Forwarded-For": f"198.51.100.{index}"},
            )
            statuses.append(response.status_code)
        assert statuses == [401, 401, 401]
        blocked = client.post(
            "/auth/login",
            json={"user_name": "admin", "password": "admin-pass"},
            headers={"X-Forwarded-For": "198.51.100.99"},
        )
        assert blocked.status_code == 429
        assert blocked.headers["Retry-After"].isdigit()
    finally:
        get_settings.cache_clear()


def test_oversized_body_is_rejected_without_reflection(monkeypatch) -> None:
    monkeypatch.setenv("MAX_REQUEST_BODY_BYTES", "1024")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            marker = "SENSITIVE-PASSWORD-MARKER"
            response = client.post(
                "/auth/login",
                json={"user_name": "admin", "password": marker * 100},
            )
            assert response.status_code == 413
            assert response.json() == {"detail": "Request body is too large"}
            assert marker not in response.text
    finally:
        get_settings.cache_clear()


def test_security_headers_on_all_responses(client) -> None:
    for response in (client.get("/health"), client.get("/does-not-exist")):
        for header, value in SECURITY_HEADERS.items():
            assert response.headers.get(header) == value


def test_rfid_endpoint_parser_rejects_malformed_values() -> None:
    for value in ("", "host", "host:abc", "host:0", "host:70000", "a/b:80"):
        with pytest.raises(ValueError):
            parse_endpoint(value)
    assert parse_endpoint("10.0.0.7:9080") == ("10.0.0.7", 9080)
    assert parse_endpoint("[fd00::1]:9080") == ("fd00::1", 9080)


def test_rfid_endpoint_validator_blocks_ssrf_targets() -> None:
    settings = get_settings()
    for endpoint in (
        "127.0.0.1:8000",
        "169.254.169.254:80",
        "192.0.2.10:80",
        "8.8.8.8:53",
        "224.0.0.1:1234",
    ):
        with pytest.raises(ValueError):
            validate_reader_endpoint(endpoint, settings)
    assert validate_reader_endpoint("10.10.0.4:9080", settings) == ("10.10.0.4", 9080)
    # Hostnames require an explicit deployment opt-in.
    with pytest.raises(ValueError):
        validate_reader_endpoint("reader.local:9080", settings)


def test_reader_registration_rejects_loopback_endpoint(secured_client) -> None:
    response = secured_client.post(
        "/rfid/readers",
        json={
            "reader_id": "reader-loopback",
            "organization_id": "org-a",
            "name": "Gate reader",
            "adapter": "zebra",
            "transport": "tcp",
            "endpoint": "127.0.0.1:9000",
        },
        headers=_auth(
            {
                "sub": "platform-hardening",
                "user_id": "platform-hardening",
                "auth_id": "platform-hardening",
                "user_name": "platform",
                "role": "PLATFORM_ADMIN",
                "status": "active",
            }
        ),
    )
    assert response.status_code == 400
    assert "127.0.0.1" not in response.text
