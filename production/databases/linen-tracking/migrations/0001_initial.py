import os

from motor.motor_asyncio import AsyncIOMotorClient


async def apply() -> None:
    client = AsyncIOMotorClient(os.getenv("MONGODB_LINEN_URI", "mongodb://127.0.0.1:27017"))
    database = client[os.getenv("MONGODB_LINEN_DB", "linen_tracking")]
    names = await database.list_collection_names()
    for name in ("linens", "movements", "scans", "allocations", "damages", "reconciliations"):
        if name not in names:
            await database.create_collection(name)
    await database["linens"].create_index(
        [("organization_id", 1), ("code", 1)], unique=True, name="org_code"
    )
    await database["scans"].create_index("linen_id", name="linen_scans")
