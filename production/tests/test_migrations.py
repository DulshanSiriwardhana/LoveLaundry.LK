import json
from pathlib import Path

import pytest
from mongomock_motor import AsyncMongoMockClient

from apply_schema import apply_schema
from run_migrations import DATABASES, rollback, run_all

DATABASES_ROOT = Path(__file__).resolve().parents[1] / "databases"

SCHEMAS = (
    DATABASES_ROOT / "central-system/schema/central_system.json",
    DATABASES_ROOT / "laundry-internal/schema/laundry_internal.json",
    DATABASES_ROOT / "linen-tracking/schema/linen_tracking.json",
)

RELIABILITY_SCHEMAS = (
    DATABASES_ROOT / "central-system/schema/0002_reliability.json",
    DATABASES_ROOT / "laundry-internal/schema/0002_reliability.json",
    DATABASES_ROOT / "linen-tracking/schema/0002_reliability.json",
)


class RecordingDatabase:
    def __init__(self, inner) -> None:
        self._inner = inner
        self.validators: dict = {}

    async def list_collection_names(self) -> list[str]:
        return await self._inner.list_collection_names()

    async def create_collection(self, name: str) -> None:
        await self._inner.create_collection(name)

    async def command(self, spec: dict) -> dict:
        if "collMod" in spec:
            self.validators[spec["collMod"]] = spec
            return {"ok": 1}
        return await self._inner.command(spec)

    def __getitem__(self, name: str):
        return self._inner[name]


@pytest.mark.asyncio
async def test_schema_application_creates_collections_indexes_and_strict_validators() -> None:
    for schema_path in SCHEMAS:
        database = RecordingDatabase(AsyncMongoMockClient()["test"])
        await apply_schema(database, schema_path)
        expected = json.loads(schema_path.read_text())["collections"]
        names = await database.list_collection_names()
        for collection in expected:
            name = collection["name"]
            assert name in names
            assert name in database.validators
            assert database.validators[name]["validationLevel"] == "strict"
            assert database.validators[name]["validationAction"] == "error"
            indexes = await database[name].index_information()
            for index in collection.get("indexes", []):
                assert index["name"] in indexes


@pytest.mark.asyncio
async def test_reliability_schemas_add_event_lifecycle_and_billing_collections() -> None:
    expected_names = (
        {"outbox_events", "processed_events", "dead_letters", "reconciliation_runs"},
        {"rate_cards", "billing_runs", "billing_transactions", "invoice_lines"},
        {"linen_profiles", "scan_events", "manifests", "missing_alerts"},
    )
    for schema_path, required in zip(RELIABILITY_SCHEMAS, expected_names):
        database = RecordingDatabase(AsyncMongoMockClient()["test"])
        await apply_schema(database, schema_path)
        names = set(await database.list_collection_names())
        assert required <= names


@pytest.mark.asyncio
async def test_migration_runner_is_versioned_idempotent_and_rollback_capable() -> None:
    databases = {
        name: RecordingDatabase(AsyncMongoMockClient()["test"]) for name in DATABASES
    }
    first = await run_all(databases=databases)
    assert all(len(versions) == 2 for versions in first.values())

    second = await run_all(databases=databases)
    assert all(not versions for versions in second.values())

    versions = {version for rows in first.values() for version in rows}
    assert "central_system:0002_reliability" in versions
    assert await rollback("central_system:0002_reliability", databases=databases)
    collections = set(await databases["central_system"].list_collection_names())
    assert "outbox_events" not in collections
    assert "users" in collections

    third = await run_all(databases=databases)
    assert "central_system:0002_reliability" in third["central_system"]
