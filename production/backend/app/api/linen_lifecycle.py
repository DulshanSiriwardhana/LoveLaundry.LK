from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..core.principal import assert_organization_access
from ..core.security import get_current_user
from ..permissions.service import organization_dependency, require_capability
from ..runtime import get_runtime

router = APIRouter(prefix="/linen", tags=["linen-lifecycle"])


class RegisterLinenRequest(BaseModel):
    organization_id: str
    code: str = Field(min_length=1, max_length=200)
    linen_id: str | None = None
    owner_organization_id: str | None = None
    category: str = ""
    item_type: str = ""
    size: str = ""
    material: str = ""
    current_location: str | None = None
    correlation_id: str = ""


class ScanRequest(BaseModel):
    organization_id: str
    scan_id: str = Field(min_length=1, max_length=200)
    code: str = Field(min_length=1, max_length=200)
    action: str = Field(min_length=1, max_length=80)
    scanner_id: str = ""
    source: str = "scanner"
    session_id: str = ""
    batch_id: str = ""
    to_organization_id: str = ""
    location: str = ""
    occurred_at: str = ""
    correlation_id: str = ""


class BatchScanRequest(BaseModel):
    scans: list[ScanRequest] = Field(min_length=1, max_length=500)


@router.post(
    "/items/register",
    dependencies=[Depends(require_capability("edit_linen"))],
)
async def register_linen(payload: RegisterLinenRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().linen_service.register(payload.model_dump(), principal)


@router.post(
    "/items/scan",
    dependencies=[Depends(require_capability("record_scans"))],
)
async def record_scan(payload: ScanRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().linen_service.record_scan(payload.model_dump(), principal)


@router.post(
    "/items/scans/batch",
    dependencies=[Depends(require_capability("record_scans"))],
)
async def record_batch_scans(
    payload: BatchScanRequest, principal=Depends(get_current_user)
) -> dict:
    service = get_runtime().linen_service
    results = [
        await service.record_scan(scan.model_dump(), principal) for scan in payload.scans
    ]
    outcomes: dict[str, int] = {}
    for result in results:
        outcome = str(result.get("result") or "unknown")
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return {"count": len(results), "outcomes": outcomes, "results": results}


@router.get(
    "/items",
    dependencies=[Depends(organization_dependency("view_linen"))],
)
async def list_linen(
    organization_id: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    scoped = organization_id or (
        principal.get("organization_id") if not principal.get("platform_admin") else None
    )
    return await get_runtime().linen_repository.list(
        organization_id=scoped, stage=stage, status=status, limit=limit
    )


@router.get(
    "/items/{linen_id}",
    dependencies=[Depends(require_capability("view_linen"))],
)
async def linen_profile(linen_id: str, principal=Depends(get_current_user)) -> dict:
    result = await get_runtime().linen_service.profile(linen_id, principal)
    profile = result.get("profile") or {}
    # The scanner verifies a tag through this endpoint without mutating state.
    # Additive flat fields keep the existing `{profile, history}` contract while
    # giving it the `status`/`current_stage` projection it reads.
    projection = {
        key: profile.get(key)
        for key in (
            "linen_id",
            "organization_id",
            "category",
            "item_type",
            "description",
            "size",
            "client_name",
            "status",
            "current_stage",
            "wash_count",
            "last_seen_at",
        )
    }
    return {**result, **projection}


@router.get(
    "/items/{linen_id}/history",
    dependencies=[Depends(require_capability("view_linen"))],
)
async def linen_history(linen_id: str, principal=Depends(get_current_user)) -> dict:
    profile = await get_runtime().linen_service.profile(linen_id, principal)
    return {"linen_id": linen_id, "history": profile["history"]}


@router.post(
    "/missing/scan",
    dependencies=[Depends(organization_dependency("edit_linen"))],
)
async def scan_for_missing(
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    scoped = organization_id or principal.get("organization_id")
    # The dependency validates a caller-supplied organization_id; keep an
    # explicit check here so this endpoint stays safe if it is ever refactored.
    assert_organization_access(principal, scoped)
    return await get_runtime().missing_monitor.scan(scoped)


@router.get(
    "/alerts",
    dependencies=[Depends(organization_dependency("view_linen"))],
)
async def list_missing_alerts(
    organization_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    scoped = organization_id or (
        principal.get("organization_id") if not principal.get("platform_admin") else None
    )
    return await get_runtime().linen_repository.list_alerts(scoped, status, limit)


@router.post(
    "/alerts/{alert_id}/resolve",
    dependencies=[Depends(require_capability("edit_linen"))],
)
async def resolve_missing_alert(
    alert_id: str, principal=Depends(get_current_user)
) -> dict:
    return await get_runtime().missing_monitor.resolve(
        alert_id, str(principal.get("actor_id") or ""), principal
    )
