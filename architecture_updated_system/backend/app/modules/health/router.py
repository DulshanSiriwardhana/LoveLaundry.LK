"""Operational health routes (legacy parity for ``GET /`` and ``GET /health``)."""
from __future__ import annotations

from fastapi import APIRouter

from ... import __version__
from ...core.clock import now

router = APIRouter(tags=["health"])


@router.get("/")
async def root() -> dict:
    return {"service": "lovelaundry-backend", "status": "ok", "version": __version__}


@router.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "lovelaundry-backend",
        "version": __version__,
        "time": now().isoformat(),
    }


@router.get("/health/db")
async def health_db() -> dict:
    """Ping each database role. Never raises; reports per-role reachability."""
    from ...db import ROLE_LOCAL, ROLE_MAIN, ROLE_SECONDARY, ping

    roles = {}
    for role in (ROLE_MAIN, ROLE_SECONDARY, ROLE_LOCAL):
        roles[role.lower()] = await ping(role)
    return {
        "status": "ok" if roles["main"] else "degraded",
        "roles": roles,
    }
