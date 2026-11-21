from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..core.clock import current_period
from ..core.config import get_settings
from ..core.principal import repository_scope
from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..services.linen import LinenService

router = APIRouter(tags=["linen"])


class MovementRequest(BaseModel):
    movement_id: str
    linen_id: str
    direction: Literal["in", "out"]
    quantity: float = Field(gt=0)
    from_org: str = ""
    to_org: str = ""
    organization_id: str | None = None
    reason: str
    period: str = Field(default_factory=current_period, pattern=r"^\d{4}-\d{2}$")
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

        if get_settings().persistence == "mongo":
            from ..repositories.mongo import MongoMovementRepository

            repository: MovementRepository = MongoMovementRepository()
        else:
            repository = InMemoryMovementRepository()
        _service_instance = LinenService(repository)
    return _service_instance


@router.post("/linen/movements", dependencies=[Depends(require_capability("edit_linen"))])
async def record_movement(payload: MovementRequest, principal=Depends(get_current_user)) -> dict:
    from .bills import single_organization_scope

    service = _service()
    movement = {
        "movement_id": payload.movement_id,
        "linen_id": payload.linen_id,
        "direction": payload.direction,
        "quantity": payload.quantity,
        "from_org": payload.from_org,
        "to_org": payload.to_org,
        "organization_id": payload.organization_id,
        "period": payload.period,
        "reason": payload.reason,
        "actor_id": payload.actor_id,
    }
    return await service.record_movement(
        movement, single_organization_scope(principal, payload.organization_id)
    )


@router.get(
    "/linen/operations",
    response_model=LinenOperationsResponse,
    dependencies=[Depends(require_capability("view_linen"))],
)
async def linen_operations(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
    principal=Depends(get_current_user),
) -> dict:
    return await _service().compute_operations(period, repository_scope(principal))
