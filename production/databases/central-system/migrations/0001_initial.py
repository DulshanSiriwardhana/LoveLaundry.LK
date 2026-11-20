import os

from motor.motor_asyncio import AsyncIOMotorClient


async def apply() -> None:
    client = AsyncIOMotorClient(os.getenv("MONGODB_CENTRAL_URI", "mongodb://127.0.0.1:27017"))
    database = client[os.getenv("MONGODB_CENTRAL_DB", "central_system")]
    names = await database.list_collection_names()
    for name in (
        "users",
        "roles",
        "permissions",
        "organizations",
        "memberships",
        "devices",
        "sessions",
        "security_logs",
        "audit_logs",
        "system_configs",
    ):
        if name not in names:
            await database.create_collection(name)
    await database["system_configs"].create_index("config_key", unique=True)
    await database["sessions"].create_index("token_jti", unique=True)
