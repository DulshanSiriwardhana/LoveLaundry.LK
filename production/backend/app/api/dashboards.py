"""Operational dashboards sourced from authoritative stores."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from ..core.security import get_current_user
from ..permissions.service import require_capability, require_platform_admin
from ..runtime import get_runtime

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get(
    "/platform",
    dependencies=[Depends(require_platform_admin)],
)
async def platform_dashboard(principal=Depends(get_current_user)) -> dict:
    return await get_runtime().dashboards.platform(principal)


@router.get(
    "/hotel",
    dependencies=[Depends(require_capability("view_dashboards"))],
)
async def hotel_dashboard(
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    return await get_runtime().dashboards.hotel(principal, organization_id)


@router.get(
    "/laundry",
    dependencies=[Depends(require_capability("view_dashboards"))],
)
async def laundry_dashboard(
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    return await get_runtime().dashboards.laundry(principal, organization_id)
