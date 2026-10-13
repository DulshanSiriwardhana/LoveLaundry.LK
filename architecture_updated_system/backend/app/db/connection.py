"""Three-database role model: MAIN / SECONDARY / LOCAL.

Each role resolves its own ``(uri, db_name)``; business code selects a role
explicitly so it is impossible to read the wrong database by accident. Motor
clients are created lazily and cached. Importing this module touches no network.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from ..core.config import get_settings

if TYPE_CHECKING:  # pragma: no cover
    from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

ROLE_MAIN = "MAIN"
ROLE_SECONDARY = "SECONDARY"
ROLE_LOCAL = "LOCAL"
_ROLES = {ROLE_MAIN, ROLE_SECONDARY, ROLE_LOCAL}

_clients: dict = {}
_databases: dict = {}


def _resolve(role: str) -> tuple[str, str]:
    s = get_settings()
    if role == ROLE_MAIN:
        return s.resolve_main_uri(), s.resolve_main_db()
    if role == ROLE_SECONDARY:
        return s.resolve_secondary_uri(), s.resolve_secondary_db()
    if role == ROLE_LOCAL:
        return s.resolve_local_uri(), s.resolve_local_db()
    raise ValueError(f"Unknown database role: {role}")


def get_client(role: str) -> "AsyncIOMotorClient":
    from motor.motor_asyncio import AsyncIOMotorClient  # lazy import

    role = role.upper()
    if role not in _ROLES:
        raise ValueError(f"Unknown database role: {role}")
    if role not in _clients:
        uri, _ = _resolve(role)
        _clients[role] = AsyncIOMotorClient(
            uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000
        )
    return _clients[role]


def get_database(role: str) -> "AsyncIOMotorDatabase":
    from motor.motor_asyncio import AsyncIOMotorDatabase

    role = role.upper()
    if role not in _databases:
        _, name = _resolve(role)
        _databases[role] = AsyncIOMotorDatabase(get_client(role), name)
    return _databases[role]


async def ping(role: str) -> bool:
    import asyncio

    try:
        await asyncio.wait_for(get_client(role).admin.command("ping"), timeout=3.0)
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
