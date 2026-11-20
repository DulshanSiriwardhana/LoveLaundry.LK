from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..core.security import get_user_lookup
from .service import authenticate, issue_token

router = APIRouter(tags=["authentication"])

_finder = None


def set_user_finder(fn) -> None:
    global _finder
    _finder = fn


def get_user_finder():
    if _finder is None:
        return get_user_lookup
    return _finder


class LoginRequest(BaseModel):
    user_name: str
    password: str


_PUBLIC_USER_FIELDS = (
    "auth_id",
    "user_name",
    "status",
    "role_ids",
    "permissions",
    "organization_id",
    "laundry_id",
    "hotel_id",
    "shop_id",
)


def public_user(user: dict) -> dict:
    return {field: user[field] for field in _PUBLIC_USER_FIELDS if field in user}


@router.post("/auth/login")
async def login(payload: LoginRequest, finder=Depends(get_user_finder)) -> dict:
    user = await authenticate(payload.user_name, payload.password, finder)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return {"access_token": issue_token(user), "token_type": "bearer", "user": public_user(user)}
