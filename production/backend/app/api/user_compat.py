"""Compatibility aliases for clients that still speak the older `/user` vocabulary.

The platform-admin frontend reads hotels through `${VITE_USER_API_URL}/hotels`
and expects the registry's paged `{items, total}` envelope. The central hotel
registry remains the only source of hotel identity and codes; these handlers
only adapt its shape to the URL contract the client was built against.
"""

from __future__ import annotations

import inspect

from fastapi import APIRouter, Depends, Query

from ..permissions.service import require_platform_admin
from ..runtime import get_runtime

router = APIRouter(prefix="/user", tags=["user-compat"])

_PLATFORM = Depends(require_platform_admin)


def _hotel_view(row: dict) -> dict:
    identifier = str(
        row.get("hotel_id") or row.get("id") or row.get("organization_id") or ""
    )
    return {
        "hotel_id": identifier,
        "id": identifier,
        "hotel_code": str(row.get("hotel_code") or ""),
        "name": str(row.get("name") or row.get("user_name") or ""),
        "status": str(row.get("status") or ""),
        "associated_laundry_id": str(
            row.get("associated_laundry_id") or row.get("laundry_id") or ""
        ),
    }


async def _registry_hotels() -> list[dict]:
    runtime = get_runtime()
    database = getattr(runtime, "central_database", None)
    if database is not None:
        cursor = database["hotels"].find({})
        if inspect.isawaitable(cursor):
            cursor = await cursor
        rows = cursor.to_list(length=1000)
        if inspect.isawaitable(rows):
            rows = await rows
        return [dict(row) for row in rows]
    rows = await runtime.platform_service.organizations()
    return [row for row in rows if str(row.get("type") or "") == "hotel"]


@router.get("/hotels", dependencies=[_PLATFORM])
async def user_hotels(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    hotels = [_hotel_view(row) for row in await _registry_hotels()]
    return {
        "items": hotels[offset : offset + limit],
        "total": len(hotels),
        "limit": limit,
        "offset": offset,
    }


@router.get("/hotels/{hotel_id}", dependencies=[_PLATFORM])
async def user_hotel(hotel_id: str) -> dict | None:
    for row in await _registry_hotels():
        view = _hotel_view(row)
        if view["hotel_id"] == str(hotel_id) or view["id"] == str(hotel_id):
            return view
    return None
