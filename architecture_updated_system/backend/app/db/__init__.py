"""Database layer: role connection manager + memory adapter for tests."""
from .connection import (
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
]
