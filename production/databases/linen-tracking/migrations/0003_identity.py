import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

_DATABASES_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_DATABASES_ROOT))

from apply_schema import apply_schema, schema_checksum  # noqa: E402

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "0003_identity.json"
VERSION = "linen_tracking:0003_identity"


def checksum() -> str:
    return schema_checksum(SCHEMA_PATH)


async def apply(database=None) -> None:
    if database is None:
        client = AsyncIOMotorClient(
            os.getenv("MONGODB_LINEN_URI", "mongodb://127.0.0.1:27017")
        )
        try:
            database = client[os.getenv("MONGODB_LINEN_DB", "linen_tracking")]
            await apply_schema(database, SCHEMA_PATH)
        finally:
            client.close()
        return
    await apply_schema(database, SCHEMA_PATH)


async def down(database=None) -> None:
    if database is None:
        return
    import json

    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    existing = set(await database.list_collection_names())
    for collection in schema["collections"]:
        if collection["name"] in existing:
            await database[collection["name"]].drop()
