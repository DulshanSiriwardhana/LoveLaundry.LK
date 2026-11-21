from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.security import create_access_token
from app.main import create_app
from app.core.principal import assert_organization_access, normalize_principal


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_live_token_claims_are_accepted_without_role_ids(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            token = create_access_token(
                {
                    "user_id": "live-user-1",
                    "auth_id": "live-auth-1",
                    "user_name": "manager",
                    "role": "MANAGER",
                    "status": "active",
                    "laundry_id": "laundry-a",
                    "laundries": [{"id": "laundry-a"}],
                    "platform_admin": False,
                }
            )
            response = client.get("/operations/monthly", headers=_auth(token))
            assert response.status_code == 200
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


def test_staff_token_cannot_edit_bills_or_linen_inventory(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            token = create_access_token(
                {
                    "user_id": "live-user-2",
                    "auth_id": "live-auth-2",
                    "role": "STAFF",
                    "status": "active",
                    "laundry_id": "laundry-a",
                }
            )
            assert client.post(
                "/bills/bill-1/edit",
                json={"amount": 10, "reason": "test"},
                headers=_auth(token),
            ).status_code == 403
            assert client.post(
                "/linen/movements",
                json={
                    "movement_id": "m-1",
                    "linen_id": "l-1",
                    "direction": "in",
                    "quantity": 1,
                    "reason": "test",
                },
                headers=_auth(token),
            ).status_code == 403
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


def test_platform_admin_token_bypasses_organization_scope() -> None:
    principal = normalize_principal(
        {"auth_id": "platform", "role": "PLATFORM_ADMIN", "user_name": "platform"}
    )
    assert_organization_access(principal, "any-organization")


def test_tenant_role_cannot_access_another_organization() -> None:
    principal = normalize_principal(
        {
            "auth_id": "manager",
            "role": "MANAGER",
            "laundry_id": "laundry-a",
            "laundries": [{"id": "laundry-a"}],
        }
    )
    assert_organization_access(principal, "laundry-a")
    try:
        assert_organization_access(principal, "laundry-b")
    except HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("cross-organization access was accepted")
