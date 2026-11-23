"""Reader registration, revocation, health and compatibility endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..rfid.adapters import build_adapter
from ..runtime import get_runtime

router = APIRouter(prefix="/rfid", tags=["rfid-hardware"])


class RegisterReaderRequest(BaseModel):
    reader_id: str = Field(min_length=1, max_length=200)
    organization_id: str = Field(min_length=1, max_length=200)
    name: str = Field(default="", max_length=200)
    manufacturer: str = ""
    model: str = ""
    adapter: str = Field(min_length=1, max_length=80)
    transport: str = "tcp"
    endpoint: str = ""
    region: str = ""
    frequency_mhz: float | None = None
    antenna_config: dict = Field(default_factory=dict)
    capabilities: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)


async def authenticated_reader(
    x_reader_id: str = Header(default="", alias="X-Reader-ID"),
    x_reader_key: str = Header(default="", alias="X-Reader-Key"),
) -> dict:
    return await get_runtime().reader_service.authenticate(x_reader_id, x_reader_key)


@router.post(
    "/readers",
    dependencies=[Depends(require_capability("manage_readers"))],
)
async def register_reader(payload: RegisterReaderRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().reader_service.register(payload.model_dump(), principal)


@router.get(
    "/readers",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def list_readers(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().reader_service.list(principal)


@router.get(
    "/readers/{reader_id}",
    dependencies=[Depends(require_capability("view_tags"))],
)
async def get_reader(reader_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().reader_service.get(reader_id, principal)


@router.delete(
    "/readers/{reader_id}",
    dependencies=[Depends(require_capability("manage_readers"))],
)
async def revoke_reader(reader_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().reader_service.revoke(reader_id, principal)


@router.post("/readers/{reader_id}/heartbeat")
async def reader_heartbeat(
    reader_id: str, reader=Depends(authenticated_reader)
) -> dict:
    if str(reader.get("reader_id") or "") != reader_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Reader credentials do not match path")
    return await get_runtime().reader_service.heartbeat_authenticated(reader)


@router.post("/readers/{reader_id}/probe")
async def probe_reader(reader_id: str, reader=Depends(authenticated_reader)) -> dict:
    if str(reader.get("reader_id") or "") != reader_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Reader credentials do not match path")
    try:
        adapter = build_adapter(reader, get_runtime().settings)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    result = await adapter.status()
    return result.to_dict()


@router.get("/compatibility")
async def compatibility() -> list[dict]:
    return get_runtime().reader_service.matrix()
