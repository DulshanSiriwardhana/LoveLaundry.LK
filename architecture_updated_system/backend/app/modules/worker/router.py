"""Worker daily task routes — recreates the legacy worker-service API surface.

Paths, methods, status codes and query parameters match the legacy service so
existing clients keep working unchanged.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ...core.security import get_current_user, require_role
from .deps import get_worker_repo
from .repository import WorkerRepository
from .schemas import (
    ATTENDANCE_STATUSES,
    DEPARTMENTS,
    SHIFTS,
    TASK_TYPES,
    TASK_UNITS,
    DailyLogCreate,
    DailyLogResponse,
    DailyLogUpdate,
    DailySummaryResponse,
    WorkerCreate,
    WorkerResponse,
    WorkerUpdate,
)
from .service import (
    ValidationError,
    daily_summary,
    normalize_create,
    normalize_update,
    range_summary,
    sync_task_counts,
    task_dicts,
    validate_attendance,
    validate_shift,
    validate_tasks,
)

router = APIRouter(tags=["workers"])

_READ = ["ADMIN", "MANAGER", "STAFF"]
_WRITE = ["ADMIN", "MANAGER"]


def _utc_iso_z() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/meta")
def meta():
    """Return valid enum values for form dropdowns."""
    return {
        "task_types": TASK_TYPES,
        "task_units": TASK_UNITS,
        "departments": DEPARTMENTS,
        "shifts": SHIFTS,
        "attendance_statuses": ATTENDANCE_STATUSES,
    }


# ─── Workers ──────────────────────────────────────────────────────────────────


@router.get(
    "/workers",
    response_model=list[WorkerResponse],
    dependencies=[Depends(require_role(_READ))],
)
async def get_all_workers(
    active_only: bool = False,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    return await repo.get_all_workers(active_only=active_only)


@router.get(
    "/workers/{worker_id}",
    response_model=WorkerResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def get_worker(
    worker_id: str,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    worker = await repo.get_worker_by_id(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.post(
    "/workers",
    response_model=WorkerResponse,
    status_code=201,
    dependencies=[Depends(require_role(_WRITE))],
)
async def create_worker(
    payload: WorkerCreate,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    if payload.department.upper() not in DEPARTMENTS:
        raise HTTPException(status_code=422, detail=f"Department must be one of {DEPARTMENTS}")
    data = {
        "worker_name": payload.worker_name.strip(),
        "department": payload.department.upper(),
        "phone": payload.phone,
        "is_active": payload.is_active,
        "joined_date": payload.joined_date,
        "notes": payload.notes,
    }
    return await repo.create_worker(data)


@router.put(
    "/workers/{worker_id}",
    response_model=WorkerResponse,
    dependencies=[Depends(require_role(_WRITE))],
)
async def update_worker(
    worker_id: str,
    payload: WorkerUpdate,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("department"):
        if update_data["department"].upper() not in DEPARTMENTS:
            raise HTTPException(
                status_code=422, detail=f"Department must be one of {DEPARTMENTS}"
            )
        update_data["department"] = update_data["department"].upper()
    updated = await repo.update_worker(worker_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Worker not found")
    return updated


@router.delete(
    "/workers/{worker_id}",
    dependencies=[Depends(require_role(_WRITE))],
)
async def delete_worker(
    worker_id: str,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    if not await repo.delete_worker(worker_id):
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": "Worker deleted successfully"}


# ─── Daily task logs ──────────────────────────────────────────────────────────


@router.get(
    "/daily-logs",
    response_model=list[DailyLogResponse],
    dependencies=[Depends(require_role(_READ))],
)
async def get_all_daily_logs(
    work_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    worker_name: Optional[str] = None,
    date_from: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    repo: WorkerRepository = Depends(get_worker_repo),
):
    return await repo.get_all_logs(
        work_date=work_date,
        worker_name=worker_name,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/daily-logs/{log_id}",
    response_model=DailyLogResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def get_daily_log(
    log_id: str,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    log = await repo.get_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return log


@router.post(
    "/daily-logs",
    response_model=DailyLogResponse,
    status_code=201,
    dependencies=[Depends(require_role(_READ))],
)
async def create_daily_log(
    payload: DailyLogCreate,
    repo: WorkerRepository = Depends(get_worker_repo),
    current_user: dict = Depends(get_current_user),
):
    try:
        validate_shift(payload.shift)
        validate_attendance(payload.attendance_status)
        validate_tasks(payload.tasks)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    log_data = {
        **payload.model_dump(),
        "tasks": task_dicts(payload.tasks),
        "shift": payload.shift.upper(),
        "attendance_status": payload.attendance_status.upper(),
        "created_by": current_user.get("username") or current_user.get("user_name") or current_user.get("sub"),
    }
    sync_task_counts(log_data)
    try:
        normalize_create(log_data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return await repo.create_log(log_data)


@router.put(
    "/daily-logs/{log_id}",
    response_model=DailyLogResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def update_daily_log(
    log_id: str,
    payload: DailyLogUpdate,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("shift"):
        try:
            update_data["shift"] = validate_shift(update_data["shift"])
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    if update_data.get("attendance_status"):
        try:
            update_data["attendance_status"] = validate_attendance(update_data["attendance_status"])
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    if update_data.get("tasks") is not None:
        try:
            validate_tasks(update_data["tasks"])
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        update_data["tasks"] = task_dicts(update_data["tasks"])

    if "is_group_work" in update_data or "team_members" in update_data:
        current = await repo.get_log_by_id(log_id)
        if not current:
            raise HTTPException(status_code=404, detail="Daily log not found")
        try:
            update_data = normalize_update(update_data, current)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    updated = await repo.update_log(log_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return updated


@router.delete(
    "/daily-logs/{log_id}",
    dependencies=[Depends(require_role(_WRITE))],
)
async def delete_daily_log(
    log_id: str,
    repo: WorkerRepository = Depends(get_worker_repo),
):
    if not await repo.delete_log(log_id):
        raise HTTPException(status_code=404, detail="Daily log not found")
    return {"message": "Daily log deleted successfully"}


# ─── Summaries ────────────────────────────────────────────────────────────────


@router.get(
    "/summary/daily",
    response_model=DailySummaryResponse,
    dependencies=[Depends(require_role(_READ))],
)
async def daily_summary_endpoint(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    repo: WorkerRepository = Depends(get_worker_repo),
):
    logs = await repo.get_all_logs(work_date=date)
    return daily_summary(logs, date)


@router.get(
    "/summary/range",
    dependencies=[Depends(require_role(_READ))],
)
async def range_summary_endpoint(
    date_from: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    repo: WorkerRepository = Depends(get_worker_repo),
):
    logs = await repo.get_all_logs(date_from=date_from, date_to=date_to)
    return range_summary(logs, date_from, date_to, _utc_iso_z())
