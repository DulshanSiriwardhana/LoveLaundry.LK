"""Auth + user-management tests (user-service parity)."""
from __future__ import annotations

import asyncio

from app.modules.auth.service import hash_password


def _seed(app, **overrides):
    doc = {
        "user_name": "worker1",
        "password": hash_password("worker-pass"),
        "role_id": "USER",
        "auth_id": "worker-auth-id",
        "email": "worker@example.com",
        "status": "active",
    }
    doc.update(overrides)
    return asyncio.run(app.state.user_repo.create(doc))


def test_login_success_never_returns_password(client, app):
    _seed(app)
    r = client.post("/auth/login", json={"user_name": "worker1", "password": "worker-pass"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert "password" not in body["user"]
    assert body["user"]["user_name"] == "worker1"


def test_login_wrong_password(client, app):
    _seed(app)
    r = client.post("/auth/login", json={"user_name": "worker1", "password": "nope"})
    assert r.status_code == 401


def test_disabled_user_cannot_login(client, app):
    _seed(app, user_name="disabled1", auth_id="d1", status="disabled")
    r = client.post("/auth/login", json={"user_name": "disabled1", "password": "worker-pass"})
    assert r.status_code == 403


def test_protected_route_requires_token(client):
    r = client.get("/users")
    assert r.status_code in (401, 403)


def test_admin_can_create_and_fetch_user(client, auth_headers, app):
    r = client.post(
        "/users",
        headers=auth_headers,
        json={
            "user_name": "newuser",
            "password": "secret123",
            "role_id": "USER",
            "email": "new@example.com",
            "employee_id": "EMP-9",
        },
    )
    assert r.status_code == 201, r.text
    created = r.json()
    assert "password" not in created
    uid = created["id"]
    auth_id = created["auth_id"]

    assert client.get(f"/users/{uid}", headers=auth_headers).json()["user_name"] == "newuser"
    assert (
        client.get(f"/users/auth/{auth_id}", headers=auth_headers).json()["user_name"]
        == "newuser"
    )
    assert (
        client.get("/users/email/new@example.com", headers=auth_headers).json()["id"] == uid
    )
    assert (
        client.get("/users/employee/EMP-9", headers=auth_headers).json()["id"] == uid
    )
    assert client.get("/users/count", headers=auth_headers).json()["count"] >= 2


def test_create_user_duplicate_name_conflict(client, auth_headers, app):
    _seed(app)
    r = client.post(
        "/users",
        headers=auth_headers,
        json={"user_name": "worker1", "password": "secret123", "role_id": "USER"},
    )
    assert r.status_code == 409


def test_update_status_and_password(client, auth_headers, app):
    uid = _seed(app)["id"]
    r = client.patch(f"/users/{uid}/status", headers=auth_headers, json={"status": "suspended"})
    assert r.status_code == 200
    assert r.json()["status"] == "suspended"

    # Re-enable so the account may authenticate again, then rotate the password.
    client.patch(f"/users/{uid}/status", headers=auth_headers, json={"status": "active"})
    r = client.patch(
        f"/users/{uid}/password", headers=auth_headers, json={"password": "brand-new-pass"}
    )
    assert r.status_code == 200
    # new password works
    r = client.post(
        "/auth/login", json={"user_name": "worker1", "password": "brand-new-pass"}
    )
    assert r.status_code == 200


def test_delete_user(client, auth_headers, app):
    uid = _seed(app)["id"]
    r = client.delete(f"/users/{uid}", headers=auth_headers)
    assert r.status_code == 200
    assert client.get(f"/users/{uid}", headers=auth_headers).status_code == 404


def test_non_admin_cannot_create_user(client, app):
    _seed(app)  # role USER
    tok = client.post(
        "/auth/login", json={"user_name": "worker1", "password": "worker-pass"}
    ).json()["access_token"]
    r = client.post(
        "/users",
        headers={"Authorization": f"Bearer {tok}"},
        json={"user_name": "x", "password": "secret123", "role_id": "USER"},
    )
    assert r.status_code == 403


def test_token_revocation_after_disable(client, auth_headers, app):
    uid = _seed(app)["id"]
    # log in while active
    tok = client.post(
        "/auth/login", json={"user_name": "worker1", "password": "worker-pass"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}
    assert client.get("/auth/status", headers=headers).status_code == 200

    # admin disables the account; the still-valid token must stop working
    client.patch(f"/users/{uid}/status", headers=auth_headers, json={"status": "disabled"})
    assert client.get("/auth/status", headers=headers).status_code == 403


def test_login_updates_live_role(client, app):
    uid = _seed(app)["id"]
    tok = client.post(
        "/auth/login", json={"user_name": "worker1", "password": "worker-pass"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {tok}"}
    assert client.get("/auth/status", headers=headers).json()["role"] == "USER"
