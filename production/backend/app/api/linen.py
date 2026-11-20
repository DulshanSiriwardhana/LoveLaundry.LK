from fastapi import APIRouter
from pydantic import BaseModel

from ..services.linen import LinenService

router = APIRouter(tags=["linen"])


class MovementRequest(BaseModel):
    movement_id: str
    linen_id: str
    direction: str
    quantity: float
    from_org: str = ""
    to_org: str = ""
    reason: str
    period: str = ""
    actor_id: str = "system"


class LinenOperationsResponse(BaseModel):
    period: str
    received: float
    delivered: float
    net: float


_service_instance = None


def _service() -> LinenService:
    global _service_instance
    if _service_instance is None:
        from ..repositories.linen import InMemoryMovementRepository, MovementRepository

        _service_instance = LinenService(InMemoryMovementRepository())
    return _service_instance


@router.post("/linen/movements")
async def record_movement(payload: MovementRequest) -> dict:
    service = _service()
    movement = {
        "movement_id": payload.movement_id,
        "linen_id": payload.linen_id,
        "direction": payload.direction,
        "quantity": payload.quantity,
        "from_org": payload.from_org,
        "to_org": payload.to_org,
        "period": payload.period,
        "reason": payload.reason,
        "actor_id": payload.actor_id,
    }
    return await service.record_movement(movement)


@router.get("/linen/operations", response_model=LinenOperationsResponse)
async def linen_operations(period: str = "1970-01") -> dict:
    service = _service()
    return await service.compute_operations(period)
