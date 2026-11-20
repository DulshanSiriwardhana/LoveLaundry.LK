class BillRepository:
    async def find(self, bill_id: str) -> dict | None:
        raise NotImplementedError

    async def save(self, bill: dict) -> dict:
        raise NotImplementedError

    async def list_by_period(self, period: str) -> list[dict]:
        raise NotImplementedError

    async def find_by_gate_pass(self, gate_pass_id: str) -> dict | None:
        raise NotImplementedError


class InvoiceRepository:
    async def find(self, invoice_id: str) -> dict | None:
        raise NotImplementedError

    async def save(self, invoice: dict) -> dict:
        raise NotImplementedError
