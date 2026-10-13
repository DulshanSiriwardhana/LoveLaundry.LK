"""Dependency wiring for the auth module.

The concrete ``UserRepository`` lives on ``app.state`` so tests can override it
with the in-memory adapter.
"""
from __future__ import annotations

from fastapi import Request

from .repository import UserRepository


def get_user_repo(request: Request) -> UserRepository:
    return request.app.state.user_repo


def get_auth_service(request: Request):
    from .service import AuthService

    return AuthService(get_user_repo(request))
