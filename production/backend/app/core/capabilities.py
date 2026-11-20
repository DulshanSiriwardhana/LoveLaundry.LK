from typing import Annotated

from fastapi import Depends, Security

from .security import get_current_user


def require_capability(permission: str):
    def dependency(user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if permission not in (user.get("permissions") or []):
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return dependency
