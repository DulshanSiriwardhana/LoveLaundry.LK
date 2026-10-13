"""Sync service + /admin/database tests.

Runs the real ``MongoSyncService`` against mongomock databases (no network) with
an injected ping, so the MAIN→LOCAL copy and MAIN→SECONDARY queue drain are
actually exercised — not stubbed.
"""
from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

from app.core.clock import utcnow
from app.main import create_app
from app.modules.auth.service import hash_password
from app.sync.service import MongoSyncService


def _seed_admin(app):
    asyncio.run(
        app.state.user_repo.create(
            {
                "user_name": "dbadmin",
                "password": hash_password("admin-pass"),
                "role_id": "ADMIN",
                "auth_id": "dbadmin-auth-id",
                "email": "dbadmin@example.com",
                "employee_id": "EMP-9",
                "status": "active",
            }
        )
    )


def _setup():
    mock = AsyncMongoMockClient()
    main_db = mock["laundry_main"]
    secondary_db = mock["laundry_main_secondary"]
    local_db = mock["laundry_main_local"]

    async def fake_ping(role: str) -> bool:
        return True

    service = MongoSyncService(main_db, secondary_db, local_db, ping_fn=fake_ping)

    app = create_app()
    app.state.sync_service = service
    _seed_admin(app)
    return app, service, main_db, secondary_db, local_db


def _admin_headers(client):
    resp = client.post("/auth/login", json={"user_name": "dbadmin", "password": "admin-pass"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_status_reports_roles_and_sync_state():
    app, service, main_db, _, _ = _setup()
    with TestClient(app) as client:
        headers = _admin_headers(client)
        body = client.get("/admin/database/status", headers=headers).json()
        assert body["main"]["status"] == "ONLINE"
        assert body["secondary"]["sync_status"] == "SYNCHRONIZED"
        assert body["local"]["status"] == "ONLINE"


def test_sync_local_copies_documents_incrementally():
    app, service, main_db, _, local_db = _setup()
    with TestClient(app) as client:
        headers = _admin_headers(client)

        asyncio.run(main_db["quotations"].insert_one({"_id": "q1", "updated_at": utcnow()}))
        first = client.post("/admin/database/sync-local", headers=headers).json()
        assert first["total"] == 1
        assert asyncio.run(local_db["quotations"].count_documents({})) == 1

        second = client.post("/admin/database/sync-local", headers=headers).json()
        assert second["total"] == 0


def test_sync_secondary_drains_queue():
    app, service, _, secondary_db, _ = _setup()
    with TestClient(app) as client:
        headers = _admin_headers(client)

        asyncio.run(
            service.enqueue("quotations", "q2", {"_id": "q2", "updated_at": utcnow()})
        )
        status = client.get("/admin/database/status", headers=headers).json()
        assert status["secondary"]["sync_status"] == "SYNCING"

        result = client.post("/admin/database/sync-secondary", headers=headers).json()
        assert result["jobs_processed"] == 1
        assert asyncio.run(secondary_db["quotations"].count_documents({"_id": "q2"})) == 1


def test_sync_logs_are_recorded():
    app, service, main_db, _, _ = _setup()
    with TestClient(app) as client:
        headers = _admin_headers(client)
        asyncio.run(main_db["quotations"].insert_one({"_id": "q1", "updated_at": utcnow()}))
        client.post("/admin/database/sync-local", headers=headers)
        logs = client.get("/admin/database/sync-logs", headers=headers).json()["logs"]
        assert logs and logs[0]["target"] == "LOCAL"
        assert logs[0]["status"] == "SUCCESS"


def test_admin_database_requires_admin_role(app, manager_headers):
    with TestClient(app) as client:
        assert client.get("/admin/database/status", headers=manager_headers).status_code == 403
        assert client.get("/admin/database/status").status_code in (401, 403)
