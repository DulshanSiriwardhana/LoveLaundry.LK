from ..core.clock import now
from .monthly_operations import compute_monthly_operations


class BillsService:
    def __init__(self, bill_repository, invoice_repository) -> None:
        self.bill_repository = bill_repository
        self.invoice_repository = invoice_repository

    async def get_monthly_operations(self, period: str) -> dict:
        bills = await self.bill_repository.list_by_period(period)
        return {"period": period, **compute_monthly_operations(bills)}

    async def list_bills(self, period: str) -> list[dict]:
        return await self.bill_repository.list_by_period(period)

    async def list_invoices(self, period: str) -> list[dict]:
        return await self.invoice_repository.list_by_period(period)

    async def edit_bill(self, bill_id: str, amount: float, reason: str, actor_id: str) -> dict:
        clean_reason = (reason or "").strip()
        if not clean_reason:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to edit a bill")
        bill = await self.bill_repository.find(bill_id)
        if bill is None:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bill not found")
        bill["amount"] = amount
        bill["status"] = bill.get("status") or "outstanding"
        bill["updated_at"] = now().isoformat()
        bill["edit_reason"] = clean_reason
        bill["edited_by"] = actor_id
        saved = await self.bill_repository.save(bill)
        operations = await self.get_monthly_operations(str(bill.get("period") or ""))
        return {"bill": saved, "monthly_operations": operations}

    async def edit_invoice(self, invoice_id: str, total: float, reason: str, actor_id: str) -> dict:
        clean_reason = (reason or "").strip()
        if not clean_reason:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to edit an invoice")
        invoice = await self.invoice_repository.find(invoice_id)
        if invoice is None:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
        invoice["total"] = total
        invoice["updated_at"] = now().isoformat()
        invoice["edit_reason"] = clean_reason
        invoice["edited_by"] = actor_id
        saved = await self.invoice_repository.save(invoice)
        bill_id = str(invoice.get("bill_id") or "")
        bill = await self.bill_repository.find(bill_id) if bill_id else None
        if bill is not None:
            bill["amount"] = total
            bill["updated_at"] = now().isoformat()
            bill["edit_reason"] = clean_reason
            bill["edited_by"] = actor_id
            saved_bill = await self.bill_repository.save(bill)
            period = str(saved_bill.get("period") or invoice.get("period") or "")
        else:
            period = str(invoice.get("period") or "")
        operations = await self.get_monthly_operations(period)
        return {"invoice": saved, "monthly_operations": operations}
