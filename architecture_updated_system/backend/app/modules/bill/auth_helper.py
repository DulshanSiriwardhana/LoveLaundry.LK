"""Bill-service authentication / authorization (legacy capability parity).

Reuses the shared JWT + live-revocation dependency from :mod:`app.core.security`
and adds the bill-service capability map. STAFF is intentionally narrow (no bill
writing, no loyalty writing, no linen writing) — a compromised shop token must
not be able to invoice or adjust loyalty.
"""
from __future__ import annotations

from fastapi import HTTPException, Security, status

from ...core.security import (  # noqa: F401
    create_access_token,
    get_current_user,
    security,
    verify_token,
)

JWT_ALGORITHM = "HS256"

ROLE_CAPABILITIES = {
    "ADMIN": [
        "gatepass:read", "gatepass:write",
        "delivery:read", "delivery:write",
        "dispatch:read", "dispatch:write",
        "loyalty:read", "loyalty:write",
        "bill:read", "bill:write",
        "payment:read", "payment:write",
        "dashboard:read", "report:read",
        "linen:read", "linen:write", "linen:scan",
    ],
    "MANAGER": [
        "gatepass:read", "gatepass:write",
        "delivery:read", "delivery:write",
        "dispatch:read", "dispatch:write",
        "loyalty:read", "loyalty:write",
        "bill:read", "bill:write",
        "payment:read", "payment:write",
        "dashboard:read", "report:read",
        "linen:read", "linen:write", "linen:scan",
    ],
    "STAFF": [
        "gatepass:read", "gatepass:write",
        "delivery:read", "delivery:write",
        "dispatch:read", "dispatch:write",
        "loyalty:read",
        "bill:read",
        "dashboard:read", "report:read",
        "linen:read", "linen:scan",
    ],
}


def require_role(allowed_roles: list):
    """FastAPI dependency factory validating the caller's role."""

    def dependency(current_user: dict = Security(get_current_user)):
        role = str(current_user.get("role") or "").upper()
        allowed_upper = [r.upper() for r in allowed_roles]
        if role not in allowed_upper:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized to access this resource",
            )
        return current_user

    return dependency


def require_capability(capability: str):
    """FastAPI dependency validating a fine-grained capability."""

    def dependency(current_user: dict = Security(get_current_user)):
        role = str(current_user.get("role") or "").upper()
        capabilities = ROLE_CAPABILITIES.get(role, [])
        if capability not in capabilities:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not authorized to perform this action (missing {capability})",
            )
        return current_user

    return dependency
