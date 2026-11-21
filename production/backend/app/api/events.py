from fastapi import APIRouter, Depends, Query

from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..runtime import get_runtime

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/stats", dependencies=[Depends(require_capability("view_events"))])
async def event_stats() -> dict:
    return await get_runtime().outbox.stats()


@router.get("/dead-letters", dependencies=[Depends(require_capability("view_events"))])
async def dead_letters(limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    return await get_runtime().outbox.dead_letters(limit)


@router.post(
    "/dead-letters/{event_id}/retry",
    dependencies=[Depends(require_capability("retry_events"))],
)
async def retry_dead_letter(event_id: str) -> dict:
    retried = await get_runtime().outbox.retry_dead_letter(event_id)
    return {"event_id": event_id, "retried": retried}


@router.post("/reconcile", dependencies=[Depends(require_capability("view_events"))])
async def reconcile(
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    return await get_runtime().reconciliation.run(organization_id, principal)


@router.get("/reconciliation", dependencies=[Depends(require_capability("view_events"))])
async def reconciliation_runs(
    organization_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await get_runtime().reconciliation.list_runs(organization_id, principal, limit)
