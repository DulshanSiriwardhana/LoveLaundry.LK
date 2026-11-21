from ..db.connection import DatabaseKind, get_database


def _clean(document: dict | None) -> dict | None:
    if document is None:
        return None
    result = dict(document)
    result.pop("_id", None)
    return result


def _org_query(organizations) -> dict:
    if not organizations:
        return {}
    if isinstance(organizations, (list, tuple, set)):
        return {"organization_id": {"$in": list(organizations)}}
    return {"organization_id": organizations}


class MongoBillRepository:
    def __init__(self) -> None:
        self.collection = get_database(DatabaseKind.LAUNDRY_INTERNAL).bills

    async def find(self, bill_id: str, organizations=None) -> dict | None:
        return _clean(
            await self.collection.find_one({"bill_id": bill_id, **_org_query(organizations)})
        )

    async def save(self, bill: dict) -> dict:
        document = dict(bill)
        document.setdefault("created_at", document.get("updated_at"))
        await self.collection.replace_one(
            {"bill_id": document.get("bill_id")}, document, upsert=True
        )
        return _clean(document)

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        cursor = self.collection.find({"period": period, **_org_query(organizations)})
        return [_clean(row) for row in await cursor.to_list(length=None)]

    async def find_by_gate_pass(self, gate_pass_id: str, organizations=None) -> dict | None:
        return _clean(
            await self.collection.find_one(
                {"gate_pass_id": gate_pass_id, **_org_query(organizations)}
            )
        )


class MongoInvoiceRepository:
    def __init__(self) -> None:
        self.collection = get_database(DatabaseKind.LAUNDRY_INTERNAL).invoices

    async def find(self, invoice_id: str, organizations=None) -> dict | None:
        return _clean(
            await self.collection.find_one(
                {"invoice_id": invoice_id, **_org_query(organizations)}
            )
        )

    async def save(self, invoice: dict) -> dict:
        document = dict(invoice)
        document.setdefault("created_at", document.get("updated_at"))
        await self.collection.replace_one(
            {"invoice_id": document.get("invoice_id")}, document, upsert=True
        )
        return _clean(document)

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        cursor = self.collection.find({"period": period, **_org_query(organizations)})
        return [_clean(row) for row in await cursor.to_list(length=None)]


class MongoMovementRepository:
    def __init__(self) -> None:
        self.collection = get_database(DatabaseKind.LINEN_TRACKING).movements

    async def save(self, movement: dict) -> dict:
        document = dict(movement)
        document.setdefault("created_at", document.get("updated_at"))
        await self.collection.replace_one(
            {"movement_id": document.get("movement_id")}, document, upsert=True
        )
        return _clean(document)

    async def list_by_period(self, period: str, organizations=None) -> list[dict]:
        cursor = self.collection.find({"period": period, **_org_query(organizations)})
        return [_clean(row) for row in await cursor.to_list(length=None)]


class MongoAdjustmentRepository:
    def __init__(self) -> None:
        self.collection = get_database(DatabaseKind.CENTRAL_SYSTEM).adjustments

    async def save(self, adjustment: dict) -> dict:
        document = dict(adjustment)
        document.setdefault("created_at", document.get("updated_at"))
        await self.collection.replace_one(
            {"id": document.get("id")}, document, upsert=True
        )
        return _clean(document)

    async def find(self, adjustment_id: str, organizations=None) -> dict | None:
        return _clean(
            await self.collection.find_one(
                {"id": adjustment_id, **_org_query(organizations)}
            )
        )

    async def list(
        self,
        status: str | None = None,
        gate_pass_id: str | None = None,
        organizations=None,
    ) -> list[dict]:
        query = dict(_org_query(organizations))
        if status:
            query["status"] = status
        if gate_pass_id:
            query["gate_pass_id"] = gate_pass_id
        cursor = self.collection.find(query)
        return [_clean(row) for row in await cursor.to_list(length=None)]
