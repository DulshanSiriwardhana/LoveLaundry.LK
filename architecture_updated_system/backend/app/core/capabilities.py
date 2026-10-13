"""Fine-grained capability authorization (legacy laundry-management parity).

Roles map to capability strings; endpoints declare the capability they need.
STAFF is intentionally narrow (no payroll/HR/expense/report access) — a single
compromised cashier token must not expose company-wide financials.
"""
from __future__ import annotations

from fastapi import HTTPException, Security, status

from .security import get_current_user

ROLE_CAPABILITIES: dict[str, list[str]] = {
    "ADMIN": [
        "management:read", "management:write",
        "customer:read", "customer:write",
        "item:read", "item:write",
        "transaction:read", "transaction:write",
        "expense:read", "expense:write",
        "employee:read", "employee:write",
        "salary:read", "salary:write",
        "payment:read", "payment:write",
        "report:read", "report:write", "dashboard:read", "import:write",
    ],
    "MANAGER": [
        "management:read", "management:write",
        "customer:read", "customer:write",
        "item:read", "item:write",
        "transaction:read", "transaction:write",
        "expense:read", "expense:write",
        "employee:read", "employee:write",
        "salary:read", "salary:write",
        "payment:read", "payment:write",
        "report:read", "report:write", "dashboard:read", "import:write",
    ],
    "STAFF": [
        "management:read",
        "customer:read", "customer:write",
        "item:read",
        "transaction:read", "transaction:write",
        "payment:read",
        "dashboard:read",
    ],
}


def require_capability(capability: str):
    """FastAPI dependency validating a fine-grained capability."""

    async def dependency(current_user: dict = Security(get_current_user)) -> dict:
        role = str(current_user.get("role") or "").upper()
        capabilities = ROLE_CAPABILITIES.get(role, [])
        if capability not in capabilities:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Role '{role}' is not authorized to perform this action "
                    f"(missing {capability})"
                ),
            )
        return current_user

    return dependency
