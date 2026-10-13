"""Dependency wiring for the quotation module."""
from __future__ import annotations

from fastapi import Request

from .chat_repository import ChatRepository
from .repository import QuotationRepository


def get_quotation_repo(request: Request) -> QuotationRepository:
    return request.app.state.quotation_repo


def get_chat_repo(request: Request) -> ChatRepository:
    return request.app.state.chat_repo
