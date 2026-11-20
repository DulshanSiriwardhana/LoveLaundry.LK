from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from .service import authenticate, issue_token

router = APIRouter(tags=["authentication"])

_finder = None


def set_user_finder(fn) -> None:
    global _finder
    _finder = fn


def get_user_finder():
    if _finder is None:
        raise RuntimeError("User finder is not configured")
    return _finder


class LoginRequest(BaseModel):
    user_name: str
    password: str


@router.post("/auth/login")
async def login(payload: LoginRequest, finder=Depends(get_user_finder)) -> dict:
    user = await authenticate(payload.user_name, payload.password, finder)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user}
