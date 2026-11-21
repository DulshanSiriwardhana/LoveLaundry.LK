import hashlib
import json
from pathlib import Path


def schema_checksum(schema_path: str | Path) -> str:
    return hashlib.sha256(Path(schema_path).read_bytes()).hexdigest()


async def apply_schema(database, schema_path: str | Path) -> None:
    """Create collections, enforce validators, and create indexes.

    Validators are intentionally strict/error: a document that violates the
    declared contract must be rejected at the database boundary rather than
    logged as a warning that nobody reads.
    """

    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    existing = set(await database.list_collection_names())
    for collection in schema["collections"]:
        name = collection["name"]
        if name not in existing:
            await database.create_collection(name)
        validator = collection.get("validator")
        if validator is not None:
            await database.command(
                {
                    "collMod": name,
                    "validator": validator,
                    "validationLevel": collection.get("validationLevel", "strict"),
                    "validationAction": collection.get("validationAction", "error"),
                }
            )
        for index in collection.get("indexes", []):
            await database[name].create_index(
                list(index["keys"].items()),
                name=index["name"],
                unique=bool(index.get("unique", False)),
            )
