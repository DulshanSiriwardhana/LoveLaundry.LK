"""Quotation routes — recreates the legacy quotation-service API surface.

Includes the public guest/tracking/tag endpoints and preserves the same
lifecycle transition rules and history recording.
"""
from __future__ import annotations

import os
from typing import Union

from fastapi import APIRouter, Depends, HTTPException

from ...core.clock import utc_iso_z
from ...core.security import get_current_user, require_role
from .deps import get_quotation_repo
from .repository import QuotationRepository
from .schemas import (
    ORDER_STATUSES,
    ORDER_STATUS_TRANSITIONS,
    QuotationAdvanceStatus,
    QuotationCreate,
    QuotationResponse,
    QuotationUpdate,
    TagCreate,
    TagOut,
    TagsResponse,
)

router = APIRouter(tags=["quotations"])

_READ = ["ADMIN", "MANAGER", "STAFF"]
_WRITE = ["ADMIN", "MANAGER"]

#: Public storefront used to build scannable tag/tracking URLs.
PUBLIC_BASE = os.getenv("PUBLIC_BASE", "https://public.lovelaundry.lk").rstrip("/")


def _norm_qid(quotation_id: Union[int, str]) -> str:
    return str(quotation_id)


def _tracking_url(code: str) -> str:
    return f"{PUBLIC_BASE}/track?tag={code}"


def _username(user: dict) -> str | None:
    return user.get("username") or user.get("user_name") or user.get("sub")


