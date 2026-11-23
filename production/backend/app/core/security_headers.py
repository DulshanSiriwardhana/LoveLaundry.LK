"""Baseline transport/security headers for every HTTP response.

This API serves JSON only. The CSP disables framing, plugins and inline script
execution so an upstream misconfiguration cannot turn an API response into an
HTML injection sink. HSTS is emitted by the TLS terminator in production; the
header here is harmless over plain HTTP and makes local verification possible.
"""

from __future__ import annotations

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; "
        "form-action 'none'; object-src 'none'"
    ),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
}


class SecurityHeadersMiddleware:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers") or [])
                present = {key.lower() for key, _ in headers}
                for key, value in SECURITY_HEADERS.items():
                    encoded = key.lower().encode("latin-1")
                    if encoded not in present:
                        headers.append((encoded, value.encode("latin-1")))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)
