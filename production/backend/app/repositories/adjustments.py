class AdjustmentRepository:
    async def save(self, adjustment: dict) -> dict:
        raise NotImplementedError

    async def find(self, adjustment_id: str) -> dict | None:
        raise NotImplementedError

    async def list(self, status: str | None = None, gate_pass_id: str | None = None) -> list[dict]:
        raise NotImplementedError


class InMemoryAdjustmentRepository:
    def __init__(self) -> None:
        self.adjustments: dict[str, dict] = {}

    async def save(self, adjustment: dict) -> dict:
        self.adjustments[str(adjustment.get("id") or adjustment.get("adjustment_id") or "")] = adjustment
        return adjustment

    async def find(self, adjustment_id: str) -> dict | None:
        return self.adjustments.get(adjustment_id)

    async def list(self, status: str | None = None, gate_pass_id: str | None = None) -> list[dict]:
        rows = list(self.adjustments.values())
        if status:
            rows = [r for r in rows if str(r.get("status") or "") == status]
        if gate_pass_id:
            rows = [r for r in rows if str(r.get("gate_pass_id") or "") == gate_pass_id]
        return rows
