"""Generic CRUD engine for laundry-management entity resources.

Each ``ResourceSpec`` turns into the legacy ``{items,total,limit,offset}`` list
envelope, a ``{success: true}`` delete, and doc-shaped get/create/update — the
shapes the legacy routers used across the board. Sensitive fields are encrypted
by the repository on write and decrypted on read.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from ...core.capabilities import require_capability
from .deps import get_laundry_repo
from .repository import LaundryRepository


@dataclass
class ResourceSpec:
    base: str
    collection: str
    sensitive: list[str] = field(default_factory=list)
    read_cap: str = "management:read"
    write_cap: str = "management:write"
    # query-param name -> stored field name
    filters: dict[str, str] = field(default_factory=dict)
    date_field: str | None = None
    sort_field: str = "created_at"
    sort_desc: bool = True
    bare_list: bool = False


# Resources with a static sub-path are registered BEFORE their parent so
# ``/expenses/categories`` is never swallowed by ``/expenses/{id}``.
RESOURCES: list[ResourceSpec] = [
    # ── customers ──
    ResourceSpec(
        base="customers",
        collection="customers",
        sensitive=["name", "contact_person", "phone", "email", "address", "notes"],
        read_cap="customer:read",
        write_cap="customer:write",
        filters={"customer_type": "customer_type", "is_active": "is_active"},
    ),
    ResourceSpec(
        base="items/categories",
        collection="item_categories",
        sensitive=["name"],
        read_cap="item:read",
        write_cap="item:write",
        bare_list=True,
    ),
    ResourceSpec(
        base="items",
        collection="items",
        sensitive=["name"],
        read_cap="item:read",
        write_cap="item:write",
        filters={"category_id": "category_id", "is_active": "is_active"},
    ),
    # ── expenses ──
    ResourceSpec(
        base="expenses/categories",
        collection="expense_categories",
        sensitive=["name"],
        read_cap="expense:read",
        write_cap="expense:write",
        bare_list=True,
    ),
    ResourceSpec(
        base="expenses/templates",
        collection="expense_templates",
        sensitive=["name"],
        read_cap="expense:read",
        write_cap="expense:write",
        bare_list=True,
    ),
    ResourceSpec(
        base="expenses",
        collection="expenses",
        sensitive=["description", "reference", "notes"],
        read_cap="expense:read",
        write_cap="expense:write",
        filters={"category_id": "category_id"},
        date_field="date",
    ),
    # ── extra work ──
    ResourceSpec(
        base="extra-work/categories",
        collection="extra_work_categories",
        sensitive=[],
        read_cap="salary:read",
        write_cap="salary:write",
        bare_list=True,
    ),
    ResourceSpec(
        base="extra-work/records",
        collection="extra_work_records",
        sensitive=[],
        read_cap="salary:read",
        write_cap="salary:write",
        filters={"employee_id": "employee_id"},
        date_field="date",
    ),
    # ── employees ──
    ResourceSpec(
        base="employees",
        collection="employees",
        sensitive=["name", "phone", "nic", "notes"],
        read_cap="employee:read",
        write_cap="employee:write",
        filters={"is_active": "is_active"},
    ),
    # ── transactions ──
    ResourceSpec(
        base="transactions",
        collection="transactions",
        sensitive=["customer_name", "invoice_number", "items", "notes"],
        read_cap="transaction:read",
        write_cap="transaction:write",
        filters={"customer_id": "customer_id"},
        date_field="transaction_date",
    ),
    # ── payments ──
    ResourceSpec(
        base="payments",
        collection="payments",
        sensitive=["customer_name", "reference", "notes"],
        read_cap="payment:read",
        write_cap="payment:write",
        filters={"customer_id": "customer_id"},
        date_field="payment_date",
    ),
    # ── advances ──
    ResourceSpec(
        base="advances",
        collection="salary_advances",
        sensitive=[],
        read_cap="salary:read",
        write_cap="salary:write",
        filters={"employee_id": "employee_id", "status": "status"},
    ),
    # ── holidays ──
    ResourceSpec(
        base="holidays",
        collection="holidays",
        sensitive=[],
        read_cap="management:read",
        write_cap="management:write",
        date_field="date",
    ),
    # ── attendance ──
    ResourceSpec(
        base="attendance",
        collection="attendance",
        sensitive=[],
        read_cap="employee:read",
        write_cap="employee:write",
        filters={"employee_id": "employee_id"},
        date_field="date",
    ),
    # ── salary ──
    ResourceSpec(
        base="salary/packages",
        collection="salary_packages",
        sensitive=[],
        read_cap="salary:read",
        write_cap="salary:write",
    ),
    ResourceSpec(
        base="salary/slips",
        collection="salary_slips",
        sensitive=["notes"],
        read_cap="salary:read",
        write_cap="salary:write",
        filters={"employee_id": "employee_id", "status": "status"},
        date_field="period_start",
    ),
    # ── saved reports ──
    ResourceSpec(
        base="reports/saved",
        collection="saved_reports",
        sensitive=[],
        read_cap="report:read",
        write_cap="report:write",
    ),
]


def register_resource(router: APIRouter, spec: ResourceSpec) -> None:
    label = spec.base.split("/")[-1]

    @router.get(f"/{spec.base}", name=f"list_{label}", dependencies=[Depends(require_capability(spec.read_cap))])
    async def list_items(  # noqa: ANN202
        request: Request,
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        params = request.query_params
        limit = max(1, min(int(params.get("limit", 100) or 100), 500))
        offset = max(0, int(params.get("offset", 0) or 0))
        query: dict = {}
        for qk, field in spec.filters.items():
            val = params.get(qk)
            if val not in (None, ""):
                query[field] = _coerce(val)
        if spec.date_field:
            start, end = params.get("start_date"), params.get("end_date")
            if start or end:
                rng: dict = {}
                if start:
                    rng["$gte"] = start
                if end:
                    rng["$lte"] = end
                query[spec.date_field] = rng
        sort = [(spec.sort_field, -1 if spec.sort_desc else 1)]
        items, total = await repo.list(spec.collection, spec.sensitive, query, sort, offset, limit)
        if spec.bare_list:
            return items
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    @router.post(f"/{spec.base}", status_code=201, name=f"create_{label}", dependencies=[Depends(require_capability(spec.write_cap))])
    async def create_item(  # noqa: ANN202
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        return await repo.create(spec.collection, spec.sensitive, payload)

    @router.get(f"/{spec.base}/{{item_id}}", name=f"get_{label}", dependencies=[Depends(require_capability(spec.read_cap))])
    async def get_item(  # noqa: ANN202
        item_id: str,
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        doc = await repo.get(spec.collection, spec.sensitive, item_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"{label[:-1].capitalize() if label.endswith('s') else label} not found")
        return doc

    @router.put(f"/{spec.base}/{{item_id}}", name=f"update_{label}", dependencies=[Depends(require_capability(spec.write_cap))])
    async def update_item(  # noqa: ANN202
        item_id: str,
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        updated = await repo.update(spec.collection, spec.sensitive, item_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail=f"{label[:-1].capitalize() if label.endswith('s') else label} not found")
        return updated

    @router.delete(f"/{spec.base}/{{item_id}}", name=f"delete_{label}", dependencies=[Depends(require_capability(spec.write_cap))])
    async def delete_item(  # noqa: ANN202
        item_id: str,
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        if not await repo.delete(spec.collection, item_id):
            raise HTTPException(status_code=404, detail=f"{label[:-1].capitalize() if label.endswith('s') else label} not found")
        return {"success": True}


def _coerce(val: str):
    low = val.lower()
    if low in ("true", "false"):
        return low == "true"
    return val
