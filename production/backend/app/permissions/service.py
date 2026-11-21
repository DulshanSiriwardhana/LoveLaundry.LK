from typing import Annotated

from fastapi import Depends, HTTPException, status

from ..core.principal import (
    assert_organization_access,
    granted_capabilities,
    is_platform_admin,
)
from ..core.security import get_current_user


def require_capability(permission: str):
    def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if permission not in granted_capabilities(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return dependency


def require_platform_admin(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if not is_platform_admin(user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Platform administrator access required")
    return user


def organization_dependency(capability: str, organization_arg: str = "organization_id"):
    """Return a FastAPI dependency that enforces capability plus org scope.

    The dependency reads query/path parameters from the request without
    trusting client-supplied organization IDs for authorization.
    """

    from fastapi import Request

    capability_dependency = require_capability(capability)

    async def dependency(
        request: Request, user: Annotated[dict, Depends(capability_dependency)]
    ) -> dict:
        candidate = (
            request.path_params.get(organization_arg)
            or request.query_params.get(organization_arg)
            or user.get("organization_id")
        )
        assert_organization_access(user, candidate)
        return user

    return dependency
