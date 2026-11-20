from fastapi import HTTPException, status


def _field(obj, key: str, default: str = "") -> str:
    if isinstance(obj, dict):
        return str(obj.get(key) or default)
    return str(getattr(obj, key, None) or default)


class AdjustmentsService:
    def __init__(self, adjustment_repository) -> None:
        self.adjustment_repository = adjustment_repository

    async def create_adjustment(self, payload: dict) -> dict:
        reason = str(payload.get("reason") or "").strip()
        if not reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to request an adjustment")
        if str(payload.get("status") or "REQUESTED") != "REQUESTED":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Adjustment requests are created as REQUESTED")
        adjustment = {
            "id": str(payload.get("adjustment_id") or payload.get("id") or ""),
            "gate_pass_id": str(payload.get("gate_pass_id") or ""),
            "item_name": str(payload.get("item_name") or ""),
            "specification": str(payload.get("specification") or ""),
            "original_qty": float(payload.get("original_qty") or 0.0),
            "corrected_qty": float(payload.get("corrected_qty") or 0.0),
            "reason": reason,
            "status": "REQUESTED",
            "requested_by": str(payload.get("requested_by") or payload.get("actor_id") or "system"),
            "requested_by_id": str(payload.get("requested_by_id") or payload.get("actor_id") or "system"),
            "created_at": payload.get("created_at") or "1970-01-01T00:00:00+00:00",
            "updated_at": payload.get("updated_at") or "1970-01-01T00:00:00+00:00",
        }
        return await self.adjustment_repository.save(adjustment)

    async def list_adjustments(self, status: str | None = None, gate_pass_id: str | None = None) -> list[dict]:
        return await self.adjustment_repository.list(status=status, gate_pass_id=gate_pass_id)

    async def approve_adjustment(self, adjustment_id: str, approver) -> dict:
        adjustment = await self.adjustment_repository.find(adjustment_id)
        if adjustment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjustment not found")
        if str(adjustment.get("status") or "") != "REQUESTED":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Adjustment is already {adjustment.get('status')}.",
            )
        requester_id = _field(adjustment, "requested_by_id", "system")
        approver_id = _field(approver, "auth_id") or _field(approver, "user_name")
        if requester_id and approver_id and requester_id == approver_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Adjustments must be approved by a different user than the requester.",
            )
        adjustment["status"] = "APPROVED"
        adjustment["approved_by"] = _field(approver, "user_name") or _field(approver, "auth_id")
        adjustment["approved_by_id"] = approver_id
        adjustment["approved_at"] = "1970-01-01T00:00:00+00:00"
        adjustment["updated_at"] = "1970-01-01T00:00:00+00:00"
        return await self.adjustment_repository.save(adjustment)

    async def reject_adjustment(self, adjustment_id: str, actor) -> dict:
        adjustment = await self.adjustment_repository.find(adjustment_id)
        if adjustment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Adjustment not found")
        if str(adjustment.get("status") or "") != "REQUESTED":
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Adjustment is already {adjustment.get('status')}.",
            )
        adjustment["status"] = "REJECTED"
        adjustment["rejected_by"] = _field(actor, "user_name") or _field(actor, "auth_id")
        adjustment["rejected_by_id"] = _field(actor, "auth_id") or _field(actor, "user_name")
        adjustment["rejected_at"] = "1970-01-01T00:00:00+00:00"
        adjustment["updated_at"] = "1970-01-01T00:00:00+00:00"
        return await self.adjustment_repository.save(adjustment)
