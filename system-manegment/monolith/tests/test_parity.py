"""Parity gate: monolith must serve the current microservice API surface.

Each test compares the monolith (merged, read-only reuse) against the live
microservice apps. All imports go through src/monolith/loader.py — originals
are never modified.
"""
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from monolith.loader import load_apps
from monolith.main import SKIP_PATHS, _iter_effective_routes, app as mono_app

apps = load_apps()
client = TestClient(mono_app, raise_server_exceptions=False)


def _business_routes(svc_app):
    out = []
    for eff_path, r in _iter_effective_routes(svc_app.router):
        if not isinstance(r, APIRoute):
            continue
        if eff_path in SKIP_PATHS:
            continue
        # attach effective path for the caller without mutating the source
        out.append((eff_path, r))
    return out


def _mono_keys():
    return {(r.path, tuple(sorted(r.methods or []))) for r in mono_app.routes if isinstance(r, APIRoute)}


def test_unified_health_lists_all_subsystems():
    res = client.get("/health")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "ok"
    assert sorted(body["subsystems"]) == ["ai", "bill", "mgmt", "quotations", "users", "workers"]
    assert sum(body["merged_routes"].values()) > 100


def test_merge_stats_match_route_inventory():
    res = client.get("/monolith/routes")
    assert res.status_code == 200, res.text
    body = res.json()
    assert sum(body["merged_routes"].values()) == len(_mono_keys()) - 2  # minus /health + /monolith/routes


def test_every_microservice_business_route_exists_in_monolith():
    mono_keys = _mono_keys()
    missing: list[str] = []
    for svc in ("bill", "mgmt", "users", "quotations", "workers"):
        for path, r in _business_routes(apps[svc]):
            # remapped admin paths
            if svc == "users" and (path == "/admin/database" or path.startswith("/admin/database/")):
                path = "/users" + path
            if svc == "quotations" and (path == "/admin/database" or path.startswith("/admin/database/")):
                path = "/quotations" + path
            key = (path, tuple(sorted(r.methods or [])))
            if key not in mono_keys:
                missing.append(f"{svc} {sorted(r.methods)} {path}")
    # love-ai contributes only insight routes
    for path, r in _business_routes(apps["ai"]):
        if not path.startswith("/api/ai"):
            continue
        key = (path, tuple(sorted(r.methods or [])))
        if key not in mono_keys:
            missing.append(f"ai {sorted(r.methods)} {path}")
    assert not missing, "routes missing from monolith:\n" + "\n".join(missing[:40])


def test_bill_admin_kept_canonical_and_remaps_exist():
    paths = {r.path for r in mono_app.routes if isinstance(r, APIRoute)}
    assert "/admin/database/status" in paths  # bill canonical
    assert "/users/admin/database/status" in paths
    assert "/quotations/admin/database/status" in paths


def test_auth_still_enforced_on_merged_routes():
    # No token -> must NOT succeed; exact code (401/403) mirrors microservices.
    for path in ("/bills", "/gatepasses", "/deliveries", "/monthly/receiving/x/2026/1"):
        res = client.get(path)
        assert res.status_code in (401, 403, 422), f"{path} -> {res.status_code} {res.text[:120]}"
    res = client.get("/api/customers")
    assert res.status_code in (401, 403, 422), f"/api/customers -> {res.status_code}"
    # Route exists + validates (422 proves the handler, not 404)
    res = client.post("/auth/login", json={})
    assert res.status_code == 422, res.text[:200]


def test_openapi_contains_every_subsystem():
    res = client.get("/openapi.json")
    assert res.status_code == 200, res.text
    paths = res.json()["paths"]
    for needle in (
        "/bills",
        "/gatepasses",
        "/monthly/",
        "/api/customers",
        "/auth/login",
        "/users",
        "/quotations",
        "/workers",
        "/api/ai/",
    ):
        assert any(p.startswith(needle) for p in paths), f"openapi missing {needle}"


def test_jwt_cross_service_compatible():
    """One JWT_SECRET signs for all subsystems (monolith single-secret invariant)."""
    import mono_users.auth_helper as users_auth
    import mono_bill.auth_helper as bill_auth

    token = users_auth.create_access_token(
        {"user_id": "1", "auth_id": "tester", "user_name": "Tester", "role": "ADMIN", "status": "active"}
    )
    assert bill_auth.verify_token(token)["auth_id"] == "tester"
