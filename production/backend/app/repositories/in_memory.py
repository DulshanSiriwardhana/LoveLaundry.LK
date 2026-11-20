class InMemoryBillRepository:
    def __init__(self) -> None:
        self.bills: dict[str, dict] = {}

    async def find(self, bill_id: str) -> dict | None:
        return self.bills.get(bill_id)

    async def save(self, bill: dict) -> dict:
        self.bills[str(bill.get("bill_id") or "")] = bill
        return bill

    async def list_by_period(self, period: str) -> list[dict]:
        return [
            bill
            for bill in self.bills.values()
            if str(bill.get("period") or "") == period
        ]

    async def find_by_gate_pass(self, gate_pass_id: str) -> dict | None:
        for bill in self.bills.values():
            if str(bill.get("gate_pass_id") or "") == gate_pass_id:
                return bill
        return None


class InMemoryInvoiceRepository:
    def __init__(self) -> None:
        self.invoices: dict[str, dict] = {}

    async def find(self, invoice_id: str) -> dict | None:
        return self.invoices.get(invoice_id)

    async def save(self, invoice: dict) -> dict:
        self.invoices[str(invoice.get("invoice_id") or "")] = invoice
        return invoice

    async def list_by_period(self, period: str) -> list[dict]:
        return [
            invoice
            for invoice in self.invoices.values()
            if str(invoice.get("period") or "") == period
        ]
