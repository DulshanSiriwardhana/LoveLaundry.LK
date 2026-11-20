from fastapi import APIRouter, Depends, Query

from ..core.clock import current_period
from ..permissions.service import require_capability
from ..services.integration import OperationsIntegration

router = APIRouter(tags=["operations"])


@router.get(
    "/operations/snapshot",
    dependencies=[Depends(require_capability("view_operations"))],
)
async def operations_snapshot(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
) -> dict:
    from ..api.bills import _service as bills_service_factory
    from ..api.linen import _service as linen_service_factory

    bills_service = bills_service_factory()
    linen_service = linen_service_factory()
    integration = OperationsIntegration(bills_service, linen_service)
    return await integration.snapshot(period)
