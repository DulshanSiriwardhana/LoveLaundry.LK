"""Live linen-feed WebSocket used by the hotel scanner.

The scanner opens ``/ws/linen?token=...`` and sends ``{subscribe: ["laundry"]}``
plus periodic ``{ping: true}`` frames. A first-message ``token`` is also accepted
so browsers can keep the credential out of the URL when they are updated. The
channel only relays events from the shared outbox: it never mutates linen state,
and it fails closed on an invalid identity, disabled account, revoked token,
disallowed origin or an organization the caller may not read.
"""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..core.config import get_settings
from ..core.principal import (
    granted_capabilities,
    is_platform_admin,
    normalize_principal,
    scoped_organization_ids,
)
from ..core.security import (
    DISABLED_STATUSES,
    get_user_lookup,
    token_is_revoked,
    verify_token,
)
from ..events.models import utc_now
from ..runtime import get_runtime

router = APIRouter(tags=["linen-live"])

POLL_INTERVAL_SECONDS = 1.0
MAX_SEEN_EVENTS = 1000
MAX_EVENTS_PER_POLL = 200

CLOSE_AUTHENTICATION = 4401
CLOSE_AUTHORIZATION = 4403
CLOSE_ORIGIN = 4403

LINEN_EVENT_PREFIX = "linen."


def _origin_allowed(websocket: WebSocket) -> bool:
    origin = (
        websocket.headers.get("origin")
        or websocket.headers.get("sec-websocket-origin")
        or ""
    ).strip()
    if not origin:
        # Non-browser clients (tests, service-to-service consumers) send no
        # Origin header; there is no cross-site browser context to protect.
        return True
    allowed = {value.rstrip("/") for value in get_settings().cors_origins}
    return origin.rstrip("/") in allowed


async def _authenticate(
    websocket: WebSocket, token: str | None
) -> tuple[dict | None, int | None, str | None, dict | None]:
    """Return (principal, close_code, reason, first_message)."""

    settings = get_settings()
    if not settings.auth_required and settings.app_env.strip().lower() != "production":
        return (
            normalize_principal(
                {
                    "auth_id": "local",
                    "user_name": "local",
                    "status": "active",
                    "role_ids": ["PLATFORM_ADMIN"],
                    "permissions": ["*"],
                }
            ),
            None,
            None,
            None,
        )

    handshake: dict | None = None
    supplied = (token or "").strip()
    if not supplied:
        try:
            received = await websocket.receive_json()
        except (WebSocketDisconnect, ValueError):
            received = None
        if isinstance(received, dict):
            handshake = received
            supplied = str(received.get("token") or "").strip()
    if not supplied:
        return None, CLOSE_AUTHENTICATION, "Authentication required", handshake

    try:
        payload = verify_token(supplied)
    except Exception:
        return None, CLOSE_AUTHENTICATION, "Invalid authentication token", handshake

    auth_id = str(
        payload.get("auth_id") or payload.get("sub") or payload.get("user_id") or ""
    )
    try:
        user = await get_user_lookup(auth_id, required=True)
    except Exception:
        return None, CLOSE_AUTHENTICATION, "Account is unavailable", handshake
    if str(user.get("status") or "unset").strip().lower() in DISABLED_STATUSES:
        return None, CLOSE_AUTHORIZATION, "Account is disabled", handshake
    if token_is_revoked(user, payload):
        return None, CLOSE_AUTHENTICATION, "Token has been revoked", handshake
    principal = normalize_principal(user, payload)
    if "view_linen" not in granted_capabilities(principal):
        return None, CLOSE_AUTHORIZATION, "Insufficient permissions", handshake
    return principal, None, None, handshake


def _allowed_organizations(principal: dict) -> set[str] | None:
    """None means global visibility; an empty set means no tenant access."""

    if is_platform_admin(principal):
        return None
    return set(scoped_organization_ids(principal))


def _frame(event: dict) -> dict[str, Any]:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    linen_id = str(event.get("entity_id") or "")
    to_stage = str(payload.get("to_stage") or "")
    return {
        "type": "linen.event",
        "event": event.get("event_type"),
        "event_id": event.get("event_id"),
        "action": payload.get("action") or "",
        "at": event.get("occurred_at") or utc_now(),
        "organization_id": event.get("organization_id"),
        "linen": {
            "linen_id": linen_id,
            "status": to_stage,
            "previous_status": payload.get("from_stage"),
        },
        "linen_ids": [linen_id] if linen_id else [],
        "data": event,
    }


@router.websocket("/ws/linen")
async def linen_live_feed(
    websocket: WebSocket, token: str | None = Query(default=None)
) -> None:
    # Accept first so the client receives the explicit 44xx close code and
    # stops its reconnect loop. Nothing is sent until identity and scope pass.
    await websocket.accept()
    if not _origin_allowed(websocket):
        await websocket.close(code=CLOSE_ORIGIN, reason="Origin not allowed")
        return

    principal, close_code, reason, handshake = await _authenticate(websocket, token)
    if principal is None:
        await websocket.close(code=close_code or CLOSE_AUTHENTICATION, reason=reason or "Authentication required")
        return

    organizations = _allowed_organizations(principal)
    if organizations is not None and not organizations:
        await websocket.close(code=CLOSE_AUTHORIZATION, reason="Organization scope is required")
        return

    runtime = get_runtime()
    existing = await runtime.outbox.list_events(limit=MAX_SEEN_EVENTS)
    seen = deque(str(event.get("event_id") or "") for event in existing)
    seen_ids = set(seen)

    subscribed = bool(handshake and handshake.get("subscribe"))
    if subscribed:
        await websocket.send_json({"type": "subscribed", "channels": ["laundry"]})
    try:
        while True:
            events = await runtime.outbox.list_events(limit=MAX_EVENTS_PER_POLL)
            for event in reversed(events):
                event_id = str(event.get("event_id") or "")
                if not event_id or event_id in seen_ids:
                    continue
                seen.append(event_id)
                seen_ids.add(event_id)
                if len(seen) > MAX_SEEN_EVENTS:
                    seen_ids.discard(seen.popleft())
                event_type = str(event.get("event_type") or "")
                if not event_type.startswith(LINEN_EVENT_PREFIX) or not subscribed:
                    continue
                organization_id = str(event.get("organization_id") or "")
                if organizations is not None and organization_id not in organizations:
                    continue
                await websocket.send_json(_frame(event))

            try:
                message = await asyncio.wait_for(
                    websocket.receive_json(), timeout=POLL_INTERVAL_SECONDS
                )
            except asyncio.TimeoutError:
                continue
            if not isinstance(message, dict):
                continue
            if message.get("subscribe"):
                subscribed = True
                channels = [
                    str(channel)
                    for channel in (message.get("subscribe") or [])
                    if str(channel) in {"laundry", "hotel", "linen"}
                ]
                await websocket.send_json(
                    {"type": "subscribed", "channels": channels}
                )
            elif message.get("ping"):
                await websocket.send_json({"type": "pong", "at": utc_now()})
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011, reason="Linen feed failed")
