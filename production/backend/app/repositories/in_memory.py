def _in_scope(row: dict, organizations) -> bool:
    if not organizations:
        return True
    value = row.get("organization_id")
    if isinstance(organizations, (list, tuple, set)):
        return value in organizations
    return value == organizations


class InMemoryBillRepository:
    def __init__(self) -> None:
        self.bills: dict[str, dict] = {}

    async def find(self, bill_id: str, organizations=None) -> dict | None:
        row = self.bills.get(bill_id)
        return row if row is not None and _in_scope(row, organizations) else None

    async def save(self, bill: dict) -> dict:
        self.bills[str(bill.get("bill_id") or "")] = bill
        return bill

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        return [
            bill
            for bill in self.bills.values()
            if str(bill.get("period") or "") == period and _in_scope(bill, organizations)
        ]

    async def find_by_gate_pass(self, gate_pass_id: str, organizations=None) -> dict | None:
        for bill in self.bills.values():
            if (
                str(bill.get("gate_pass_id") or "") == gate_pass_id
                and _in_scope(bill, organizations)
            ):
                return bill
        return None


class InMemoryInvoiceRepository:
    def __init__(self) -> None:
        self.invoices: dict[str, dict] = {}

    async def find(self, invoice_id: str, organizations=None) -> dict | None:
        row = self.invoices.get(invoice_id)
        return row if row is not None and _in_scope(row, organizations) else None

    async def save(self, invoice: dict) -> dict:
        self.invoices[str(invoice.get("invoice_id") or "")] = invoice
        return invoice

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        return [
            invoice
            for invoice in self.invoices.values()
            if str(invoice.get("period") or "") == period and _in_scope(invoice, organizations)
        ]
