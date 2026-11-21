"""Versioned, idempotent migration runner for the three production databases.

Usage:
    python databases/run_migrations.py
    python databases/run_migrations.py rollback central_system:0002_reliability

The runner keeps one append-only history collection per database. A migration
is applied once and recorded only after its `apply()` completes successfully.
"""

from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

from migration_history import applied_versions, record_applied, record_rolled_back

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

DATABASES = {
    "central_system": {
        "directory": "central-system/migrations",
        "uri_env": "MONGODB_CENTRAL_URI",
        "db_env": "MONGODB_CENTRAL_DB",
        "default_db": "central_system",
    },
    "laundry_internal": {
        "directory": "laundry-internal/migrations",
        "uri_env": "MONGODB_LAUNDRY_URI",
        "db_env": "MONGODB_LAUNDRY_DB",
        "default_db": "laundry_internal",
    },
    "linen_tracking": {
        "directory": "linen-tracking/migrations",
        "uri_env": "MONGODB_LINEN_URI",
        "db_env": "MONGODB_LINEN_DB",
        "default_db": "linen_tracking",
    },
}


def _load(path: Path):
    name = "ll_migration_" + "_".join(path.parts[-3:]).replace("-", "_").removesuffix(".py")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _migration_files(database: str) -> list[Path]:
    config = DATABASES[database]
    return sorted((_ROOT / config["directory"]).glob("*.py"))


async def run_all(databases: dict[str, object] | None = None) -> dict[str, list[str]]:
    """Apply all pending migrations.

    `databases` is an optional mapping of logical database name to an async
    database object. Tests inject mongomock databases; production uses Motor.
    """

    opened_clients: list[AsyncIOMotorClient] = []
    results: dict[str, list[str]] = {}
    for name in DATABASES:
        applied: list[str] = []
        database = (databases or {}).get(name)
        if database is None:
            config = DATABASES[name]
            client = AsyncIOMotorClient(
                os.getenv(config["uri_env"], "mongodb://127.0.0.1:27017"),
                serverSelectionTimeoutMS=5000,
            )
            opened_clients.append(client)
            database = client[os.getenv(config["db_env"], config["default_db"])]
        versions = await applied_versions(database)
        for path in _migration_files(name):
            module = _load(path)
            version = getattr(module, "VERSION", f"{name}:{path.stem}")
            if version in versions:
                continue
            await module.apply(database)
            checksum = getattr(module, "checksum", lambda: "")()
            await record_applied(database, version, checksum, path.name)
            applied.append(version)
            versions.add(version)
        results[name] = applied
    for client in opened_clients:
        client.close()
    return results


async def rollback(version: str, databases: dict[str, object] | None = None) -> bool:
    for name in DATABASES:
        database = (databases or {}).get(name)
        if database is None:
            continue
        versions = await applied_versions(database)
        if version not in versions:
            continue
        for path in reversed(_migration_files(name)):
            module = _load(path)
            if getattr(module, "VERSION", f"{name}:{path.stem}") != version:
                continue
            down = getattr(module, "down", None)
            if down is not None:
                await down(database)
            await record_rolled_back(database, version)
            return True
    return False


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", nargs="?", choices=["apply", "rollback"], default="apply")
    parser.add_argument("version", nargs="?")
    args = parser.parse_args()
    if args.command == "rollback":
        if not args.version:
            parser.error("rollback requires a version identifier")
        ok = asyncio.run(rollback(args.version))
        if not ok:
            raise SystemExit(f"Migration version not applied: {args.version}")
        return
    applied = asyncio.run(run_all())
    for name, versions in applied.items():
        print(f"{name}: {', '.join(versions) if versions else 'up to date'}")


if __name__ == "__main__":
    main()
