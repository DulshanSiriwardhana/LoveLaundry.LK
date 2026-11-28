"""Client portal endpoints for hotel and shop accounts.

The hotel/shop apps authenticate as client accounts and read only their own
data. Every query is filtered by the verified ``client_scope`` pair: the
laundry and the deterministic search token for the account's client name.
Encrypted documents are decrypted at the boundary through the shared envelope
helper, so no search token or ciphertext leaves this service.

The router is mounted once at ``/client-portal`` and once under the client
dataAPI namespace (``/bills/client-portal``) used by the operational apps.
"""

from __future__ import annotations

import calendar
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..core.crypto import decrypt_document, encrypt_document, search_token
from ..core.principal import require_client_scope
from ..core.security import get_current_user
from ..operations.repository import OperationalRepository
from ..runtime import get_runtime

router = APIRouter(tags=["client-portal"])

GP_SENSITIVE = ("client_name", "items", "notes")
DELIVERY_SENSITIVE = ("client_name", "items", "notes")
BILL_SENSITIVE = ("client_name", "quotation_title", "notes", "items")
SHOP_BILL_SENSITIVE = ("client_name", "notes", "items", "tags")

OPEN_GATEPASS_STATUSES = (
    "RECEIVED",
    "PROCESSING",
    "READY_FOR_DELIVERY",
    "PARTIALLY_DELIVERED",
)
OUTSTANDING_STATUSES = ("PENDING", "ISSUED", "PARTIALLY_PAID")
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


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _month_window(reference: date | None = None) -> tuple[datetime, datetime]:
    day = reference or datetime.now(timezone.utc).date()
    last_day = calendar.monthrange(day.year, day.month)[1]
    start = datetime(day.year, day.month, 1, tzinfo=timezone.utc)
    end = datetime(day.year, day.month, last_day + 1, tzinfo=timezone.utc)
    return start, end


def _in_month(value: Any, start: datetime, end: datetime) -> bool:
    parsed = _as_datetime(value)
    return parsed is not None and start <= parsed < end


def _client_query(scope: dict, **extra) -> dict:
    return {
        "laundry_id": scope["laundry_id"],
        "client_name_search": search_token(scope["client_name"]),
        **extra,
    }


def _decrypted(document: dict, fields) -> dict:
    return decrypt_document(document, fields)


def _document_id(document: dict) -> str:
    return str(document.get("_id") or document.get("id") or "")


@router.get("/client-portal/summary")
async def client_portal_summary(
    principal=Depends(get_current_user),
) -> dict:
    """Headline numbers for one hotel, computed from stored documents only."""

    scope = require_client_scope(principal, "HOTEL")
    repository = _repository()
    query = _client_query(scope)
    open_passes = await repository.count(
        "gatepasses", {**query, "status": {"$in": list(OPEN_GATEPASS_STATUSES)}}
    )

    start, end = _month_window()
    deliverable = await repository.list(
        "deliveries",
        query,
        sort="delivery_date",
        limit=SUM_SCAN_LIMIT,
    )
    deliveries_this_month = sum(
        1
        for row in deliverable
        if str(row.get("status") or "") != "CANCELLED"
        and _in_month(row.get("delivery_date"), start, end)
    )

    bills = await repository.list("bills", query, sort="created_at", limit=SUM_SCAN_LIMIT)
    outstanding = 0.0
    invoiced_this_month = 0.0
    for raw in bills:
        row = _decrypted(raw, BILL_SENSITIVE)
        bill_status = str(row.get("payment_status") or "").upper()
        if bill_status == "CANCELLED":
            continue
        grand = _money(row.get("grand_total"))
        if bill_status in OUTSTANDING_STATUSES:
            outstanding += grand - _money(row.get("paid_amount"))
        if _in_month(row.get("created_at"), start, end):
            invoiced_this_month += grand

    return {
        "hotel": scope["client_name"],
        "laundry_id": scope["laundry_id"],
        "open_gate_passes": open_passes,
        "deliveries_this_month": deliveries_this_month,
        "outstanding_amount": _money(outstanding),
        "invoiced_this_month": _money(invoiced_this_month),
        "currency": "LKR",
        "totals_scanned": len(bills),
        "totals_truncated": len(bills) >= SUM_SCAN_LIMIT,
    }


