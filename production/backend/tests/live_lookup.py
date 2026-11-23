"""Shared live-user projection for authenticated test clients.

Fail-closed authentication requires a user record for every signed token.
Tests register the claims they sign here so the lookup mirrors the token subject.
"""

_USERS: dict[str, dict] = {}


def register(claims: dict) -> str:
    auth_id = str(
        claims.get("auth_id") or claims.get("sub") or claims.get("user_id") or ""
    )
    _USERS[auth_id] = dict(claims)
    return auth_id


def clear() -> None:
    _USERS.clear()


async def lookup(auth_id: str) -> dict | None:
    return _USERS.get(auth_id)
