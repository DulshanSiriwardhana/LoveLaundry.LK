from pathlib import Path

import pytest
from mongomock_motor import AsyncMongoMockClient

from apply_schema import apply_schema

DATABASES = Path(__file__).resolve().parents[1] / "databases"

SCHEMAS = (
    DATABASES / "central-system/schema/central_system.json",
    DATABASES / "laundry-internal/schema/laundry_internal.json",
    DATABASES / "linen-tracking/schema/linen_tracking.json",
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
        self.validators[spec["collMod"]] = spec
        return {"ok": 1}

    def __getitem__(self, name: str):
        return self._inner[name]


@pytest.mark.asyncio
async def test_schema_application_creates_collections_indexes_and_validators() -> None:
    for schema_path in SCHEMAS:
        database = RecordingDatabase(AsyncMongoMockClient()["test"])
        await apply_schema(database, schema_path)
        expected = __import__("json").loads(schema_path.read_text())["collections"]
        names = await database.list_collection_names()
        for collection in expected:
            name = collection["name"]
            assert name in names
            assert name in database.validators
            assert database.validators[name]["validationLevel"] == "moderate"
            assert database.validators[name]["validationAction"] == "warn"
            indexes = await database[name].index_information()
            for index in collection.get("indexes", []):
                assert index["name"] in indexes
