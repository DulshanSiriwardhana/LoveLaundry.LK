"""Compatibility endpoints for the shop app's bills and day-close screens.

The shop frontend was built against the bill-service URL surface. These handlers
reuse the rebuilt backend's shared operational repository and outbox; they add
only the missing URLs and response shapes, not a second source of truth.
"""

from __future__ import annotations

import random
import string
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..core.crypto import decrypt_document, encrypt_document, search_token
from ..core.principal import is_platform_admin
from ..core.security import get_current_user
from ..events.models import new_event
from ..operations.repository import OperationalRepository
from ..permissions.service import require_capability
from ..runtime import get_runtime

router = APIRouter(tags=["shop-bills-compat"])

SHOP_BILL_SENSITIVE = ("client_name", "notes", "items", "tags")
TEMPLATE_SENSITIVE = ("client_name", "notes", "items")
BILL_NUMBER_PREFIX = "SB-"
DAY_CLOSE_EVENT = "DAY_CLOSED"
LKT = timezone(timedelta(hours=5, minutes=30))
SUM_SCAN_LIMIT = 5000


def _repository() -> OperationalRepository:
    return get_runtime().operational


def _money(value: Any) -> float:
    try:
        return round(float(value or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def _stamp(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _document_id(document: dict) -> str:
    return str(document.get("_id") or document.get("id") or "")


def _staff_query(principal: dict, **extra) -> dict:
    if is_platform_admin(principal):
        return dict(extra)
    identifiers = sorted(set(principal.get("laundry_ids") or []))
    laundry_id = str(principal.get("laundry_id") or principal.get("organization_id") or "")
    if laundry_id:
        identifiers.append(laundry_id)
    if not identifiers:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Organization scope is required")
    return {"laundry_id": {"$in": identifiers}, **extra}


def _bill_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%y%m%d")
    suffix = "".join(random.SystemRandom().choices(string.ascii_uppercase + "23456789", k=5))
    return f"{BILL_NUMBER_PREFIX}{stamp}-{suffix}"


def _line_total(item: dict) -> dict:
    quantity = _money(item.get("quantity"))
    unit_price = _money(
        item.get("unit_price", item.get("rate", item.get("price", 0)))
    )
    discount = _money(item.get("discount"))
    discount_type = str(item.get("discount_type") or "FIXED").upper()
    raw = round(quantity * unit_price, 2)
    reduction = (
        round(raw * discount / 100, 2) if discount_type == "PERCENT" else min(discount, raw)
    )
    return {
        "item_name": str(item.get("item_name") or item.get("name") or item.get("description") or "").strip(),
        "quantity": quantity,
        "unit_price": unit_price,
        "discount": discount,
        "discount_type": discount_type,
        "line_total": _money(raw - reduction),
    }


def _totals(items: list[dict], discounts: float, transport: float, taxes: float) -> dict:
    prepared = [_line_total(item) for item in items]
    total_quantity = round(sum(float(row["quantity"]) for row in prepared), 2)
    total_amount = _money(sum(float(row["line_total"]) for row in prepared))
    grand_total = _money(total_amount - discounts + transport + taxes)
    return {
        "items": prepared,
        "total_quantity": total_quantity,
        "total_amount": total_amount,
        "grand_total": grand_total,
    }


@router.get(
    "/shop-bills/stats/overview",
    dependencies=[Depends(require_capability("view_bills"))],
)
async def shop_bill_stats_overview(principal=Depends(get_current_user)) -> dict:
    rows = await _repository().list(
        "shop_bills", _staff_query(principal), limit=SUM_SCAN_LIMIT
    )
    total_revenue = 0.0
    total_paid = 0.0
    total_outstanding = 0.0
    status_counts: dict[str, int] = {}
    for raw in rows:
        row = decrypt_document(raw, SHOP_BILL_SENSITIVE)
        total_revenue += _money(row.get("grand_total"))
        total_paid += _money(row.get("paid_amount"))
        total_outstanding += _money(row.get("outstanding_amount"))
        status = str(row.get("status") or "unknown")
        status_counts[status] = status_counts.get(status, 0) + 1
    return {
        "total_bills": len(rows),
        "total_revenue": _money(total_revenue),
        "total_paid": _money(total_paid),
        "total_outstanding": _money(total_outstanding),
        "status_counts": status_counts,
    }


class QuickBillItem(BaseModel):
    item_name: str | None = None
    name: str | None = None
    description: str | None = None
    quantity: float = Field(gt=0)
    unit_price: float | None = None
    rate: float | None = None
    price: float | None = None
    discount: float | None = None
    discount_type: str | None = None


class QuickBillRequest(BaseModel):
    client_name: str = Field(min_length=1, max_length=200)
    items: list[QuickBillItem] = Field(default_factory=list)
    template_id: str | None = None
    discounts: float | None = None
    transport_fee: float | None = None
    taxes: float | None = None
    paid_amount: float | None = None
    notes: str | None = None
    delivery_date: str | None = None
    status: str | None = None
    organization_id: str | None = None


@router.post(
    "/shop-bills/quick-bill",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_capability("edit_bills"))],
)
async def shop_bill_quick_bill(
    payload: QuickBillRequest, principal=Depends(get_current_user)
) -> dict:
    repository = _repository()
    raw_items = [item.model_dump(exclude_none=True) for item in payload.items]
    if not raw_items and payload.template_id:
        template = await repository.by_id(
            "bill_templates", payload.template_id, **_staff_query(principal)
        )
        if template is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bill template not found")
        clean = decrypt_document(template, TEMPLATE_SENSITIVE)
        raw_items = list(clean.get("items") or [])
        await repository.update(
            "bill_templates",
            {"_id": template["_id"]},
            {"$inc": {"use_count": 1}},
        )
    if not raw_items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one item is required")

    totals = _totals(
        raw_items,
        _money(payload.discounts),
        _money(payload.transport_fee),
        _money(payload.taxes),
    )
    now = datetime.now(timezone.utc)
    grand_total = totals["grand_total"]
    paid = max(0.0, min(_money(payload.paid_amount), grand_total))
    laundry_id = _scope_laundry_id(
        _staff_query(principal), principal, payload.organization_id
    )
    document = {
        "laundry_id": laundry_id,
        "bill_number": _bill_number(),
        "client_name": payload.client_name.strip(),
        "quotation_id": None,
        "items": totals["items"],
        "total_quantity": totals["total_quantity"],
        "total_amount": totals["total_amount"],
        "discounts": _money(payload.discounts),
        "transport_fee": _money(payload.transport_fee),
        "taxes": _money(payload.taxes),
        "grand_total": grand_total,
        "status": payload.status or "PENDING",
        "payment_status": "DRAFT",
        "paid_amount": paid,
        "outstanding_amount": _money(grand_total - paid),
        "notes": payload.notes or None,
        "notes_history": [],
        "delivery_date": payload.delivery_date,
        "tags": [],
        "locked": False,
        "created_at": now,
        "updated_at": now,
    }
    saved = await repository.insert(
        "shop_bills", encrypt_document(document, SHOP_BILL_SENSITIVE)
    )
    clean = decrypt_document(saved, SHOP_BILL_SENSITIVE)
    clean["id"] = _document_id(clean)
    return clean


@router.get(
    "/shop-bills",
    dependencies=[Depends(require_capability("view_bills"))],
)
async def list_shop_bills(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=500),
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status: str | None = Query(default=None),
    client_name: str | None = Query(default=None),
    search: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    query = _staff_query(
        principal,
        **(
            {"status": status_filter.strip().upper()}
            if status_filter
            else {}
        ),
        **(
            {"payment_status": payment_status.strip().upper()}
            if payment_status
            else {}
        ),
        **({"client_name_search": search_token(client_name)} if client_name else {}),
    )
    repository = _repository()
    total = await repository.count("shop_bills", query)
    rows = await repository.list(
        "shop_bills", query, sort="created_at", skip=skip, limit=limit
    )
    items = []
    for raw in rows:
        row = decrypt_document(raw, SHOP_BILL_SENSITIVE)
        clean = {
            key: value
            for key, value in row.items()
            if key not in {"_id", "encryption_metadata"}
        }
        clean["id"] = _document_id(row)
        if search and not any(
            search.casefold() in str(clean.get(field) or "").casefold()
            for field in ("bill_number", "client_name", "notes")
        ):
            continue
        items.append(clean)
    return {"items": items, "total": total}


class DayCloseRequest(BaseModel):
    date: str
    totals: dict[str, Any]
    note: str | None = None
    organization_id: str | None = None


def _scope_laundry_id(scope: dict, principal: dict, requested: str | None = None) -> str:
    value = scope.get("laundry_id")
    if isinstance(value, str) and value:
        return value
    candidates = value.get("$in") if isinstance(value, dict) else None
    candidates = [str(item) for item in candidates or []]
    if requested:
        if not candidates or requested in candidates or is_platform_admin(principal):
            return requested
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Resource belongs to another organization")
    if candidates:
        return candidates[0]
    return str(principal.get("organization_id") or "")


def _parse_business_day(value: str) -> date:
    try:
        parsed = date.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise HTTPException(422, "date must be YYYY-MM-DD") from exc
    if parsed.isoformat() != str(value):
        raise HTTPException(422, "date must be YYYY-MM-DD")
    return parsed


def _day_end(day: date) -> datetime:
    return datetime.combine(day, time(23, 59, 59), tzinfo=LKT).astimezone(timezone.utc)


@router.get(
    "/day-close",
    dependencies=[Depends(require_capability("view_operations"))],
)
async def get_day_close(
    date: str = Query(..., description="Business day YYYY-MM-DD"),
    principal=Depends(get_current_user),
) -> dict | None:
    day = _parse_business_day(date)
    query = {
        **_staff_query(principal),
        "entity_type": "day",
        "entity_id": day.isoformat(),
        "event_type": DAY_CLOSE_EVENT,
    }
    row = await _repository().find_one(
        "linen_events", query, sort=[("occurred_at", -1)]
    )
    if row is None:
        return None
    return {key: value for key, value in row.items() if key != "_id"} | {
        "id": _document_id(row)
    }


@router.post(
    "/day-close",
    dependencies=[Depends(require_capability("edit_linen"))],
)
async def close_day(
    payload: DayCloseRequest = Body(...), principal=Depends(get_current_user)
) -> dict:
    day = _parse_business_day(payload.date)
    end = _day_end(day)
    today_lkt = datetime.now(LKT).date()
    if day > today_lkt:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Cannot close a future day ({day.isoformat()})."
        )

    scope = _staff_query(principal)
    repository = _repository()
    later = await repository.find_one(
        "linen_events",
        {
            **scope,
            "entity_type": "day",
            "event_type": DAY_CLOSE_EVENT,
            "occurred_at": {"$gt": end.isoformat()},
        },
        sort=[("occurred_at", 1)],
    )
    if later is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A later day ({later.get('entity_id')}) is already closed.",
        )

    now = datetime.now(timezone.utc).isoformat()
    event = new_event(
        "day.closed",
        _scope_laundry_id(scope, principal, payload.organization_id),
        "day-close",
        day.isoformat(),
        {"totals": payload.totals, "closed_at": now},
        correlation_id=uuid.uuid4().hex,
        occurred_at=end.isoformat(),
    )
    document = {
        **event,
        **scope,
        "entity_type": "day",
        "entity_id": day.isoformat(),
        "event_type": DAY_CLOSE_EVENT,
        "user_id": str(principal.get("actor_id") or ""),
        "user_name": str(principal.get("user_name") or ""),
        "reason": payload.note or None,
        "meta": {"totals": payload.totals, "closed_at": now},
    }
    saved = await repository.insert("linen_events", document)
    await get_runtime().outbox.publish(event)
    return {key: value for key, value in saved.items() if key != "_id"} | {
        "id": _document_id(saved)
    }
