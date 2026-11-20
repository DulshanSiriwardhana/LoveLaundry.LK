import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from apply_schema import apply_schema

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schema" / "linen_tracking.json"


async def apply() -> None:
    client = AsyncIOMotorClient(
        os.getenv("MONGODB_LINEN_URI", "mongodb://127.0.0.1:27017")
    )
    try:
        database = client[os.getenv("MONGODB_LINEN_DB", "linen_tracking")]
        await apply_schema(database, SCHEMA_PATH)
    finally:
        client.close()
