class MovementRepository:
    async def save(self, movement: dict) -> dict:
        raise NotImplementedError

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        raise NotImplementedError


def _in_scope(row: dict, organizations) -> bool:
    if not organizations:
        return True
    value = row.get("organization_id")
    if isinstance(organizations, (list, tuple, set)):
        return value in organizations
    return value == organizations


class InMemoryMovementRepository(MovementRepository):
    def __init__(self) -> None:
        self.movements: dict[str, dict] = {}

    async def save(self, movement: dict) -> dict:
        self.movements[str(movement.get("movement_id") or "")] = movement
        return movement

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        return [
            movement
            for movement in self.movements.values()
            if str(movement.get("period") or "") == period
            and _in_scope(movement, organizations)
        ]
