"""Three-database connection layer for bill_service."""
from ._proxy import bind_role, reset
from .connection_manager import (
    ROLE_LOCAL,
    ROLE_MAIN,
    ROLE_SECONDARY,
    close_all,
    get_client,
    get_database,
    ping,
)

__all__ = [
    "ROLE_MAIN",
    "ROLE_SECONDARY",
    "ROLE_LOCAL",
    "get_client",
    "get_database",
    "ping",
    "close_all",
    "bind_role",
    "reset",
]
