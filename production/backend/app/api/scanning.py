"""Shared QR + RFID scan and bulk-session endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..runtime import get_runtime
from .rfid import authenticated_reader

router = APIRouter(prefix="/scan", tags=["scanning"])


class ScanTransactionRequest(BaseModel):
    scan_id: str = Field(min_length=1, max_length=200)
    identifier: str = Field(min_length=1, max_length=500)
    method: str = "qr"
    action: str = Field(min_length=1, max_length=80)
    organization_id: str = ""
    to_organization_id: str = ""
    scanner_id: str = ""
    reader_id: str = ""
    session_id: str = ""
    batch_id: str = ""
    location: str = ""
    occurred_at: str = ""
    correlation_id: str = ""
    workflow_reference: str = ""


class StartSessionRequest(BaseModel):
    session_id: str = ""
    organization_id: str = ""
    action: str = Field(min_length=1, max_length=80)
    reader_id: str = ""
    expected_linen_ids: list[str] = Field(default_factory=list)
    expected_count: int | None = None
    mode: str = "bulk"


class SubmitReadsRequest(BaseModel):
    reads: list[dict] = Field(min_length=1, max_length=5000)


@router.post(
    "/transactions",
    dependencies=[Depends(require_capability("record_scans"))],
)
async def submit_scan(payload: ScanTransactionRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().scan_transactions.submit(payload.model_dump(), principal)


@router.post(
    "/sessions",
    dependencies=[Depends(require_capability("manage_scan_sessions"))],
)
async def start_session(payload: StartSessionRequest, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().scan_sessions.start(payload.model_dump(), principal)


@router.get(
    "/sessions",
    dependencies=[Depends(require_capability("view_scan_sessions"))],
)
async def list_sessions(principal=Depends(get_current_user)) -> list[dict]:
    return await get_runtime().scan_sessions.list(principal)


@router.get(
    "/sessions/{session_id}",
    dependencies=[Depends(require_capability("view_scan_sessions"))],
)
async def get_session(session_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().scan_sessions.get(session_id, principal)


@router.post("/sessions/{session_id}/reads")
async def submit_reads(
    session_id: str,
    payload: SubmitReadsRequest,
    reader=Depends(authenticated_reader),
) -> dict:
    runtime = get_runtime()
    return await runtime.scan_sessions.submit_reads(
        session_id, payload.reads, {"actor_id": reader.get("reader_id", "")}, reader
    )


@router.post("/sessions/{session_id}/capture")
async def capture_from_reader(
    session_id: str,
    reader=Depends(authenticated_reader),
    duration: float = Query(default=2.0, ge=0.1, le=60.0),
) -> dict:
    runtime = get_runtime()
    return await runtime.scan_sessions.capture_from_reader(
        session_id, {"actor_id": reader.get("reader_id", "")}, reader, duration
    )


@router.post(
    "/sessions/{session_id}/complete",
    dependencies=[Depends(require_capability("manage_scan_sessions"))],
)
async def complete_session(session_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().scan_sessions.complete(session_id, principal)


@router.get(
    "/sessions/{session_id}/reconcile",
    dependencies=[Depends(require_capability("view_scan_sessions"))],
)
async def reconcile_session(session_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().scan_sessions.reconcile(session_id, principal)
