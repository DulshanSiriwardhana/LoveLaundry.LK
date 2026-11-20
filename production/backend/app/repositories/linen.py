class MovementRepository:
    async def save(self, movement: dict) -> dict:
        raise NotImplementedError

    async def list_by_period(self, period: str) -> list[dict]:
        raise NotImplementedError


class InMemoryMovementRepository:
    def __init__(self) -> None:
        self.movements: dict[str, dict] = {}

    async def save(self, movement: dict) -> dict:
        self.movements[str(movement.get("movement_id") or "")] = movement
        return movement

    async def list_by_period(self, period: str) -> list[dict]:
        return [
            movement
            for movement in self.movements.values()
            if str(movement.get("period") or "") == period
        ]
