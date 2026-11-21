"""Storage boundary for hybrid identity records.

One linen item owns exactly one permanent linen_id. QR identifiers and RFID
EPCs are replaceable identifiers that always resolve back to that item.
"""

from __future__ import annotations

from ..events.models import utc_now


class IdentityRepository:
    async def next_sequence(self, name: str) -> int:
        raise NotImplementedError

    async def get_item(self, linen_id: str) -> dict | None:
        raise NotImplementedError

    async def find_by_qr(self, qr_id: str) -> dict | None:
        raise NotImplementedError

    async def find_by_epc(self, epc: str) -> dict | None:
        raise NotImplementedError

    async def find_by_tag_serial(self, serial: str) -> dict | None:
        raise NotImplementedError

    async def save_item(self, item: dict) -> dict:
        raise NotImplementedError

    async def list_items(
        self,
        organization_id: str | None = None,
        batch_id: str | None = None,
        status: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        raise NotImplementedError

    async def save_batch(self, batch: dict) -> dict:
        raise NotImplementedError

    async def get_batch(self, batch_id: str) -> dict | None:
        raise NotImplementedError

    async def list_batches(self, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_manufacturer(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_manufacturers(self, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_supplier(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_suppliers(self, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_model(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_models(self, manufacturer_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_assignment(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_assignments(self, linen_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_replacement(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_replacements(self, linen_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_inspection(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_inspections(self, linen_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_failure_report(self, row: dict) -> dict:
        raise NotImplementedError

    async def list_failure_reports(self, linen_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_import(self, row: dict) -> dict:
        raise NotImplementedError

    async def get_import(self, import_id: str) -> dict | None:
        raise NotImplementedError

    async def list_imports(self, batch_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError


def _matches(row: dict, **filters) -> bool:
    for key, value in filters.items():
        if value is not None and row.get(key) != value:
            return False
    return True


class InMemoryIdentityRepository(IdentityRepository):
    def __init__(self) -> None:
        self.counters: dict[str, int] = {}
        self.items: dict[str, dict] = {}
        self.batches: dict[str, dict] = {}
        self.manufacturers: dict[str, dict] = {}
        self.suppliers: dict[str, dict] = {}
        self.models: dict[str, dict] = {}
        self.assignments: list[dict] = []
        self.replacements: list[dict] = []
        self.inspections: list[dict] = []
        self.failure_reports: list[dict] = []
        self.imports: dict[str, dict] = {}

    async def next_sequence(self, name: str) -> int:
        self.counters[name] = self.counters.get(name, 0) + 1
        return self.counters[name]

    async def get_item(self, linen_id: str) -> dict | None:
        row = self.items.get(linen_id)
        return dict(row) if row is not None else None

    async def find_by_qr(self, qr_id: str) -> dict | None:
        return next(
            (dict(row) for row in self.items.values() if row.get("qr_id") == qr_id), None
        )

    async def find_by_epc(self, epc: str) -> dict | None:
        return next(
            (dict(row) for row in self.items.values() if row.get("epc") == epc), None
        )

    async def find_by_tag_serial(self, serial: str) -> dict | None:
        return next(
            (dict(row) for row in self.items.values() if row.get("tag_serial") == serial),
            None,
        )

    async def save_item(self, item: dict) -> dict:
        document = dict(item)
        document["updated_at"] = document.get("updated_at") or utc_now()
        self.items[document["linen_id"]] = document
        return dict(document)

    async def list_items(self, organization_id=None, batch_id=None, status=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.items.values()
            if _matches(
                row,
                organization_id=organization_id,
                batch_id=batch_id,
                status=status,
            )
        ]
        return rows[:limit]

    async def save_batch(self, batch: dict) -> dict:
        self.batches[batch["batch_id"]] = dict(batch)
        return dict(batch)

    async def get_batch(self, batch_id: str) -> dict | None:
        row = self.batches.get(batch_id)
        return dict(row) if row is not None else None

    async def list_batches(self, limit=200) -> list[dict]:
        return [dict(row) for row in self.batches.values()][:limit]

    async def save_manufacturer(self, row: dict) -> dict:
        self.manufacturers[row["manufacturer_id"]] = dict(row)
        return dict(row)

    async def list_manufacturers(self, limit=200) -> list[dict]:
        return [dict(row) for row in self.manufacturers.values()][:limit]

    async def save_supplier(self, row: dict) -> dict:
        self.suppliers[row["supplier_id"]] = dict(row)
        return dict(row)

    async def list_suppliers(self, limit=200) -> list[dict]:
        return [dict(row) for row in self.suppliers.values()][:limit]

    async def save_model(self, row: dict) -> dict:
        self.models[row["model_id"]] = dict(row)
        return dict(row)

    async def list_models(self, manufacturer_id=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.models.values()
            if manufacturer_id is None or row.get("manufacturer_id") == manufacturer_id
        ]
        return rows[:limit]

    async def save_assignment(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        self.assignments.append(document)
        return dict(document)

    async def list_assignments(self, linen_id: str, limit=200) -> list[dict]:
        rows = [dict(row) for row in self.assignments if row.get("linen_id") == linen_id]
        return list(reversed(rows))[:limit]

    async def save_replacement(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        self.replacements.append(document)
        return dict(document)

    async def list_replacements(self, linen_id: str, limit=200) -> list[dict]:
        rows = [dict(row) for row in self.replacements if row.get("linen_id") == linen_id]
        return list(reversed(rows))[:limit]

    async def save_inspection(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        self.inspections.append(document)
        return dict(document)

    async def list_inspections(self, linen_id: str, limit=200) -> list[dict]:
        rows = [dict(row) for row in self.inspections if row.get("linen_id") == linen_id]
        return list(reversed(rows))[:limit]

    async def save_failure_report(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("reported_at", utc_now())
        self.failure_reports.append(document)
        return dict(document)

    async def list_failure_reports(self, linen_id: str, limit=200) -> list[dict]:
        rows = [dict(row) for row in self.failure_reports if row.get("linen_id") == linen_id]
        return list(reversed(rows))[:limit]

    async def save_import(self, row: dict) -> dict:
        self.imports[row["import_id"]] = dict(row)
        return dict(row)

    async def get_import(self, import_id: str) -> dict | None:
        row = self.imports.get(import_id)
        return dict(row) if row is not None else None

    async def list_imports(self, batch_id=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.imports.values()
            if batch_id is None or row.get("batch_id") == batch_id
        ]
        return rows[:limit]


class MongoIdentityRepository(IdentityRepository):
    """Identity records in linen_tracking; procurement records in central_system."""

    def __init__(self, linen_database, central_database=None) -> None:
        procurement = central_database if central_database is not None else linen_database
        self.counters = linen_database["identity_counters"]
        self.items = linen_database["linen_identifiers"]
        self.assignments = linen_database["tag_assignments"]
        self.replacements = linen_database["tag_replacements"]
        self.inspections = linen_database["tag_inspections"]
        self.failure_reports = linen_database["tag_failure_reports"]
        self.batches = procurement["tag_batches"]
        self.manufacturers = procurement["tag_manufacturers"]
        self.suppliers = procurement["tag_suppliers"]
        self.models = procurement["tag_models"]
        self.imports = procurement["tag_imports"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def next_sequence(self, name: str) -> int:
        document = await self.counters.find_one_and_update(
            {"name": name},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=True,
        )
        return int(document.get("value") or 1)

    async def get_item(self, linen_id: str) -> dict | None:
        return self._clean(await self.items.find_one({"linen_id": linen_id}))

    async def find_by_qr(self, qr_id: str) -> dict | None:
        return self._clean(await self.items.find_one({"qr_id": qr_id}))

    async def find_by_epc(self, epc: str) -> dict | None:
        return self._clean(await self.items.find_one({"epc": epc}))

    async def find_by_tag_serial(self, serial: str) -> dict | None:
        return self._clean(await self.items.find_one({"tag_serial": serial}))

    async def save_item(self, item: dict) -> dict:
        document = dict(item)
        document["updated_at"] = document.get("updated_at") or utc_now()
        await self.items.replace_one({"linen_id": document["linen_id"]}, document, upsert=True)
        return self._clean(document) or document

    async def list_items(self, organization_id=None, batch_id=None, status=None, limit=200) -> list[dict]:
        query = {
            key: value
            for key, value in {
                "organization_id": organization_id,
                "batch_id": batch_id,
                "status": status,
            }.items()
            if value is not None
        }
        cursor = self.items.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_batch(self, batch: dict) -> dict:
        await self.batches.replace_one({"batch_id": batch["batch_id"]}, dict(batch), upsert=True)
        return dict(batch)

    async def get_batch(self, batch_id: str) -> dict | None:
        return self._clean(await self.batches.find_one({"batch_id": batch_id}))

    async def list_batches(self, limit=200) -> list[dict]:
        cursor = self.batches.find({}).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_manufacturer(self, row: dict) -> dict:
        await self.manufacturers.replace_one(
            {"manufacturer_id": row["manufacturer_id"]}, dict(row), upsert=True
        )
        return dict(row)

    async def list_manufacturers(self, limit=200) -> list[dict]:
        cursor = self.manufacturers.find({}).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_supplier(self, row: dict) -> dict:
        await self.suppliers.replace_one({"supplier_id": row["supplier_id"]}, dict(row), upsert=True)
        return dict(row)

    async def list_suppliers(self, limit=200) -> list[dict]:
        cursor = self.suppliers.find({}).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_model(self, row: dict) -> dict:
        await self.models.replace_one({"model_id": row["model_id"]}, dict(row), upsert=True)
        return dict(row)

    async def list_models(self, manufacturer_id=None, limit=200) -> list[dict]:
        query = {"manufacturer_id": manufacturer_id} if manufacturer_id else {}
        cursor = self.models.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_assignment(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        await self.assignments.insert_one(document)
        return self._clean(document) or document

    async def list_assignments(self, linen_id: str, limit=200) -> list[dict]:
        cursor = self.assignments.find({"linen_id": linen_id}).sort("occurred_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_replacement(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        await self.replacements.insert_one(document)
        return self._clean(document) or document

    async def list_replacements(self, linen_id: str, limit=200) -> list[dict]:
        cursor = self.replacements.find({"linen_id": linen_id}).sort("occurred_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_inspection(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("occurred_at", utc_now())
        await self.inspections.insert_one(document)
        return self._clean(document) or document

    async def list_inspections(self, linen_id: str, limit=200) -> list[dict]:
        cursor = self.inspections.find({"linen_id": linen_id}).sort("occurred_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_failure_report(self, row: dict) -> dict:
        document = dict(row)
        document.setdefault("reported_at", utc_now())
        await self.failure_reports.insert_one(document)
        return self._clean(document) or document

    async def list_failure_reports(self, linen_id: str, limit=200) -> list[dict]:
        cursor = self.failure_reports.find({"linen_id": linen_id}).sort("reported_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_import(self, row: dict) -> dict:
        await self.imports.replace_one({"import_id": row["import_id"]}, dict(row), upsert=True)
        return dict(row)

    async def get_import(self, import_id: str) -> dict | None:
        return self._clean(await self.imports.find_one({"import_id": import_id}))

    async def list_imports(self, batch_id=None, limit=200) -> list[dict]:
        query = {"batch_id": batch_id} if batch_id else {}
        cursor = self.imports.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]
