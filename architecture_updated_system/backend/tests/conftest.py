"""Test fixtures. Environment is configured BEFORE importing the app so the
settings singleton picks up test values and selects the in-memory repository.
"""
from __future__ import annotations

import asyncio
import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-bytes-long!!")
os.environ.setdefault("MASTER_KEY", "test-master-key-at-least-32-bytes-long!!")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("TZ", "Asia/Colombo")
os.environ.setdefault("LOVE_AI_API_KEYS", "test-ai-api-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.modules.auth.service import hash_password  # noqa: E402


@pytest.fixture()
def app():
    return create_app()


@pytest.fixture()
def client(app):
    with TestClient(app) as c:
        yield c


def _seed_user(app, **overrides):
    doc = {
        "user_name": "admin",
        "password": hash_password("admin-pass"),
        "role_id": "SUPER_ADMIN",
        "auth_id": "admin-auth-id",
        "email": "admin@example.com",
        "employee_id": "EMP-1",
        "status": "active",
    }
    doc.update(overrides)
    return asyncio.run(app.state.user_repo.create(doc))


@pytest.fixture()
def admin_token(app, client):
    _seed_user(app)
    resp = client.post("/auth/login", json={"user_name": "admin", "password": "admin-pass"})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def manager_headers(app, client):
    """Bearer headers for a MANAGER (allowed to write workers/logs)."""
    _seed_user(
        app,
        user_name="manager",
        auth_id="manager-auth-id",
        role_id="MANAGER",
        status="active",
    )
    resp = client.post(
        "/auth/login", json={"user_name": "manager", "password": "admin-pass"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture()
def staff_headers(app, client):
    """Bearer headers for a user whose role the worker module accepts."""
    _seed_user(
        app,
        user_name="staffer",
        auth_id="staff-auth-id",
        role_id="STAFF",
        status="active",
    )
    resp = client.post(
        "/auth/login", json={"user_name": "staffer", "password": "admin-pass"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
