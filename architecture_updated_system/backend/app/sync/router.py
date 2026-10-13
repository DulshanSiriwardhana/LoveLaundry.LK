"""``/admin/database/*`` — admin-only database health + synchronization."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from ..core.security import require_role
from .service import SyncService

router = APIRouter(prefix="/admin/database", tags=["admin-database"])

_ADMIN = ["ADMIN"]


def get_sync_service(request: Request) -> SyncService:
    return request.app.state.sync_service


@router.get("/status", dependencies=[Depends(require_role(_ADMIN))])
async def database_status(service: SyncService = Depends(get_sync_service)):
    return await service.status()


@router.post("/sync-local", dependencies=[Depends(require_role(_ADMIN))])
async def sync_local(service: SyncService = Depends(get_sync_service)):
    return await service.sync_local()


@router.post("/sync-secondary", dependencies=[Depends(require_role(_ADMIN))])
async def sync_secondary(
    limit: int = Query(200, ge=1, le=1000),
    service: SyncService = Depends(get_sync_service),
):
    return await service.sync_secondary(limit)


@router.get("/sync-logs", dependencies=[Depends(require_role(_ADMIN))])
async def sync_logs(
    limit: int = Query(50, ge=1, le=200),
    service: SyncService = Depends(get_sync_service),
):
    return await service.logs(limit)
