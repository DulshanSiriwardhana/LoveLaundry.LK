import os

from motor.motor_asyncio import AsyncIOMotorClient


async def apply() -> None:
    client = AsyncIOMotorClient(os.getenv("MONGODB_LAUNDRY_URI", "mongodb://127.0.0.1:27017"))
    database = client[os.getenv("MONGODB_LAUNDRY_DB", "laundry_internal")]
    names = await database.list_collection_names()
    for name in (
        "customers",
        "items",
        "orders",
        "bills",
        "invoices",
        "payments",
        "employees",
        "payroll_records",
        "expenses",
    ):
        if name not in names:
            await database.create_collection(name)
    await database["bills"].create_index(
        [("organization_id", 1), ("status", 1)], name="org_status"
    )
    await database["invoices"].create_index("organization_id", name="org_invoices")
