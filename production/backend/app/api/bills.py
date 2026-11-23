from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..core.clock import current_period
from ..core.config import get_settings
from ..core.principal import actor_identity, repository_scope
from ..core.security import get_current_user
from ..permissions.service import require_capability
from ..services.bills import BillsService

router = APIRouter(tags=["operations"])


class MonthlyOperationsResponse(BaseModel):
    period: str
    delivered: float
    outstanding: float
    billable: float
    received: float


class EditBillRequest(BaseModel):
    amount: float = Field(ge=0)
    reason: str
    actor_id: str = "system"


class EditInvoiceRequest(BaseModel):
    total: float = Field(ge=0)
    reason: str
    actor_id: str = "system"


_service_instance: BillsService | None = None


def _service() -> BillsService:
    global _service_instance
    if _service_instance is None:
        from ..repositories.bills import BillRepository, InvoiceRepository
        from ..repositories.in_memory import InMemoryBillRepository, InMemoryInvoiceRepository

        if get_settings().persistence == "mongo":
            from ..repositories.mongo import MongoBillRepository, MongoInvoiceRepository

            bill_repo: BillRepository = MongoBillRepository()
            invoice_repo: InvoiceRepository = MongoInvoiceRepository()
        else:
            bill_repo = InMemoryBillRepository()
            invoice_repo = InMemoryInvoiceRepository()
        _service_instance = BillsService(bill_repo, invoice_repo)
    return _service_instance


@router.get(
    "/operations/monthly",
    response_model=MonthlyOperationsResponse,
    dependencies=[Depends(require_capability("view_bills"))],
)
async def monthly_operations(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
    principal=Depends(get_current_user),
) -> dict:
    return await _service().get_monthly_operations(period, repository_scope(principal))


@router.get(
    "/bills",
    dependencies=[Depends(require_capability("view_bills"))],
)
async def list_bills(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await _service().list_bills(period, repository_scope(principal))


@router.get(
    "/invoices",
    dependencies=[Depends(require_capability("view_bills"))],
)
async def list_invoices(
    period: str = Query(default_factory=current_period, pattern=r"^\d{4}-\d{2}$"),
    principal=Depends(get_current_user),
) -> list[dict]:
    return await _service().list_invoices(period, repository_scope(principal))


@router.post("/bills/{bill_id}/edit", dependencies=[Depends(require_capability("edit_bills"))])
async def edit_bill(
    bill_id: str, payload: EditBillRequest, principal=Depends(get_current_user)
) -> dict:
    actor = actor_identity(principal, payload.actor_id)
    return await _service().edit_bill(
        bill_id,
        payload.amount,
        payload.reason,
        actor["actor_id"],
        repository_scope(principal),
    )


@router.post(
    "/invoices/{invoice_id}/edit", dependencies=[Depends(require_capability("edit_bills"))]
)
async def edit_invoice(
    invoice_id: str, payload: EditInvoiceRequest, principal=Depends(get_current_user)
) -> dict:
    actor = actor_identity(principal, payload.actor_id)
    return await _service().edit_invoice(
        invoice_id,
        payload.total,
        payload.reason,
        actor["actor_id"],
        repository_scope(principal),
    )


def single_organization_scope(principal: dict, requested: str | None = None) -> str | None:
    """Return one organization for write operations that target a single row."""

    scope = repository_scope(principal, requested)
    if isinstance(scope, list):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "An organization_id is required for this account",
        )
    return scope
