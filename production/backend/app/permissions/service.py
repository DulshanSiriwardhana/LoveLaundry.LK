from typing import Annotated

from fastapi import Depends, HTTPException, status

from ..core.security import get_current_user


def require_capability(permission: str):
    def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        granted = user.get("permissions") or []
        if "*" not in granted and permission not in granted:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return dependency