@router.get("/client-portal/gate-passes")
async def client_portal_gate_passes(
    status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    principal=Depends(get_current_user),
) -> dict:
    scope = require_client_scope(principal, "HOTEL")
    repository = _repository()
    query = _client_query(
        scope, **({"status": status.strip().upper()} if status else {})
    )
    total = await repository.count("gatepasses", query)
    rows = await repository.list(
        "gatepasses", query, sort="receiving_date", skip=skip, limit=limit
    )
    items = []
    for raw in rows:
        row = _decrypted(raw, GP_SENSITIVE)
        items.append(
            {
                "id": _document_id(row),
                "gate_pass_number": row.get("gate_pass_number"),
                "client_name": row.get("client_name"),
                "receiving_date": _stamp(row.get("receiving_date")),
                "received_by": row.get("received_by"),
                "status": row.get("status"),
                "items": row.get("items") or [],
                "notes": row.get("notes"),
            }
        )
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/client-portal/deliveries")
async def client_portal_deliveries(
    status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    principal=Depends(get_current_user),
) -> dict:
    scope = require_client_scope(principal, "HOTEL")
    repository = _repository()
    query = _client_query(
        scope, **({"status": status.strip().upper()} if status else {})
    )
    total = await repository.count("deliveries", query)
    rows = await repository.list(
        "deliveries", query, sort="delivery_date", skip=skip, limit=limit
    )
    items = []
    for raw in rows:
        row = _decrypted(raw, DELIVERY_SENSITIVE)
        items.append(
            {
                "id": _document_id(row),
                "gate_pass_id": row.get("gate_pass_id"),
                "client_name": row.get("client_name"),
                "delivery_date": _stamp(row.get("delivery_date")),
                "delivered_by": row.get("delivered_by"),
                "received_by": row.get("received_by"),
                "status": row.get("status"),
                "items": row.get("items") or [],
                "corrections": row.get("corrections") or [],
            }
        )
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/client-portal/bills")
async def client_portal_bills(
    payment_status: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    principal=Depends(get_current_user),
) -> dict:
    scope = require_client_scope(principal, "HOTEL")
    repository = _repository()
    query = _client_query(
        scope,
        **({"payment_status": payment_status.strip().upper()} if payment_status else {}),
    )
    total = await repository.count("bills", query)
    rows = await repository.list("bills", query, sort="created_at", skip=skip, limit=limit)
    items = []
    for raw in rows:
        row = _decrypted(raw, BILL_SENSITIVE)
        grand = _money(row.get("grand_total"))
        paid = _money(row.get("paid_amount"))
        items.append(
            {
                "id": _document_id(row),
                "manual_bill_number": row.get("manual_bill_number"),
                "quotation_title": row.get("quotation_title"),
                "created_at": _stamp(row.get("created_at")),
                "total_quantity": row.get("total_quantity"),
                "grand_total": grand,
                "paid_amount": paid,
                "balance": _money(grand - paid),
                "payment_status": row.get("payment_status"),
            }
        )
    return {"total": total, "skip": skip, "limit": limit, "items": items}


