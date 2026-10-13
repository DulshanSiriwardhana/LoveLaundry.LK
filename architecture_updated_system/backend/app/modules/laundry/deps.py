"""Dependency wiring for the laundry module."""
from __future__ import annotations

from fastapi import Request

from .repository import LaundryRepository


def get_laundry_repo(request: Request) -> LaundryRepository:
    return request.app.state.laundry_repo
