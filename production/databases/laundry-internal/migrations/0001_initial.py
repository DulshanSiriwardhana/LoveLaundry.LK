import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from apply_schema import apply_schema, schema_checksum

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "laundry_internal.json"
VERSION = "laundry_internal:0001_initial"


def checksum() -> str:
    return schema_checksum(SCHEMA_PATH)


async def apply(database=None) -> None:
    if database is None:
        client = AsyncIOMotorClient(
            os.getenv("MONGODB_LAUNDRY_URI", "mongodb://127.0.0.1:27017")
        )
        try:
            database = client[os.getenv("MONGODB_LAUNDRY_DB", "laundry_internal")]
            await apply_schema(database, SCHEMA_PATH)
        finally:
            client.close()
        return
    await apply_schema(database, SCHEMA_PATH)