@router.get("/client-portal/bills/{bill_id}")
async def client_portal_bill(bill_id: str, principal=Depends(get_current_user)) -> dict:
    scope = require_client_scope(principal, "HOTEL")
    raw = await _repository().by_id("bills", bill_id, **_client_query(scope))
    if raw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    row = _decrypted(raw, BILL_SENSITIVE)
    grand = _money(row.get("grand_total"))
    paid = _money(row.get("paid_amount"))
    return {
        "id": _document_id(row),
        "manual_bill_number": row.get("manual_bill_number"),
        "quotation_title": row.get("quotation_title"),
        "created_at": _stamp(row.get("created_at")),
        "items": row.get("items") or [],
        "total_quantity": row.get("total_quantity"),
        "total_amount": _money(row.get("total_amount")),
        "discounts": _money(row.get("discounts")),
        "transport_fee": _money(row.get("transport_fee")),
        "taxes": _money(row.get("taxes")),
        "additional_charges": _money(row.get("additional_charges")),
        "grand_total": grand,
        "paid_amount": paid,
        "balance": _money(grand - paid),
        "payment_status": row.get("payment_status"),
        "notes": row.get("notes"),
    }


@router.get("/client-portal/shop/summary")
async def client_portal_shop_summary(principal=Depends(get_current_user)) -> dict:
    scope = require_client_scope(principal, "SHOP")
    rows = await _repository().list(
        "shop_bills", _client_query(scope), sort="created_at", limit=SUM_SCAN_LIMIT
    )
    start, end = _month_window()
    open_bills = 0
    outstanding = 0.0
    invoiced_this_month = 0.0
    for raw in rows:
        row = _decrypted(raw, SHOP_BILL_SENSITIVE)
        payment_status = str(row.get("payment_status") or "").upper()
        if payment_status not in {"PAID", "CANCELLED", "DRAFT"}:
            open_bills += 1
        if payment_status in OUTSTANDING_STATUSES:
            outstanding += _money(row.get("outstanding_amount"))
        if payment_status != "CANCELLED" and _in_month(row.get("created_at"), start, end):
            invoiced_this_month += _money(row.get("grand_total"))
    return {
        "shop": scope["client_name"],
        "laundry_id": scope["laundry_id"],
        "open_bills": open_bills,
        "outstanding_amount": _money(outstanding),
        "invoiced_this_month": _money(invoiced_this_month),
        "currency": "LKR",
        "scanned": len(rows),
    }


@router.get("/client-portal/shop/bills")
async def client_portal_shop_bills(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
    principal=Depends(get_current_user),
) -> dict:
    scope = require_client_scope(principal, "SHOP")
    repository = _repository()
    query = _client_query(
        scope, **({"payment_status": status.strip().upper()} if status else {})
    )
    total = await repository.count("shop_bills", query)
    rows = await repository.list(
        "shop_bills", query, sort="created_at", skip=offset, limit=limit
    )
    items = []
    for raw in rows:
        row = _decrypted(raw, SHOP_BILL_SENSITIVE)
        items.append(
            {
                "id": _document_id(row),
                "bill_number": row.get("bill_number"),
                "client_name": scope["client_name"],
                "created_at": _stamp(row.get("created_at")),
                "delivery_date": _stamp(row.get("delivery_date")),
                "grand_total": _money(row.get("grand_total")),
                "paid_amount": _money(row.get("paid_amount")),
                "balance": _money(row.get("outstanding_amount")),
                "payment_status": row.get("payment_status"),
                "status": row.get("status"),
                "total_quantity": row.get("total_quantity"),
            }
        )
    return {"total": total, "count": len(items), "items": items}


