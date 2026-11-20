from fastapi import APIRouter
from pydantic import BaseModel

from ..services.bills import BillsService

router = APIRouter(tags=["operations"])


class MonthlyOperationsResponse(BaseModel):
    period: str
    delivered: float
    outstanding: float
    billable: float
    received: float


class EditBillRequest(BaseModel):
    amount: float
    reason: str
    actor_id: str = "system"


class EditInvoiceRequest(BaseModel):
    total: float
    reason: str
    actor_id: str = "system"


_service_instance: BillsService | None = None


def _service() -> BillsService:
    global _service_instance
    if _service_instance is None:
        from ..repositories.bills import BillRepository, InvoiceRepository
        from ..repositories.in_memory import InMemoryBillRepository, InMemoryInvoiceRepository

        bill_repo: BillRepository = InMemoryBillRepository()
        invoice_repo: InvoiceRepository = InMemoryInvoiceRepository()
        _service_instance = BillsService(bill_repo, invoice_repo)
    return _service_instance


@router.get("/operations/monthly", response_model= MonthlyOperationsResponse)
async def monthly_operations(period: str = "1970-01") -> dict:
    service = _service()
    return await service.get_monthly_operations(period)


@router.post("/bills/{bill_id}/edit")
async def edit_bill(bill_id: str, payload: EditBillRequest) -> dict:
    service = _service()
    return await service.edit_bill(bill_id, payload.amount, payload.reason, payload.actor_id)


@router.post("/invoices/{invoice_id}/edit")
async def edit_invoice(invoice_id: str, payload: EditInvoiceRequest) -> dict:
    service = _service()
    return await service.edit_invoice(invoice_id, payload.total, payload.reason, payload.actor_id)
