from fastapi import APIRouter

from ..services.integration import OperationsIntegration

router = APIRouter(tags=["operations"])


@router.get("/operations/snapshot")
async def operations_snapshot(period: str = "1970-01") -> dict:
    from ..api.bills import _service as bills_service_factory
    from ..api.linen import _service as linen_service_factory

    bills_service = bills_service_factory()
    linen_service = linen_service_factory()
    integration = OperationsIntegration(bills_service, linen_service)
    return await integration.snapshot(period)
