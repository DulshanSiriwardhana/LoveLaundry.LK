"""Generic, non-reflective error responses.

Validation details produced by Pydantic can echo the rejected input (tokens,
passwords, PII). Clients need the status code and a stable message, not a
reflection of what they sent.
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

INVALID_REQUEST_DETAIL = "Invalid request"
INTERNAL_ERROR_DETAIL = "Internal server error"


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": INVALID_REQUEST_DETAIL})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Logs, if any, are handled by the ASGI server; never return exception
        # text, stack traces, driver messages or connection strings to callers.
        return JSONResponse(status_code=500, content={"detail": INTERNAL_ERROR_DETAIL})
