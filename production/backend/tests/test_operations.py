import asyncio

from app.api import bills as bills_api_module
from app.services.bills import BillsService


def _seed_bill(amount: float, status: str, period: str) -> None:
    service = bills_api_module._service()

    async def run() -> None:
        await service.bill_repository.save(
            {
                "bill_id": "bill-1",
                "organization_id": "org-1",
                "order_id": "ord-1",
                "status": status,
                "amount": amount,
                "period": period,
            }
        )

    asyncio.run(run())


def test_monthly_operations_returns_period_totals(client) -> None:
    response = client.get("/operations/monthly", params={"period": "2026-11"})
    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "2026-11"
    assert body["delivered"] == 0
    assert body["outstanding"] == 0
    assert body["billable"] == 0
    assert body["received"] == 0


def test_edit_bill_requires_reason(client) -> None:
    response = client.post(
        "/bills/bill-1/edit", json={"amount": 250.0, "reason": "   ", "actor_id": "u1"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A reason is required to edit a bill"


def test_edit_bill_updates_and_recomputes_monthly_operations(client) -> None:
    _seed_bill(250.0, "delivered", "2026-11")

    response = client.post(
        "/bills/bill-1/edit",
        json={"amount": 250.0, "reason": "Price correction after invoice", "actor_id": "u1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["bill"]["amount"] == 250.0
    assert body["bill"]["edit_reason"] == "Price correction after invoice"
    assert body["bill"]["edited_by"] == "u1"

    operations = client.get("/operations/monthly", params={"period": "2026-11"}).json()
    assert operations["delivered"] == 250.0


def test_edit_invoice_requires_reason(client) -> None:
    response = client.post(
        "/invoices/inv-1/edit", json={"total": 900.0, "reason": "", "actor_id": "u1"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A reason is required to edit an invoice"


def test_edit_invoice_updates_and_recomputes_monthly_operations(client) -> None:
    service = bills_api_module._service()

    async def run() -> None:
        await service.invoice_repository.save(
            {
                "invoice_id": "inv-1",
                "organization_id": "org-1",
                "bill_id": "bill-1",
                "status": "billable",
                "total": 900.0,
                "period": "2026-11",
            }
        )

    asyncio.run(run())

    bill_service = bills_api_module._service()

    async def seed_bill() -> None:
        await bill_service.bill_repository.save(
            {
                "bill_id": "bill-1",
                "organization_id": "org-1",
                "order_id": "ord-1",
                "status": "billable",
                "amount": 900.0,
                "period": "2026-11",
            }
        )

    asyncio.run(seed_bill())

    response = client.post(
        "/invoices/inv-1/edit",
        json={"total": 1200.0, "reason": "Amount corrected after billing", "actor_id": "u1"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["invoice"]["total"] == 1200.0
    assert body["invoice"]["edit_reason"] == "Amount corrected after billing"
    assert body["invoice"]["edited_by"] == "u1"

    operations = client.get("/operations/monthly", params={"period": "2026-11"}).json()
    assert operations["billable"] == 900.0
