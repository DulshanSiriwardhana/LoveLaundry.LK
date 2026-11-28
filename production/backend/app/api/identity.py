"""Tag management, QR resolution and tag-health endpoints."""

from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..runtime import get_runtime

router = APIRouter(tags=["tag-management"])


class _RateLimiter:
    def __init__(self) -> None:
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = asyncio.Lock()

    async def check(self, key: str, limit: int) -> None:
        now = datetime.now(timezone.utc)
        async with self.lock:
            window = self.hits[key]
            while window and window[0] < now - timedelta(minutes=1):
                window.popleft()
            if len(window) >= limit:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS, "QR resolution rate limit exceeded"
                )
            window.append(now)


_public_qr_limiter = _RateLimiter()


class CreateLinenItemRequest(BaseModel):
    organization_id: str = ""
    item_type: str = ""
    category: str = ""
    size: str = ""
    material: str = ""
    qr_id: str = ""
    epc: str = ""
    tag_serial: str = ""
    tid: str = ""
    owner_organization_id: str = ""
    # Optional for older callers/tests. The platform UI derives this from the
    # selected hotel record on the backend and never offers a free-text code.
    owner_code: str = ""
    start_number: int | None = Field(default=None, ge=1, le=259974)
    batch_id: str = ""
    manufacturer_id: str = ""
    model_id: str = ""
    external_reference: str = ""


class BulkCreateRequest(BaseModel):
    items: list[CreateLinenItemRequest] = Field(min_length=1, max_length=5000)


class MappingImportRequest(BaseModel):
    batch_id: str
    rows: list[dict] = Field(min_length=1, max_length=5000)
    expected_quantity: int | None = None


class ReplaceTagRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    new_epc: str = ""
    new_qr: str = ""
    new_tag_serial: str = ""
    new_tid: str = ""


class DeactivateTagRequest(BaseModel):
    reason: str = Field(default="", max_length=500)


class NamedRecordRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    manufacturer_id: str = ""
    supplier_id: str = ""
    country_of_origin: str = ""
    technology: str = ""
    rated_cycles: int = 0
    documentation_reference: str = ""
    durability_documented: bool = False


class TagBatchRequest(BaseModel):
    batch_id: str = Field(min_length=1, max_length=200)
    organization_id: str = ""
    manufacturer_id: str = ""
    model_id: str = ""
    supplier_id: str = ""
    expected_quantity: int = Field(gt=0)
    received_quantity: int = 0
    rejected_quantity: int = 0
    technology: str = "QR+UHF RFID"
    durability_rating_cycles: int = 0
    country_of_origin: str = ""
    supplier: str = ""
    purchase_order: str = ""
    quotation_reference: str = ""
    unit_price: float = 0
    import_cost: float = 0
    customs_cost: float = 0
    shipping_cost: float = 0
    warranty_reference: str = ""
    quality_inspection: dict = Field(default_factory=dict)
    sample_testing: dict = Field(default_factory=dict)
    status: str = "RECEIVED"


class InspectionRequest(BaseModel):
    inspection_id: str = ""
    result: str = "PASSED"
    qr_readable: bool = True
    rfid_readable: bool = True
    wash_cycles_observed: int = 0
    notes: str = ""


class FailureReportRequest(BaseModel):
    failure_id: str = ""
    failure_type: str = Field(min_length=1, max_length=100)
    description: str = ""


