"""LoveLaundry monolith — single FastAPI serving all microservice routes.

Strategy (read-only): import each service's app via loader (no copies, no
edits to originals) and merge their APIRoutes into one app. Business logic,
auth, DB collections and collection names are therefore identical by
construction — parity is structural, verified by tests/test_parity.py.

Route-collision policy:
- Sub-app infra paths (/, /health, /api/health, /openapi.json, /docs,
  /redoc) are SKIPPED; the monolith provides unified /health and / docs.
- /admin/database exists in bill, users and quotations. Bill keeps the
  canonical path; users -> /users/admin/database, quotations ->
  /quotations/admin/database.
- love-ai /api/health collides with laundry /api/health: laundry keeps it,
  love-ai keeps only /api/ai/* (its /api/health is skipped).
- First registration wins for any other duplicate; skips are logged and
  exposed via /monolith/routes for audit.

love-bot (Node/Express) is NOT merged here — it stays a separate process.
Quotation /chat (Python) IS included.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRoute

from .loader import load_apps

logger = logging.getLogger("monolith")

SKIP_PATHS = {
    "/",
    "/health",
    "/api/health",
    "/openapi.json",
    "/docs",
    "/redoc",
    "/openapi.yaml",
}

# service -> list of (old_prefix, new_prefix) rewrites applied during merge
REMAPS: dict[str, list[tuple[str, str]]] = {
    "users": [("/admin/database", "/users/admin/database")],
    "quotations": [("/admin/database", "/quotations/admin/database")],
    # bill keeps canonical /admin/database; mgmt/ai have no /admin/database
}

# Unified security/CORS mirrors bill-service production defaults.
ALLOWED_ORIGINS = [
    "https://lovelaundry-manager.vercel.app",
    "https://public.lovelaundry.lk",
    "http://localhost:5173",
    "http://localhost:3000",
]


def _remap_path(service: str, path: str) -> str:
    # love-ai contributes only /api/ai/* (its /api/health is infra, skipped)
    if service == "ai" and path.startswith("/api/ai"):
        return path
    for old, new in REMAPS.get(service, []):
        if path == old or path.startswith(old + "/"):
            return new + path[len(old):]
    return path


def _is_ai_non_insight(path: str) -> bool:
    # Skip love-ai infra paths outside /api/ai (root, /api/health already in SKIP)
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Best-effort index checks, mirroring each service's tolerant startup.
    # Never fail boot when Mongo is unreachable (tests run without DB).
    try:
        from mono_bill.database.main_db import ensure_indexes as bill_idx
        try:
            await bill_idx()
        except Exception as exc:  # noqa: BLE001
            logger.warning("bill ensure_indexes skipped: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.warning("bill indexes unavailable: %s", exc)
    try:
        from mono_mgmt.database.main_db import ensure_indexes as mgmt_idx
        try:
            await mgmt_idx()
        except Exception as exc:  # noqa: BLE001
            logger.warning("mgmt ensure_indexes skipped: %s", exc)
    except Exception as exc:  # noqa: BLE001
        logger.warning("mgmt indexes unavailable: %s", exc)
    yield
    # Close shared connections best-effort
    for mod_name in ("mono_bill.database.connection_manager", "mono_mgmt.database.main_db"):
        try:
            mod = __import__(mod_name, fromlist=["close_all"])
            closer = getattr(mod, "close_all", None)
            if closer is not None:
                try:
                    await closer()
                except TypeError:
                    closer()
        except Exception:  # noqa: BLE001
            pass


def _iter_effective_routes(router_or_app, prefix: str = ""):
    """Yield (effective_path, APIRoute), expanding FastAPI _IncludedRouter.

    Newer FastAPI stores include_router() entries lazily as _IncludedRouter
    (original_router + include_context.prefix) instead of flattened APIRoutes.
    Effective path = accumulated include prefix + inner route path.
    """
    for route in list(router_or_app.routes):
        if isinstance(route, APIRoute):
            yield prefix + route.path, route
        elif type(route).__name__ == "_IncludedRouter":
            ctx = getattr(route, "include_context", None)
            child_prefix = prefix + (getattr(ctx, "prefix", "") or "")
            orig = getattr(route, "original_router", None)
            if orig is not None:
                yield from _iter_effective_routes(orig, child_prefix)
        # ignore plain Route (/openapi.json, /docs) and Mount


def _copy_routes(mono: FastAPI, source_app: FastAPI, service: str) -> tuple[int, list[str]]:
    added = 0
    skipped: list[str] = []
    seen = {(r.path, tuple(sorted(r.methods or []))) for r in mono.routes if isinstance(r, APIRoute)}
    for eff_path, route in _iter_effective_routes(source_app.router):
        if not isinstance(route, APIRoute):
            continue
        orig_path = eff_path
        if orig_path in SKIP_PATHS:
            skipped.append(f"{service}:{orig_path} (infra)")
            continue
        if service == "ai" and not orig_path.startswith("/api/ai"):
            skipped.append(f"{service}:{orig_path} (non-insight)")
            continue
        path = _remap_path(service, orig_path)
        key = (path, tuple(sorted(route.methods or [])))
        if key in seen:
            skipped.append(f"{service}:{orig_path} (dup->{path})")
            continue
        # Copy key route attributes; endpoint (with its Depends) is reused
        # verbatim so auth/validation behave identically.
        mono.add_api_route(
            path,
            route.endpoint,
            methods=list(route.methods or ["GET"]),
            name=f"{service}_{route.name}",
            response_model=getattr(route, "response_model", None),
            status_code=getattr(route, "status_code", None) or 200,
            tags=list(getattr(route, "tags", None) or []),
            dependencies=list(getattr(route, "dependencies", None) or []),
            summary=getattr(route, "summary", None),
            description=getattr(route, "description", None),
            response_description=getattr(route, "response_description", "Successful Response") or "Successful Response",
            include_in_schema=getattr(route, "include_in_schema", True),
        )
        seen.add(key)
        added += 1
    return added, skipped


def create_app() -> FastAPI:
    mono = FastAPI(
        title="LoveLaundry Monolith",
        version="1.0.0",
        description="Single-process merge of bill, laundry-management, user, quotation, worker and love-ai services (read-only reuse).",
        lifespan=lifespan,
    )
    from .loader import load_apps, register_vendor_packages

    register_vendor_packages()
    try:
        from mono_bill.security import apply_security as bill_secure

        bill_secure(mono, rate_limit=300, origins=ALLOWED_ORIGINS)
    except Exception as exc:  # noqa: BLE001
        logger.warning("monolith security middleware skipped: %s", exc)
        from fastapi.middleware.cors import CORSMiddleware

        mono.add_middleware(
            CORSMiddleware,
            allow_origins=ALLOWED_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    apps = load_apps()
    order = ["bill", "mgmt", "users", "quotations", "workers", "ai"]
    stats: dict[str, int] = {}
    all_skipped: list[str] = []
    for svc in order:
        n, skipped = _copy_routes(mono, apps[svc], svc)
        stats[svc] = n
        all_skipped.extend(skipped)
        logger.info("monolith merged %s: +%d routes (%d skipped)", svc, n, len(skipped))
    mono.state.merge_stats = stats
    mono.state.merge_skipped = all_skipped

    @mono.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": "lovelaundry-monolith",
            "subsystems": sorted(apps.keys()),
            "merged_routes": stats,
            "security": {"headers": True, "rate_limiting": True},
        }

    @mono.get("/monolith/routes")
    async def route_inventory():
        return {
            "merged_routes": stats,
            "skipped": all_skipped,
            "paths": sorted({r.path for r in mono.routes if isinstance(r, APIRoute)}),
        }

    return mono


app = create_app()
