"""Auth/users HTTP routes (user-service parity)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from ...core.security import get_current_user, require_role
from .deps import get_auth_service
from .schemas import (
    LoginRequest,
    LoginResponse,
    PasswordUpdate,
    ProfileUpdate,
    StatusUpdate,
    UserCreate,
    UserPublic,
    UserUpdate,
)

router = APIRouter(tags=["auth"])

_ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]


@router.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, svc=Depends(get_auth_service)):
    token, user = await svc.login(payload.user_name, payload.password)
    return LoginResponse(access_token=token, user=UserPublic(**user))


@router.get("/auth/status")
async def auth_status(current: Annotated[dict, Depends(get_current_user)]):
    return {
        "authenticated": True,
        "auth_id": current.get("auth_id"),
        "role": current.get("role"),
        "user_name": current.get("user_name"),
        "status": current.get("status"),
    }


# NOTE: static paths are declared before the dynamic ``/users/{user_id}`` route.
@router.get("/users", response_model=list[UserPublic])
async def list_users(
    _: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return await svc.list_users(limit=limit, offset=offset)


@router.get("/users/count")
async def users_count(
    _: Annotated[dict, Depends(get_current_user)], svc=Depends(get_auth_service)
):
    return {"count": await svc.count()}


@router.get("/users/auth/{auth_id}", response_model=UserPublic)
async def user_by_auth_id(
    auth_id: str,
    _: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    return await svc.get_by_auth_id(auth_id)


@router.get("/users/email/{email}", response_model=UserPublic)
async def user_by_email(
    email: str,
    _: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    return await svc.get_by_email(email)


@router.get("/users/employee/{employee_id}", response_model=UserPublic)
async def user_by_employee(
    employee_id: str,
    _: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    return await svc.get_by_employee_id(employee_id)


@router.post("/users", response_model=UserPublic, status_code=201)
async def create_user(
    payload: UserCreate,
    _: Annotated[dict, Depends(require_role(_ADMIN_ROLES))],
    svc=Depends(get_auth_service),
):
    return await svc.create_user(payload.model_dump())


@router.get("/users/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: str,
    _: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    return await svc.get_user(user_id)


@router.put("/users/{user_id}", response_model=UserPublic)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    _: Annotated[dict, Depends(require_role(_ADMIN_ROLES))],
    svc=Depends(get_auth_service),
):
    return await svc.update_user(user_id, payload.model_dump())


@router.patch("/users/{user_id}/profile", response_model=UserPublic)
async def update_profile(
    user_id: str,
    payload: ProfileUpdate,
    current: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    # A user may edit their own profile; admins may edit anyone's.
    if str(current.get("sub")) != str(user_id) and str(
        current.get("role") or ""
    ).upper() not in _ADMIN_ROLES:
        from fastapi import HTTPException, status

        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to edit this profile")
    return await svc.update_profile(user_id, payload.model_dump())


@router.patch("/users/{user_id}/password")
async def update_password(
    user_id: str,
    payload: PasswordUpdate,
    current: Annotated[dict, Depends(get_current_user)],
    svc=Depends(get_auth_service),
):
    if str(current.get("sub")) != str(user_id) and str(
        current.get("role") or ""
    ).upper() not in _ADMIN_ROLES:
        from fastapi import HTTPException, status

        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed to change this password")
    return await svc.change_password(user_id, payload.password)


@router.patch("/users/{user_id}/status", response_model=UserPublic)
async def update_status(
    user_id: str,
    payload: StatusUpdate,
    _: Annotated[dict, Depends(require_role(_ADMIN_ROLES))],
    svc=Depends(get_auth_service),
):
    return await svc.set_status(user_id, payload.status)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    _: Annotated[dict, Depends(require_role(_ADMIN_ROLES))],
    svc=Depends(get_auth_service),
):
    return await svc.delete_user(user_id)
