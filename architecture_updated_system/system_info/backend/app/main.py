"""system_info HTTP API.

Security posture:
  * binds to loopback by default;
  * optionally requires a shared ``SCAN_API_KEY`` header on ``/api/*``;
  * scans ONLY the configured ``SCAN_SOURCE_ROOT`` (read-only, path-bounded);
  * exposes no path parameter that could traverse outside the root.
"""
from __future__ import annotations

import threading

from fastapi import Depends, FastAPI, Header, HTTPException, status

from . import __version__
from .config import get_scan_settings
from .models import ArchitectureModel, DependencyGraph, ServiceDetail, ServiceSummary, Summary
from .scanner import build_model, redact

app = FastAPI(
    title="LoveLaundry System Info",
    version=__version__,
    description="Bounded, read-only architecture intelligence for LoveLaundry.LK.",
)

_lock = threading.Lock()
_cache: dict | None = None


def _scan(force: bool = False) -> dict:
    global _cache
    with _lock:
        if _cache is None or force:
            root = get_scan_settings().resolved_root()
            _cache = build_model(root)
        return _cache


def require_key(x_scan_api_key: str | None = Header(default=None)) -> None:
    expected = get_scan_settings().scan_api_key
    if expected and x_scan_api_key != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or missing scan API key")


@app.get("/health")
async def health() -> dict:
    root = get_scan_settings().resolved_root()
    return {
        "status": "ok",
        "version": __version__,
        "source_root": str(root),
        "source_available": root.is_dir(),
    }


@app.get("/api/summary", response_model=Summary, dependencies=[Depends(require_key)])
async def summary() -> dict:
    model = _scan()
    return {
        "source_root": model["source_root"],
        "service_count": model["service_count"],
        "route_count": model["route_count"],
        "services": [
            {
                "name": s["name"],
                "language": s["language"],
                "framework": s["framework"],
                "mount_prefix": s["mount_prefix"],
                "route_count": len(s["routes"]),
                "python_files": s["python_files"],
                "env_var_names": s["env_var_names"],
                "entrypoints": s["entrypoints"],
            }
            for s in model["services"]
        ],
    }


@app.get("/api/services", response_model=list[ServiceSummary], dependencies=[Depends(require_key)])
async def services() -> list[dict]:
    model = _scan()
    return [
        {
            "name": s["name"],
            "language": s["language"],
            "framework": s["framework"],
            "mount_prefix": s["mount_prefix"],
            "route_count": len(s["routes"]),
            "python_files": s["python_files"],
            "env_var_names": s["env_var_names"],
            "entrypoints": s["entrypoints"],
        }
        for s in model["services"]
    ]


@app.get(
    "/api/services/{name}",
    response_model=ServiceDetail,
    dependencies=[Depends(require_key)],
)
async def service_detail(name: str) -> dict:
    model = _scan()
    for s in model["services"]:
        if s["name"] == name:
            return {
                **s,
                "route_count": len(s["routes"]),
            }
    raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown service: {redact(name)}")


@app.get("/api/routes", dependencies=[Depends(require_key)])
async def routes() -> dict:
    model = _scan()
    return {
        "total": model["route_count"],
        "services": {s["name"]: s["routes"] for s in model["services"]},
    }


@app.get("/api/dependencies", response_model=DependencyGraph, dependencies=[Depends(require_key)])
async def dependencies() -> dict:
    model = _scan()
    nodes = [s["name"] for s in model["services"]]
    # Static, verified edges discovered in Stage 1 (see initial_system_audit.md).
    edges = [
        {"from": "love-bot", "to": "bill-service", "via": "BILL_SERVICE_URL"},
        {"from": "love-bot", "to": "quotation-service", "via": "QUOTATION_SERVICE_URL"},
        {"from": "love-ai", "to": "mongo", "via": "MONGO_URI"},
        {"from": "quotations-ui", "to": "bill-service", "via": "VITE_BILLS_API_URL"},
        {"from": "quotations-ui", "to": "laundry-management", "via": "VITE_MGMT_API_URL"},
        {"from": "quotations-ui", "to": "user-service", "via": "VITE_USER_API_URL"},
        {"from": "quotations-ui", "to": "worker-service", "via": "VITE_WORKERS_API_URL"},
        {"from": "quotations-ui", "to": "love-ai", "via": "VITE_AI_API_URL"},
    ]
    return {"nodes": nodes + ["love-bot", "mongo"], "edges": edges}


@app.post("/api/scan", response_model=ArchitectureModel, dependencies=[Depends(require_key)])
async def rescan() -> dict:
    model = _scan(force=True)
    return {
        "source_root": model["source_root"],
        "service_count": model["service_count"],
        "route_count": model["route_count"],
        "services": [
            {**s, "route_count": len(s["routes"])} for s in model["services"]
        ],
    }
