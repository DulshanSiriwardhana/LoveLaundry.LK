"""Billing evidence derived only from validated operational scan transactions."""

from __future__ import annotations

from pymongo.errors import DuplicateKeyError

from ..events.models import utc_now

BILLABLE_ACTIONS = {
    "receive_at_laundry": "laundry_receiving",
    "sort": "sorting",
    "complete_washing": "washing",
    "mark_ready": "quality_inspection",
    "dispatch_from_laundry": "dispatch",
    "receive_at_client": "hotel_receiving",
}


class BillableEventRepository:
    async def save(self, row: dict) -> bool:
        raise NotImplementedError

    async def list(
        self, organization_id: str, hotel_id: str | None = None, limit: int = 5000
    ) -> list[dict]:
        raise NotImplementedError

    async def mark_billed(self, verification_ids: list[str], invoice_id: str) -> None:
        raise NotImplementedError


class InMemoryBillableEventRepository(BillableEventRepository):
    def __init__(self) -> None:
        self.events: dict[str, dict] = {}

    async def save(self, row: dict) -> bool:
        if row["verification_id"] in self.events:
            return False
        self.events[row["verification_id"]] = dict(row)
        return True

    async def list(self, organization_id, hotel_id=None, limit=5000) -> list[dict]:
        return [
            dict(row)
            for row in self.events.values()
            if row.get("organization_id") == organization_id
            and (hotel_id is None or row.get("hotel_id") == hotel_id)
        ][:limit]

    async def mark_billed(self, verification_ids, invoice_id):
        for verification_id in verification_ids:
            row = self.events.get(verification_id)
            if row is not None:
                row["billed"] = True
                row["invoice_id"] = invoice_id


class MongoBillableEventRepository(BillableEventRepository):
    def __init__(self, database) -> None:
        self.collection = database["billable_service_events"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def save(self, row: dict) -> bool:
        try:
            await self.collection.insert_one(dict(row))
            return True
        except DuplicateKeyError:
            return False

    async def list(self, organization_id, hotel_id=None, limit=5000) -> list[dict]:
        query = {"organization_id": organization_id}
        if hotel_id:
            query["hotel_id"] = hotel_id
        cursor = self.collection.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def mark_billed(self, verification_ids, invoice_id):
        if not verification_ids:
            return
        await self.collection.update_many(
            {"verification_id": {"$in": verification_ids}},
            {"$set": {"billed": True, "invoice_id": invoice_id}},
        )


class BillingVerificationService:
    def __init__(self, events: BillableEventRepository, billing_repository) -> None:
        self.events = events
        self.billing_repository = billing_repository

    async def record_from_validated_scan(
        self,
        *,
        scan: dict,
        item: dict,
        payload: dict,
        principal: dict,
    ) -> dict | None:
        """Create billable evidence after a scan has passed the lifecycle engine."""

        action = str(scan.get("action") or "").strip().lower()
        service = BILLABLE_ACTIONS.get(action)
        if not service or scan.get("result") != "accepted":
            return None
        verification_id = f"VE-{scan['scan_id']}"
        organization_id = str(item.get("organization_id") or "")
        hotel_id = str(
            payload.get("to_organization_id")
            or item.get("owner_organization_id")
            or item.get("organization_id")
            or ""
        )
        occurred_at = str(scan.get("occurred_at") or utc_now())
        event = {
            "verification_id": verification_id,
            "organization_id": organization_id,
            "hotel_id": hotel_id,
            "linen_id": str(item.get("linen_id") or ""),
            "service": service,
            "quantity": 1,
            "occurred_at": occurred_at,
            "validated": True,
            "transaction_id": verification_id,
            "scan_id": str(scan.get("scan_id") or ""),
            "session_id": str(scan.get("session_id") or ""),
            "stage": str(scan.get("stage") or ""),
            "source": f"validated-scan:{scan.get('method', 'unknown')}",
            "invoice_id": "",
            "billed": False,
            "created_at": utc_now(),
        }
        saved = await self.events.save(event)
        if saved:
            await self.billing_repository.record_validated_transaction(
                {
                    "transaction_id": verification_id,
                    "organization_id": organization_id,
                    "hotel_id": hotel_id,
                    "service": service,
                    "quantity": 1,
                    "occurred_at": occurred_at,
                    "source": event["source"],
                    "linen_category": str(item.get("category") or ""),
                    "billed_invoice_id": "",
                }
            )
        return event

    async def list_events(
        self, principal: dict, organization_id: str, hotel_id: str | None = None, limit: int = 5000
    ) -> list[dict]:
        from ..core.principal import assert_organization_access

        assert_organization_access(principal, organization_id)
        return await self.events.list(organization_id, hotel_id, min(limit, 5000))
