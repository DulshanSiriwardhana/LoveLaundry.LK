import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

_DATABASES_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_DATABASES_ROOT))

from apply_schema import apply_schema, schema_checksum  # noqa: E402

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "0002_reliability.json"
VERSION = "central_system:0002_reliability"


def checksum() -> str:
    return schema_checksum(SCHEMA_PATH)


async def apply(database=None) -> None:
    if database is None:
        client = AsyncIOMotorClient(
            os.getenv("MONGODB_CENTRAL_URI", "mongodb://127.0.0.1:27017")
        )
        try:
            database = client[os.getenv("MONGODB_CENTRAL_DB", "central_system")]
            await apply_schema(database, SCHEMA_PATH)
        finally:
            client.close()
        return
    await apply_schema(database, SCHEMA_PATH)


async def down(database=None) -> None:
    """Remove only collections introduced by this migration.

    This is a forward-system migration: it does not delete user data from the
    pre-existing collections, and it can be rerun safely with `apply`.
    """

    if database is None:
        return
    schema = __import__("json").loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    existing = set(await database.list_collection_names())
    for collection in schema["collections"]:
        if collection["name"] in existing:
            await database[collection["name"]].drop()
