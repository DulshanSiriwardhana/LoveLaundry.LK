"""Versioned migration bookkeeping for the three production databases.

Each database owns its own history so a failed migration cannot make sibling
databases appear current. Records are append-only except for rollback, which
removes the exact version it reverses.
"""

from __future__ import annotations

from datetime import datetime, timezone

HISTORY_COLLECTION = "schema_migrations"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def applied_versions(database) -> set[str]:
    cursor = database[HISTORY_COLLECTION].find({}, {"version": 1})
    return {str(row.get("version")) for row in await cursor.to_list(length=None)}


async def record_applied(database, version: str, checksum: str, module: str) -> None:
    await database[HISTORY_COLLECTION].update_one(
        {"version": version},
        {
            "$set": {
                "version": version,
                "checksum": checksum,
                "module": module,
                "applied_at": utc_now(),
            }
        },
        upsert=True,
    )


async def record_rolled_back(database, version: str) -> None:
    await database[HISTORY_COLLECTION].delete_one({"version": version})
