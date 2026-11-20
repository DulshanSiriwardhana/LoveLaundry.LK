import json
from pathlib import Path


async def apply_schema(database, schema_path: str | Path) -> None:
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
                    "validationLevel": "moderate",
                    "validationAction": "warn",
                }
            )
        for index in collection.get("indexes", []):
            await database[name].create_index(
                list(index["keys"].items()),
                name=index["name"],
                unique=bool(index.get("unique", False)),
            )
