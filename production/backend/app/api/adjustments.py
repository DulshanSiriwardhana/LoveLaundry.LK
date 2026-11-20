from fastapi import APIRouter
from pydantic import BaseModel

from ..repositories.adjustments import AdjustmentRepository, InMemoryAdjustmentRepository
from ..services.adjustments import AdjustmentsService

router = APIRouter(prefix="/adjustments", tags=["adjustments"])


class CreateAdjustmentRequest(BaseModel):
    adjustment_id: str
    gate_pass_id: str
    item_name: str
    specification: str = ""
    original_qty: float
    corrected_qty: float
    reason: str
    actor_id: str = "system"


class AdjustmentResponse(BaseModel):
    id: str
    gate_pass_id: str
    item_name: str
    specification: str
    original_qty: float
    corrected_qty: float
    reason: str
    status: str
    requested_by: str
    created_at: str
    updated_at: str = ""


class ApproverRequest(BaseModel):
    auth_id: str = "system"
    user_name: str = "system"


class ActorRequest(BaseModel):
    auth_id: str = "system"
    user_name: str = "system"


_service_instance = None


def _service() -> AdjustmentsService:
    global _service_instance
    if _service_instance is None:
        _service_instance = AdjustmentsService(InMemoryAdjustmentRepository())
    return _service_instance


@router.post("", response_model= AdjustmentResponse)
async def create_adjustment(payload: CreateAdjustmentRequest) -> AdjustmentResponse:
    service = _service()
    adjustment = await service.create_adjustment(
        {
            "adjustment_id": payload.adjustment_id,
            "gate_pass_id": payload.gate_pass_id,
            "item_name": payload.item_name,
            "specification": payload.specification,
            "original_qty": payload.original_qty,
            "corrected_qty": payload.corrected_qty,
            "reason": payload.reason,
            "actor_id": payload.actor_id,
        }
    )
    return AdjustmentResponse(**adjustment)


@router.get("", response_model=list[AdjustmentResponse])
async def list_adjustments(status: str | None = None, gate_pass_id: str | None = None) -> list[AdjustmentResponse]:
    service = _service()
    rows = await service.list_adjustments(status=status, gate_pass_id=gate_pass_id)
    return [AdjustmentResponse(**row) for row in rows]


@router.post("/{adjustment_id}/approve")
async def approve_adjustment(adjustment_id: str, approver: ApproverRequest) -> dict:
    service = _service()
    adjustment = await service.approve_adjustment(adjustment_id, approver.model_dump())
    return {"id": adjustment["id"], "status": adjustment["status"], "gate_pass_id": adjustment.get("gate_pass_id") or ""}


@router.post("/{adjustment_id}/reject")
async def reject_adjustment(adjustment_id: str, actor: ActorRequest) -> dict:
    service = _service()
    adjustment = await service.reject_adjustment(adjustment_id, actor.model_dump())
    return {"id": adjustment["id"], "status": adjustment["status"]}
