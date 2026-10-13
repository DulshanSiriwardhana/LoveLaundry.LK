"""Dependency wiring for the worker module."""
from __future__ import annotations

from fastapi import Request

from .repository import WorkerRepository


def get_worker_repo(request: Request) -> WorkerRepository:
    return request.app.state.worker_repo