@router.get("/client-portal/shop/bills/{bill_id}")
async def client_portal_shop_bill(bill_id: str, principal=Depends(get_current_user)) -> dict:
    scope = require_client_scope(principal, "SHOP")
    raw = await _repository().by_id("shop_bills", bill_id, **_client_query(scope))
    if raw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bill not found")
    row = _decrypted(raw, SHOP_BILL_SENSITIVE)
    payments = await _repository().list(
        "payments",
        {"laundry_id": scope["laundry_id"], "shop_bill_id": _document_id(row)},
        limit=200,
    )
    return {
        "id": _document_id(row),
        "bill_number": row.get("bill_number"),
        "client_name": scope["client_name"],
        "created_at": _stamp(row.get("created_at")),
        "delivery_date": _stamp(row.get("delivery_date")),
        "items": row.get("items") or [],
        "total_quantity": row.get("total_quantity"),
        "grand_total": _money(row.get("grand_total")),
        "paid_amount": _money(row.get("paid_amount")),
        "balance": _money(row.get("outstanding_amount")),
        "payment_status": row.get("payment_status"),
        "status": row.get("status"),
        "notes": row.get("notes"),
        "payments": [
            {
                "id": _document_id(payment),
                "payment_id": payment.get("payment_id"),
                "amount": _money(payment.get("amount")),
                "paid_at": _stamp(payment.get("paid_at") or payment.get("created_at")),
            }
            for payment in payments
        ],
    }


class ShopOrderLine(BaseModel):
    item_name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0)
    unit: str | None = Field(default=None, max_length=24)
    specification: str | None = Field(default=None, max_length=120)


class ShopOrderCreate(BaseModel):
    items: list[ShopOrderLine] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=500)
    requested_by: str | None = Field(default=None, max_length=80)


def _order_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%y%m%d")
    return f"REQ-{stamp}-{uuid.uuid4().hex[:5].upper()}"


def _order_view(raw: dict) -> dict:
    row = _decrypted(raw, GP_SENSITIVE)
    items = row.get("items") or []
    pieces = 0.0
    for item in items:
        if isinstance(item, dict):
            pieces += _money(item.get("client_qty"))
    return {
        "id": _document_id(row),
        "gate_pass_number": row.get("gate_pass_number"),
        "status": row.get("status"),
        "receiving_date": _stamp(row.get("receiving_date")),
        "notes": row.get("notes"),
        "pieces": _money(pieces),
        "line_count": len(items),
        "items": [
            {
                "item_name": item.get("item_name"),
                "quantity": item.get("client_qty"),
                "received_qty": item.get("received_qty"),
                "unit": item.get("unit"),
            }
            for item in items
            if isinstance(item, dict)
        ],
    }


@router.post("/client-portal/shop/orders", status_code=status.HTTP_201_CREATED)
async def create_shop_order(
    payload: ShopOrderCreate, principal=Depends(get_current_user)
) -> dict:
    scope = require_client_scope(principal, "SHOP")
    now = datetime.now(timezone.utc)
    document = {
        "laundry_id": scope["laundry_id"],
        "gate_pass_number": _order_number(),
        "client_name": scope["client_name"],
        "receiving_date": now,
        "received_by": (payload.requested_by or principal.get("user_name") or "Shop")[:80],
        "items": [
            {
                "item_name": line.item_name.strip(),
                "specification": line.specification or None,
                "unit": line.unit or None,
                "client_qty": float(line.quantity),
                "received_qty": 0,
            }
            for line in payload.items
        ],
        "notes": payload.notes or None,
        "status": "DRAFT",
        "origin": {"kind": "shop_order"},
        "created_at": now,
        "updated_at": now,
    }
    saved = await _repository().insert("gatepasses", encrypt_document(document, GP_SENSITIVE))
    return _order_view(saved)


@router.get("/client-portal/shop/orders")
async def list_shop_orders(
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
    principal=Depends(get_current_user),
) -> dict:
    scope = require_client_scope(principal, "SHOP")
    repository = _repository()
    query = _client_query(scope)
    total = await repository.count("gatepasses", query)
    rows = await repository.list(
        "gatepasses", query, sort="receiving_date", skip=skip, limit=limit
    )
    return {"total": total, "items": [_order_view(row) for row in rows]}


@router.get("/client-portal/shop/orders/{order_id}")
async def get_shop_order(order_id: str, principal=Depends(get_current_user)) -> dict:
    scope = require_client_scope(principal, "SHOP")
    row = await _repository().by_id("gatepasses", order_id, **_client_query(scope))
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return _order_view(row)
