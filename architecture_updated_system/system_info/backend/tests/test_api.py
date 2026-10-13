"""API tests for the system_info service."""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def _client(scan_env):
    import app.main as main

    importlib.reload(main)
    return TestClient(main.app)


def test_health(scan_env):
    c = _client(scan_env)
    r = c.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["source_available"] is True


def test_summary(scan_env):
    c = _client(scan_env)
    r = c.get("/api/summary")
    assert r.status_code == 200
    body = r.json()
    assert body["service_count"] == 2
    assert body["route_count"] >= 3


def test_services_and_detail(scan_env):
    c = _client(scan_env)
    r = c.get("/api/services")
    assert r.status_code == 200
    names = {s["name"] for s in r.json()}
    assert names == {"svc-a", "web-app"}

    d = c.get("/api/services/svc-a")
    assert d.status_code == 200
    assert d.json()["language"] == "python"
    assert any(rt["path"].startswith("/widgets") for rt in d.json()["routes"])


def test_service_detail_unknown_returns_404(scan_env):
    c = _client(scan_env)
    assert c.get("/api/services/does-not-exist").status_code == 404


def test_routes_endpoint(scan_env):
    c = _client(scan_env)
    r = c.get("/api/routes")
    assert r.status_code == 200
    assert r.json()["total"] >= 3


def test_dependencies_endpoint(scan_env):
    c = _client(scan_env)
    r = c.get("/api/dependencies")
    assert r.status_code == 200
    assert len(r.json()["edges"]) >= 1


def test_rescan_endpoint(scan_env):
    c = _client(scan_env)
    r = c.post("/api/scan")
    assert r.status_code == 200
    assert r.json()["service_count"] == 2


def test_api_key_enforced_when_configured(scan_env, monkeypatch):
    import app.config

    monkeypatch.setenv("SCAN_API_KEY", "s3cret")
    app.config.get_scan_settings.cache_clear()
    c = _client(scan_env)
    assert c.get("/api/summary").status_code == 401
    assert c.get("/api/summary", headers={"X-Scan-Api-Key": "s3cret"}).status_code == 200
