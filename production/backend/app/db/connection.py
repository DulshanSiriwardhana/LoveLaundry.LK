from enum import Enum

from ..core.config import get_settings

KINDS = ("central_system", "laundry_internal", "linen_tracking")


class DatabaseKind(str, Enum):
    CENTRAL_SYSTEM = "central_system"
    LAUNDRY_INTERNAL = "laundry_internal"
    LINEN_TRACKING = "linen_tracking"


_clients: dict = {}
_databases: dict = {}


def _resolve(kind: DatabaseKind) -> tuple:
    settings = get_settings()
    if kind is DatabaseKind.CENTRAL_SYSTEM:
        return settings.central_system_uri, settings.central_system_db
    if kind is DatabaseKind.LAUNDRY_INTERNAL:
        return settings.laundry_internal_uri, settings.laundry_internal_db
    if kind is DatabaseKind.LINEN_TRACKING:
        return settings.linen_tracking_uri, settings.linen_tracking_db
    raise ValueError(f"Unknown database kind: {kind}")


def get_client(kind: DatabaseKind):
    key = str(kind)
    if key not in _clients:
        from motor.motor_asyncio import AsyncIOMotorClient

        uri, _ = _resolve(kind)
        _clients[key] = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    return _clients[key]


def get_database(kind: DatabaseKind):
    key = str(kind)
    if key not in _databases:
        from motor.motor_asyncio import AsyncIOMotorDatabase

        _, name = _resolve(kind)
        _databases[key] = AsyncIOMotorDatabase(get_client(kind), name)
    return _databases[key]


async def ping(kind: DatabaseKind) -> bool:
    try:
        database = get_database(kind)
        await database.client.admin.command("ping")
        return True
    except Exception:
        return False


def close_all() -> None:
    for client in _clients.values():
        try:
            client.close()
        except Exception:
            pass
    _clients.clear()
    _databases.clear()
