"""Scanner unit tests: bounding, redaction, extraction."""
from __future__ import annotations

from app.scanner import build_model, redact


def test_scans_python_and_js_services(scan_env):
    model = build_model(scan_env)
    names = {s["name"] for s in model["services"]}
    assert names == {"svc-a", "web-app"}
    assert model["service_count"] == 2


def test_extracts_routes_with_prefix(scan_env):
    model = build_model(scan_env)
    svc = next(s for s in model["services"] if s["name"] == "svc-a")
    paths = {(r["method"], r["path"]) for r in svc["routes"]}
    assert ("GET", "/") in paths
    assert ("GET", "/widgets/{widget_id}") in paths
    assert ("POST", "/widgets") in paths


def test_collects_env_names_not_values(scan_env):
    model = build_model(scan_env)
    svc = next(s for s in model["services"] if s["name"] == "svc-a")
    assert "JWT_SECRET" in svc["env_var_names"]
    assert "MASTER_KEY" in svc["env_var_names"]
    # The real value from .env must never appear anywhere in the model.
    blob = str(model)
    assert "REAL_SECRET_VALUE_DO_NOT_LEAK" not in blob


def test_never_follows_symlink_outside_root(scan_env):
    model = build_model(scan_env)
    for svc in model["services"]:
        for r in svc["routes"]:
            assert "/leak" not in r["path"]


def test_detects_language_and_deps(scan_env):
    model = build_model(scan_env)
    svc = next(s for s in model["services"] if s["name"] == "svc-a")
    assert svc["language"] == "python"
    assert svc["framework"] == "fastapi"
    assert "fastapi" in svc["dependencies"]
    web = next(s for s in model["services"] if s["name"] == "web-app")
    assert web["language"] in {"javascript", "typescript"}


def test_redact_masks_credentials():
    assert "***REDACTED***" in redact("sk-abcdefghijklmnopqrstuvwxyz")
    assert "***REDACTED***" in redact("mongodb+srv://user:pass@cluster/db")
