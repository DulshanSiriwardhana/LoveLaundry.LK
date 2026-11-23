"""Request-body size limit enforced before application routing.

The body is buffered up to the configured cap, then replayed to the app. This
rejects oversized and chunked requests without relying on a Content-Length
header, and without letting the exception escape through FastAPI's generic
error handler (which would turn a 413 into a 500).
"""

from __future__ import annotations

from fastapi.responses import JSONResponse


class BodySizeLimitMiddleware:
    def __init__(self, app, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") in {"GET", "HEAD", "OPTIONS", "TRACE"}
        ):
            await self.app(scope, receive, send)
            return

        content_length = next(
            (
                value
                for key, value in scope.get("headers", [])
                if key.lower() == b"content-length"
            ),
            None,
        )
        if content_length is not None:
            try:
                if int(content_length) > self.max_bytes:
                    await self._reject(send)
                    return
            except (TypeError, ValueError):
                await self._reject(send)
                return

        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body") or b"")
            if len(body) > self.max_bytes:
                await self._reject(send)
                return
            if not message.get("more_body", False):
                break

        payload = bytes(body)
        delivered = False

        async def replay_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": payload, "more_body": False}
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.app(scope, replay_receive, send)

    async def _reject(self, send) -> None:
        response = JSONResponse(
            status_code=413,
            content={"detail": "Request body is too large"},
        )
        await response(
            {
                "type": "http",
                "method": "POST",
                "path": "/",
                "headers": [],
                "query_string": b"",
                "scheme": "http",
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
            },
            None,
            send,
        )
