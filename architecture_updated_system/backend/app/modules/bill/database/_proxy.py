"""Swappable collection proxies for the three database roles.

The ported routers bind module-level collection objects at import time
(``from ..database.main_db import bills_collection``), exactly like the legacy
service. To keep that code verbatim *and* let tests inject an in-process
database, each "collection" is a proxy that forwards every attribute access to
its current target. Production leaves the target unset, so the first use lazily
resolves the real motor collection for the proxy's role. Tests call
:func:`bind_role` with a mongomock database and every already-imported reference
starts talking to it — no monkeypatching of individual module namespaces.
"""
from __future__ import annotations

from typing import Any

_ROLE_PROXIES: dict[str, list["CollectionProxy"]] = {}


class CollectionProxy:
    __slots__ = ("_role", "_name", "_target")

    def __init__(self, role: str, name: str) -> None:
        self._role = role
        self._name = name
        self._target: Any = None

    def bind(self, collection: Any) -> None:
        self._target = collection

    def _resolve(self) -> Any:
        if self._target is None:
            from .connection_manager import get_database

            self._target = get_database(self._role).get_collection(self._name)
        return self._target

    def __getattr__(self, item: str) -> Any:
        return getattr(self._resolve(), item)


def register(role: str, name: str) -> CollectionProxy:
    proxy = CollectionProxy(role, name)
    _ROLE_PROXIES.setdefault(role, []).append(proxy)
    return proxy


def bind_role(role: str, database: Any) -> None:
    """Point every collection proxy for ``role`` at ``database`` (a motor or
    mongomock database). Used by tests; production never calls it."""
    for proxy in _ROLE_PROXIES.get(role, []):
        proxy.bind(database.get_collection(proxy._name))


def reset() -> None:
    """Detach every proxy (tests)."""
    for proxies in _ROLE_PROXIES.values():
        for proxy in proxies:
            proxy.bind(None)
