from .bills import BillsService
from .linen import LinenService


class OperationsIntegration:
    def __init__(self, bills_service: BillsService, linen_service: LinenService) -> None:
        self.bills_service = bills_service
        self.linen_service = linen_service

    async def snapshot(self, period: str) -> dict:
        financial = await self.bills_service.get_monthly_operations(period)
        linen = await self.linen_service.compute_operations(period)
        return {"period": period, "financial": financial, "linen": linen}
