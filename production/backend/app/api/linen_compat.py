"""Compatibility aliases for the older ``/linens`` client vocabulary.

The linen-room and hotel-scanner frontends call ``/linens/...`` while the
canonical workflow lives under ``/linen/...``. These handlers reuse the
authoritative lifecycle, linen repository and identity service: the alias layer
only supplies the URL and response shape those clients were built against.

The router is mounted both at ``/linens`` and under the client dataAPI namespace
(``/bills/linens``).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..core.clock import current_period
from ..core.principal import (
    assert_organization_access,
    repository_scope,
)
from ..core.security import get_current_user
from ..linen.lifecycle import (
    ACTION_STAGE,
    ALLOWED_TRANSITIONS,
    STAGES,
)
from ..permissions.service import organization_dependency, require_capability
from ..runtime import get_runtime
from . import linen as linen_api
from .bills import single_organization_scope
from .linen import LinenOperationsResponse, MovementRequest

router = APIRouter(tags=["linen-compat"])

LEGACY_STATUSES = (
    "IN_STOCK",
    "AT_CLIENT",
    "COLLECTED",
    "AT_LAUNDRY",
    "WASHING",
    "DRYING",
    "PRESSING",
    "READY",
    "DELIVERED",
    "MISSING",
    "DAMAGED",
    "RETIRED",
)

STAGE_TO_LEGACY = {
    "registered": "IN_STOCK",
    "assigned_to_organization": "IN_STOCK",
    "available_in_inventory": "IN_STOCK",
    "returned_to_circulation": "IN_STOCK",
    "collected_for_laundry": "COLLECTED",
    "dispatched_from_client": "COLLECTED",
    "received_at_laundry": "AT_LAUNDRY",
    "sorted_and_classified": "AT_LAUNDRY",
    "quality_inspection": "AT_LAUNDRY",
    "washing_in_progress": "WASHING",
    "drying_in_progress": "DRYING",
    "ironing_and_folding": "PRESSING",
    "ready_for_dispatch": "READY",
    "dispatched_from_laundry": "DELIVERED",
    "received_at_client": "AT_CLIENT",
    "missing": "MISSING",
    "overdue": "MISSING",
    "damaged": "DAMAGED",
    "rejected": "DAMAGED",
    "quarantined": "DAMAGED",
    "under_investigation": "MISSING",
    "retired": "RETIRED",
    "transferred": "IN_STOCK",
    "unknown": "MISSING",
}

LEGACY_TO_STAGES = {
    status: tuple(stage for stage, value in STAGE_TO_LEGACY.items() if value == status)
    for status in LEGACY_STATUSES
}


class LinenScanAction(BaseModel):
    action: str = Field(min_length=1, max_length=80)
    location: str | None = None
    user: str | None = None
    related_order: str | None = None
    notes: str | None = None


class LinenTagGenerate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    item_type: str = Field(min_length=1, max_length=80)
    quantity: int = Field(gt=0, le=10000)
    hotel_id: str = Field(min_length=1)
    organization_id: str | None = None
    size: str | None = None
    color: str | None = None
    department: str | None = None
    # Accepted for old clients but deliberately unused: hotel identity comes
    # from the central registry selected by hotel_id.
    client_name: str | None = None
    hotel_code: str | None = None
    start_number: int | None = Field(default=None, ge=1, le=259974)


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


async def _registry() -> dict[str, dict]:
    rows = await get_runtime().platform_service.organizations()
    return {
        str(row.get("organization_id") or ""): {
            "name": str(row.get("name") or ""),
            "hotel_code": str(row.get("hotel_code") or ""),
            "type": str(row.get("type") or ""),
        }
        for row in rows
        if row.get("organization_id")
    }


def _registry_for(registry: dict[str, dict], organization_id: str) -> dict:
    match = registry.get(str(organization_id or ""))
    if match is None:
        match = next(
            (
                value
                for key, value in registry.items()
                if key.casefold() == str(organization_id or "").casefold()
            ),
            None,
        )
    return match or {"name": "", "hotel_code": "", "type": ""}


def _legacy_status(profile: dict) -> str:
    stage = str(profile.get("current_stage") or "")
    return STAGE_TO_LEGACY.get(stage, "IN_STOCK")


def _linen_view(profile: dict, registry: dict[str, dict]) -> dict:
    owner = str(profile.get("owner_organization_id") or profile.get("organization_id") or "")
    hotel = _registry_for(registry, owner)
    stage = str(profile.get("current_stage") or "")
    workflow_status = str(profile.get("status") or "")
    return {
        "id": str(profile.get("linen_id") or ""),
        "linen_id": str(profile.get("linen_id") or ""),
        "category": str(profile.get("category") or ""),
        "item_type": str(profile.get("item_type") or ""),
        "description": profile.get("description") or None,
        "size": profile.get("size") or None,
        "color": profile.get("material") or None,
        "client_name": hotel["name"],
        "department": profile.get("department") or None,
        "hotel_id": owner or None,
        "hotel_code": hotel["hotel_code"] or None,
        "item_code": profile.get("item_code") or None,
        "status": _legacy_status(profile),
        "condition": "DAMAGED" if stage in {"damaged", "rejected", "retired"} else "GOOD",
        "location": profile.get("current_location") or None,
        "wash_count": int(profile.get("wash_count") or 0),
        "last_washed_date": profile.get("last_washed_date"),
        "last_scanned_date": profile.get("last_seen_at"),
        "retirement_date": profile.get("retirement_date"),
        "notes": profile.get("notes"),
        "created_at": profile.get("created_at"),
        "updated_at": profile.get("updated_at"),
        "current_stage": stage,
        "workflow_status": workflow_status,
    }


async def _scoped_profiles(
    principal: dict, organization_id: str | None, limit: int
) -> list[dict]:
    scope = repository_scope(principal, organization_id)
    if scope is None:
        return await get_runtime().linen_repository.list(limit=min(limit, 5000))
    identifiers = [scope] if isinstance(scope, str) else list(scope)
    rows: dict[str, dict] = {}
    for identifier in identifiers:
        for profile in await get_runtime().linen_repository.list(
            organization_id=identifier, limit=min(limit, 5000)
        ):
            rows[str(profile.get("linen_id") or "")] = profile
    return list(rows.values())


@router.post("/linens/movements", dependencies=[Depends(require_capability("edit_linen"))])
async def record_movement(
    payload: MovementRequest, principal=Depends(get_current_user)
) -> dict:
    return await linen_api.record_movement(payload, principal=principal)


@router.get(
    "/linens/operations",
    response_model=LinenOperationsResponse,
    dependencies=[Depends(require_capability("view_linen"))],
)
async def linen_operations(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
    principal=Depends(get_current_user),
) -> dict:
    return await linen_api.linen_operations(period, principal=principal)


@router.get("/linens/transitions", dependencies=[Depends(require_capability("view_linen"))])
async def linen_transitions(principal=Depends(get_current_user)) -> dict:
    """Actions allowed from each canonical stage.

    Scanner clients send action names as ``toStatus``, so rules map a stage to
    the action names that can legally follow it. Transition wording stays in
    the lifecycle module; this endpoint only serialises it.
    """

    rules = []
    for stage in STAGES:
        targets = ALLOWED_TRANSITIONS.get(stage, set())
        actions = sorted(
            action for action, target in ACTION_STAGE.items() if target in targets
        )
        rules.append({"from_status": stage, "to_statuses": actions})
    return {"statuses": list(STAGES), "transition_rules": rules, "violation_mode": "block"}


@router.get(
    "/linens/stats/summary", dependencies=[Depends(require_capability("view_linen"))]
)
async def linen_stats(
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    profiles = await _scoped_profiles(principal, organization_id, 5000)
    counts = {status: 0 for status in LEGACY_STATUSES}
    total_wash_cycles = 0
    recently_scanned = 0
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    for profile in profiles:
        counts[_legacy_status(profile)] += 1
        total_wash_cycles += int(profile.get("wash_count") or 0)
        scanned = _parse_timestamp(profile.get("last_seen_at"))
        if scanned is not None and scanned >= cutoff:
            recently_scanned += 1
    return {
        "total": len(profiles),
        **counts,
        "total_wash_cycles": total_wash_cycles,
        "recently_scanned": recently_scanned,
    }


@router.get(
    "/linens",
    dependencies=[Depends(organization_dependency("view_linen"))],
)
async def list_legacy_linens(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status: str | None = Query(default=None),
    client_name: str | None = Query(default=None),
    condition: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=5000),
    organization_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    profiles = await _scoped_profiles(principal, organization_id, max(limit + skip, 50))
    registry = await _registry()
    items = []
    for profile in profiles:
        row = _linen_view(profile, registry)
        if search and not any(
            search.casefold() in str(row.get(field) or "").casefold()
            for field in ("linen_id", "item_type", "client_name", "description")
        ):
            continue
        if category and str(row.get("category") or "").casefold() != category.casefold():
            continue
        if status and row["status"] != status.strip().upper():
            continue
        if client_name and client_name.casefold() not in str(row.get("client_name") or "").casefold():
            continue
        if condition and str(row.get("condition") or "").upper() != condition.strip().upper():
            continue
        items.append(row)

    valid_sorts = {
        "created_at",
        "linen_id",
        "category",
        "status",
        "client_name",
        "wash_count",
        "last_scanned_date",
        "updated_at",
    }
    field = sort_by if sort_by in valid_sorts else "created_at"
    items.sort(
        key=lambda row: (row.get(field) is None, str(row.get(field) or "")),
        reverse=sort_order.strip().lower() != "asc",
    )
    total = len(items)
    return {"items": items[skip : skip + limit], "total": total}


@router.post(
    "/linens/generate-tags",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def generate_tags(
    payload: LinenTagGenerate, principal=Depends(get_current_user)
) -> dict:
    organization_id = single_organization_scope(principal, payload.organization_id)
    if not organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organization scope is required")
    registry = await _registry()
    hotel = _registry_for(registry, payload.hotel_id)
    hotel_code = hotel["hotel_code"]
    if not hotel_code or not hotel["name"]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "The selected hotel has no registry code and cannot issue tags",
        )

    runtime = get_runtime()
    created = []
    for _ in range(payload.quantity):
        saved = await runtime.identity_service.create_item(
            {
                "organization_id": organization_id,
                "owner_organization_id": organization_id,
                "owner_code": hotel_code,
                "category": payload.category,
                "item_type": payload.item_type,
                "client_name": hotel["name"],
                "size": payload.size or "",
                "material": payload.color or "",
                "start_number": payload.start_number,
            },
            principal,
        )
        profile = await runtime.linen_service.register(
            {
                "organization_id": organization_id,
                "owner_organization_id": organization_id,
                "linen_id": saved["linen_id"],
                "code": saved["qr_id"],
                "category": payload.category,
                "item_type": payload.item_type,
                "size": payload.size or "",
                "material": payload.color or "",
                "current_location": organization_id,
            },
            principal,
        )
        view = _linen_view(profile, registry)
        view["qr_id"] = saved.get("qr_id")
        view["epc"] = saved.get("epc")
        created.append(view)
    return {"items": created, "count": len(created)}


@router.post(
    "/linens/{doc_id}/scan", dependencies=[Depends(require_capability("record_scans"))]
)
async def scan_legacy_linen(
    doc_id: str, payload: LinenScanAction, principal=Depends(get_current_user)
) -> dict:
    runtime = get_runtime()
    profile = await runtime.linen_repository.get(doc_id)
    if profile is None:
        organization_id = single_organization_scope(principal, None)
        if organization_id:
            profile = await runtime.linen_repository.find_by_code(organization_id, doc_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
    organization_id = str(profile.get("organization_id") or "")
    assert_organization_access(principal, organization_id)

    result = await runtime.linen_service.record_scan(
        {
            "organization_id": organization_id,
            "scan_id": uuid.uuid4().hex,
            "code": profile.get("code") or doc_id,
            "action": payload.action,
            "location": payload.location or "",
            "to_organization_id": payload.location or "",
            "source": "linens-compat",
            "session_id": payload.related_order or "",
        },
        principal,
    )
    if result.get("result") == "invalid_transition":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Cannot move linen from {result.get('from')} to {result.get('to')}",
        )
    if result.get("result") in {"duplicate", "unknown"}:
        return result
    registry = await _registry()
    return _linen_view(result["profile"], registry)


@router.get(
    "/linens/items",
    dependencies=[Depends(organization_dependency("view_linen"))],
)
async def list_linen(
    organization_id: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await linen_api.list_linen(
        organization_id=organization_id,
        stage=stage,
        status=status,
        limit=limit,
        principal=principal,
    )