@router.post(
    "/tags/items",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def create_linen_item(payload: CreateLinenItemRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.create_item(payload.model_dump(), principal)


@router.post(
    "/tags/items/bulk",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def bulk_create_linen_items(payload: BulkCreateRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.bulk_create(
        [row.model_dump() for row in payload.items], principal
    )


@router.get(
    "/tags/items",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_linen_items(
    organization_id: str | None = Query(default=None),
    batch_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await get_runtime().identity_service.list_items(
        principal, organization_id, batch_id, status_filter, limit
    )


@router.get(
    "/tags/items/{linen_id}",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def get_linen_item(linen_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.get_item(linen_id, principal)


@router.post(
    "/tags/imports/validate",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def validate_mapping_import(payload: MappingImportRequest, principal=Depends(get_current_user)) -> dict:
    report = await get_runtime().identity_service.validate_mapping_import(
        payload.rows, payload.batch_id, payload.expected_quantity
    )
    return {key: value for key, value in report.items() if key != "rows"}


@router.post(
    "/tags/imports",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def save_mapping_import(payload: MappingImportRequest, principal=Depends(get_current_user)) -> dict:
    document = await get_runtime().identity_service.save_import(
        payload.batch_id, payload.rows, payload.expected_quantity, principal
    )
    return {key: value for key, value in document.items() if key != "rows"}


@router.get(
    "/tags/imports/{import_id}",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def get_mapping_import(import_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.get_import(import_id, principal)


@router.post(
    "/tags/imports/{import_id}/activate",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def activate_mapping_import(import_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.activate_import(import_id, principal)


@router.post(
    "/tags/{linen_id}/replace",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def replace_tag(linen_id: str, payload: ReplaceTagRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.replace_tag(
        linen_id, payload.model_dump(), principal
    )


@router.post(
    "/tags/{linen_id}/deactivate",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def deactivate_tag(linen_id: str, payload: DeactivateTagRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.deactivate_tag(
        linen_id, payload.model_dump(), principal
    )


@router.get(
    "/tags/{linen_id}/history",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def tag_history(linen_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.tag_history(linen_id, principal)


@router.get(
    "/tags/{linen_id}/sheet",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def tag_sheet(linen_id: str, principal=Depends(get_current_user)) -> Response:
    svg = await get_runtime().identity_service.generate_tag_sheet([linen_id], principal)
    return Response(content=svg, media_type="image/svg+xml")


@router.get(
    "/tags/health/alerts",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def tag_health_alerts(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().tag_health.alerts(principal)


@router.get(
    "/tags/{linen_id}/health",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def tag_health_history(linen_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().tag_health.history(linen_id, principal)


@router.post(
    "/tags/{linen_id}/inspections",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def record_tag_inspection(linen_id: str, payload: InspectionRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().tag_health.record_inspection(
        linen_id, payload.model_dump(), principal
    )


@router.post(
    "/tags/{linen_id}/failures",
    dependencies=[Depends(require_capability("manage_tags"))],
)
async def report_tag_failure(linen_id: str, payload: FailureReportRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().tag_health.report_failure(
        linen_id, payload.model_dump(), principal
    )


@router.get(
    "/tags/manufacturers",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_manufacturers(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().identity_service.list_manufacturers(principal)


@router.post(
    "/tags/manufacturers",
    dependencies=[Depends(require_capability("manage_tag_batches"))],
)
async def save_manufacturer(payload: NamedRecordRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.save_manufacturer(
        payload.model_dump(), principal
    )


@router.get(
    "/tags/suppliers",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_suppliers(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().identity_service.list_suppliers(principal)


@router.post(
    "/tags/suppliers",
    dependencies=[Depends(require_capability("manage_tag_batches"))],
)
async def save_supplier(payload: NamedRecordRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.save_supplier(
        payload.model_dump(), principal
    )


@router.get(
    "/tags/models",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_models(
    manufacturer_id: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await get_runtime().identity_service.list_models(manufacturer_id, principal)


@router.post(
    "/tags/models",
    dependencies=[Depends(require_capability("manage_tag_batches"))],
)
async def save_model(payload: NamedRecordRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.save_model(payload.model_dump(), principal)


@router.get(
    "/tags/batches",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_batches(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().identity_service.list_batches(principal)


@router.post(
    "/tags/batches",
    dependencies=[Depends(require_capability("manage_tag_batches"))],
)
async def save_batch(payload: TagBatchRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.save_batch(payload.model_dump(), principal)


@router.post(
    "/tags/batches/{batch_id}/verify",
    dependencies=[Depends(require_capability("manage_tag_batches"))],
)
async def verify_batch(batch_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().identity_service.verify_batch(batch_id, principal)


@router.get("/i/{linen_id}")
async def resolve_public_qr(linen_id: str, request: Request) -> dict:
    """Resolve a QR payload without exposing ownership, pricing or history."""

    settings = get_runtime().settings
    host = request.client.host if request.client else "unknown"
    await _public_qr_limiter.check(f"qr:{host}", settings.qr_rate_limit_per_minute)
    return await get_runtime().identity_service.resolve_qr(linen_id, {"platform_admin": True})
