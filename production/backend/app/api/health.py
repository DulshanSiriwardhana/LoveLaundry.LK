from fastapi import APIRouter, HTTPException, status
from fastapi.responses import PlainTextResponse

from ..core.metrics import render_prometheus
from ..db.connection import DatabaseKind, ping

router = APIRouter(tags=["health"])


@router.get("/")
async def root() -> dict:
    return {"service": "production-backend", "status": "ok"}


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/metrics")
async def metrics() -> PlainTextResponse:
    return PlainTextResponse(
        render_prometheus(), media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@router.get("/ready")
async def ready() -> dict:
    results = {}
    for kind in DatabaseKind:
        results[kind.value] = await ping(kind)
    if not all(results.values()):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, {"databases": results})
    return {"status": "ready", "databases": results}
