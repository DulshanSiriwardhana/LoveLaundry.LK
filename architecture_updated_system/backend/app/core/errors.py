"""Exception handling.

HTTP errors keep FastAPI's legacy ``{"detail": ...}`` shape so existing clients
(``quotations-ui``, ``skaner``, the public storefront) parse responses
unchanged. A structured ``{"error": {...}}`` envelope is reserved for internal
``AppError`` domain failures.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Domain error raised by services; mapped to a JSON envelope."""

    def __init__(self, status_code: int, code: str, message: str, details=None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def _envelope(code: str, message: str, details=None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        # Legacy FastAPI shape: {"detail": <message>}
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        # Legacy FastAPI shape: {"detail": [<errors>]}
        return JSONResponse(status_code=422, content={"detail": exc.errors()})