@router.get(
    "/quotations",
    response_model=list[QuotationResponse],
    dependencies=[Depends(require_role(_READ))],
)
async def get_all_quotations(
    tag: str | None = None,
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    if tag:
        return await repo.get_by_tag(tag)
    return await repo.get_all()


@router.get(
    "/quotations/guest/shop",
    response_model=list[QuotationResponse],
)
async def get_shop_quotations_guest(
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    return await repo.get_by_tag("shop")


@router.get(
    "/quotations/{quotation_id}",
    response_model=QuotationResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def get_quotation(
    quotation_id: Union[int, str],
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    quotation = await repo.get_by_id(_norm_qid(quotation_id))
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quotation


@router.post(
    "/quotations",
    response_model=QuotationResponse,
    status_code=201,
    dependencies=[Depends(require_role(_WRITE))],
)
async def create_quotation(
    payload: QuotationCreate,
    repo: QuotationRepository = Depends(get_quotation_repo),
    current_user: dict = Depends(get_current_user),
):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of {ORDER_STATUSES}")

    quotation_data = {
        "client_name": payload.client_name,
        "quotation_title": payload.quotation_title,
        "line_items": [item.model_dump() for item in payload.line_items],
        "status": payload.status,
        "status_history": [
            {
                "status": payload.status,
                "changed_at": utc_iso_z(),
                "changed_by": _username(current_user),
                "note": "Created",
            }
        ],
        "tag": payload.tag,
    }
    return await repo.create(quotation_data)


@router.put(
    "/quotations/{quotation_id}",
    response_model=QuotationResponse,
    dependencies=[Depends(require_role(_WRITE))],
)
async def update_quotation(
    quotation_id: Union[int, str],
    payload: QuotationUpdate,
    repo: QuotationRepository = Depends(get_quotation_repo),
    current_user: dict = Depends(get_current_user),
):
    qid = _norm_qid(quotation_id)
    current = await repo.get_by_id(qid)
    if not current:
        raise HTTPException(status_code=404, detail="Quotation not found")

    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("line_items"):
        update_data["line_items"] = [
            item.model_dump() if hasattr(item, "model_dump") else item
            for item in update_data["line_items"]
        ]

    if update_data.get("status") is not None:
        if update_data["status"] not in ORDER_STATUSES:
            raise HTTPException(status_code=422, detail=f"Status must be one of {ORDER_STATUSES}")
        if update_data["status"] != current.get("status"):
            hist = list(current.get("status_history") or [])
            hist.append(
                {
                    "status": update_data["status"],
                    "changed_at": utc_iso_z(),
                    "changed_by": _username(current_user),
                    "note": "Status updated",
                }
            )
            update_data["status_history"] = hist

    updated = await repo.update(qid, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return updated


@router.post(
    "/quotations/{quotation_id}/status",
    response_model=QuotationResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def advance_quotation_status(
    quotation_id: Union[int, str],
    payload: QuotationAdvanceStatus,
    repo: QuotationRepository = Depends(get_quotation_repo),
    current_user: dict = Depends(get_current_user),
):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of {ORDER_STATUSES}")

    qid = _norm_qid(quotation_id)
    current = await repo.get_by_id(qid)
    if not current:
        raise HTTPException(status_code=404, detail="Quotation not found")

    current_status = current.get("status")
    allowed = ORDER_STATUS_TRANSITIONS.get(current_status, [])
    if payload.status != current_status and payload.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Cannot move from '{current_status}' to '{payload.status}'. "
            f"Allowed next: {allowed or ['none (terminal)']}",
        )

    hist = list(current.get("status_history") or [])
    hist.append(
        {
            "status": payload.status,
            "changed_at": utc_iso_z(),
            "changed_by": _username(current_user),
            "note": payload.note,
        }
    )
    updated = await repo.update(qid, {"status": payload.status, "status_history": hist})
    if not updated:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return updated


@router.get("/quotations/{quotation_id}/tracking")
async def track_quotation(
    quotation_id: Union[int, str],
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    qid = _norm_qid(quotation_id)
    current = await repo.get_by_id(qid)
    if not current:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {
        "id": current.get("id"),
        "quotation_title": current.get("quotation_title"),
        "tag": current.get("tag"),
        "status": current.get("status"),
        "status_history": current.get("status_history") or [],
        "created_at": current.get("created_at"),
        "updated_at": current.get("updated_at"),
    }


@router.delete(
    "/quotations/{quotation_id}",
    dependencies=[Depends(require_role(_WRITE))],
)
async def delete_quotation(
    quotation_id: Union[int, str],
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    qid = _norm_qid(quotation_id)
    if not await repo.delete(qid):
        raise HTTPException(status_code=404, detail="Quotation not found")
    return {"message": "Quotation deleted successfully"}


# ─── Garment tags (QR) ──────────────────────────────────────────────────────────
def _tag_out(t: dict) -> TagOut:
    return TagOut(
        id=t["id"],
        code=t["code"],
        quotation_id=t["quotation_id"],
        line_item_id=t.get("line_item_id"),
        label=t.get("label"),
        created_at=t.get("created_at"),
        tracking_url=_tracking_url(t["code"]),
    )


@router.post(
    "/quotations/{quotation_id}/tags",
    response_model=TagsResponse,
    dependencies=[Depends(require_role(_WRITE))],
)
async def create_quotation_tags(
    quotation_id: Union[int, str],
    payload: TagCreate,
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    qid = _norm_qid(quotation_id)
    tags = await repo.create_tags(qid, payload.count, payload.per_item, payload.label)
    if tags is None:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return TagsResponse(quotation_id=qid, tags=[_tag_out(t) for t in tags])


@router.get(
    "/quotations/{quotation_id}/tags",
    response_model=TagsResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def list_quotation_tags(
    quotation_id: Union[int, str],
    repo: QuotationRepository = Depends(get_quotation_repo),
):
    qid = _norm_qid(quotation_id)
    tags = await repo.list_tags(qid)
    return TagsResponse(quotation_id=qid, tags=[_tag_out(t) for t in tags])


@router.get("/tags/{code}")
async def lookup_tag(code: str, repo: QuotationRepository = Depends(get_quotation_repo)):
    """Public: resolve a scanned tag to its order status (no PII beyond first name)."""
    tag = await repo.get_tag(code)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    q = await repo.get_by_id(tag["quotation_id"])
    if not q:
        raise HTTPException(status_code=404, detail="Order not found")
    client = q.get("client_name") or ""
    first_name = client.split()[0] if client else ""
    return {
        "code": tag["code"],
        "quotation_id": tag["quotation_id"],
        "label": tag.get("label"),
        "client_first_name": first_name,
        "quotation_title": q.get("quotation_title"),
        "status": q.get("status"),
        "status_history": q.get("status_history") or [],
        "tracking_url": _tracking_url(code),
    }


@router.get("/tags/{code}/tracking")
async def tag_tracking(code: str, repo: QuotationRepository = Depends(get_quotation_repo)):
    """Public: order timeline for a scanned tag."""
    tag = await repo.get_tag(code)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    q = await repo.get_by_id(tag["quotation_id"])
    if not q:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "id": q.get("id"),
        "quotation_title": q.get("quotation_title"),
        "tag": q.get("tag"),
        "status": q.get("status"),
        "status_history": q.get("status_history") or [],
        "created_at": q.get("created_at"),
        "updated_at": q.get("updated_at"),
        "garment_label": tag.get("label"),
    }
