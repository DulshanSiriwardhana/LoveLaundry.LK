class AdjustmentRepository:
    async def save(self, adjustment: dict) -> dict:
        raise NotImplementedError

    async def find(self, adjustment_id: str, organizations=None) -> dict | None:
        raise NotImplementedError

    async def list(
        self,
        status: str | None = None,
        gate_pass_id: str | None = None,
        organizations=None,
    ) -> list[dict]:
        raise NotImplementedError


def _in_scope(row: dict, organizations) -> bool:
    if not organizations:
        return True
    value = row.get("organization_id")
    if isinstance(organizations, (list, tuple, set)):
        return value in organizations
    return value == organizations


class InMemoryAdjustmentRepository(AdjustmentRepository):
    def __init__(self) -> None:
        self.adjustments: dict[str, dict] = {}

    async def save(self, adjustment: dict) -> dict:
        key = str(adjustment.get("id") or adjustment.get("adjustment_id") or "")
        self.adjustments[key] = adjustment
        return adjustment

    async def find(self, adjustment_id: str, organizations=None) -> dict | None:
        row = self.adjustments.get(adjustment_id)
        return row if row is not None and _in_scope(row, organizations) else None

    async def list(self, status=None, gate_pass_id=None, organizations=None) -> list[dict]:
        rows = [
            row for row in self.adjustments.values() if _in_scope(row, organizations)
        ]
        if status:
            rows = [row for row in rows if str(row.get("status") or "") == status]
        if gate_pass_id:
            rows = [
                row
                for row in rows
                if str(row.get("gate_pass_id") or "") == gate_pass_id
            ]
        return rows
