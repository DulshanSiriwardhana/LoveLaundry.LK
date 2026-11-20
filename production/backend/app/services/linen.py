from ..core.clock import now
from ..repositories.linen import MovementRepository


def compute_linen_operations(movements: list[dict]) -> dict:
    received = 0.0
    delivered = 0.0
    for movement in movements:
        quantity = float(movement.get("quantity") or 0.0)
        direction = str(movement.get("direction") or "")
        if direction == "in":
            received += quantity
        elif direction == "out":
            delivered += quantity
    return {
        "received": round(received, 2),
        "delivered": round(delivered, 2),
        "net": round(received - delivered, 2),
    }


class LinenService:
    def __init__(self, movement_repository: MovementRepository) -> None:
        self.movement_repository = movement_repository

    async def record_movement(self, movement: dict) -> dict:
        from fastapi import HTTPException, status

        clean_reason = str(movement.get("reason") or "").strip()
        if not clean_reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to record a movement")
        movement["reason"] = clean_reason
        movement["updated_at"] = now().isoformat()
        movement["edited_by"] = movement.get("actor_id") or "system"
        if not movement.get("period"):
            movement["period"] = now().strftime("%Y-%m")
        return await self.movement_repository.save(movement)

    async def compute_operations(self, period: str) -> dict:
        movements = await self.movement_repository.list_by_period(period)
        return {"period": period, **compute_linen_operations(movements)}
