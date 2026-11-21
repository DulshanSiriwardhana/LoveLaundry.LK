from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..core.security import get_current_user
from ..permissions.service import organization_dependency, require_capability
from ..runtime import get_runtime

router = APIRouter(prefix="/billing", tags=["billing"])


class AdjustmentLine(BaseModel):
    description: str = ""
    amount: float


class GenerateInvoiceRequest(BaseModel):
    organization_id: str
    hotel_id: str = Field(min_length=1)
    period_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    period_end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    invoice_id: str | None = None
    adjustments: list[AdjustmentLine] = Field(default_factory=list)


class RecordPaymentRequest(BaseModel):
    payment_id: str = Field(min_length=1)
    amount: float = Field(gt=0)


@router.post(
    "/invoices/generate",
    dependencies=[Depends(organization_dependency("issue_invoices"))],
)
async def generate_invoice(
    payload: GenerateInvoiceRequest, principal=Depends(get_current_user)
) -> dict:
    return await get_runtime().billing_engine.generate_invoice(payload.model_dump(), principal)


@router.get(
    "/invoices",
    dependencies=[Depends(organization_dependency("view_bills"))],
)
async def list_invoices(
    organization_id: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    scoped = organization_id or (
        principal.get("organization_id") if not principal.get("platform_admin") else None
    )
    if not scoped:
        return []
    return await get_runtime().billing_repository.list_invoices(scoped, limit)


@router.post(
    "/invoices/{invoice_id}/issue",
    dependencies=[Depends(require_capability("issue_invoices"))],
)
async def issue_invoice(invoice_id: str, principal=Depends(get_current_user)) -> dict:
    return await get_runtime().billing_engine.finalize_invoice(invoice_id, principal)


@router.post(
    "/invoices/{invoice_id}/payments",
    dependencies=[Depends(require_capability("record_payments"))],
)
async def record_payment(
    invoice_id: str, payload: RecordPaymentRequest, principal=Depends(get_current_user)
) -> dict:
    body = {**payload.model_dump(), "invoice_id": invoice_id}
    return await get_runtime().billing_engine.record_payment(body, principal)
