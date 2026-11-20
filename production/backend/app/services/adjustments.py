from fastapi import HTTPException, status

from ..core.clock import now


def _field(obj, key: str, default: str = "") -> str:
    if isinstance(obj, dict):
        return str(obj.get(key) or default)
    return str(getattr(obj, key, None) or default)


class AdjustmentsService:
    def __init__(self, adjustment_repository, bills_service) -> None:
        self.adjustment_repository = adjustment_repository
        self.bills_service = bills_service

    async def create_adjustment(self, payload: dict) -> dict:
        reason = str(payload.get("reason") or "").strip()
        if not reason:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A reason is required to request an adjustment")
        if str(payload.get("status") or "REQUESTED") != "REQUESTED":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Adjustment requests are created as REQUESTED")
        adjustment_id = str(payload.get("adjustment_id") or payload.get("id") or "").strip()
        if not adjustment_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "An adjustment id is required")
        if await self.adjustment_repository.find(adjustment_id) is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Adjustment {adjustment_id} already exists.",
            )
        adjustment = {
            "id": adjustment_id,
            "gate_pass_id": str(payload.get("gate_pass_id") or ""),
            "item_name": str(payload.get("item_name") or ""),
            "specification": str(payload.get("specification") or ""),
            "original_qty": float(payload.get("original_qty") or 0.0),
            "corrected_qty": float(payload.get("corrected_qty") or 0.0),
            "reason": reason,
            "status": "REQUESTED",
            "requested_by": str(payload.get("requested_by") or payload.get("actor_id") or "system"),
            "requested_by_id": str(payload.get("requested_by_id") or payload.get("actor_id") or "system"),
            "created_at": payload.get("created_at") or now().isoformat(),
            "updated_at": payload.get("updated_at") or now().isoformat(),
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
        adjustment["approved_at"] = now().isoformat()
        adjustment["updated_at"] = now().isoformat()
        saved = await self.adjustment_repository.save(adjustment)

        # Simultaneous financial propagation: the approved correction re-clamps
        # the linked bill, and the monthly operations snapshot refreshes from it.
        bill = None
        gate_pass_id = str(saved.get("gate_pass_id") or "")
        if gate_pass_id:
            bill = await self.bills_service.bill_repository.find_by_gate_pass(gate_pass_id)
        operations = None
        if bill is not None:
            corrected = float(saved.get("corrected_qty") or 0.0)
            original = float(saved.get("original_qty") or 0.0)
            billed_amount = float(bill.get("amount") or 0.0)
            unit_price = billed_amount / original if original > 0 else billed_amount
            bill["corrected_qty"] = corrected
            bill["unit_price"] = round(unit_price, 4)
            bill["amount"] = round(unit_price * corrected, 2)
            bill["updated_at"] = now().isoformat()
            await self.bills_service.bill_repository.save(bill)
            operations = await self.bills_service.get_monthly_operations(str(bill.get("period") or ""))
            saved["bill"] = bill
        saved["monthly_operations"] = operations
        return await self.adjustment_repository.save(saved)

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
        adjustment["rejected_at"] = now().isoformat()
        adjustment["updated_at"] = now().isoformat()
        return await self.adjustment_repository.save(adjustment)
