import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from ..core.principal import assert_organization_access, normalize_principal
from ..core.security import get_current_user, get_user_lookup, verify_token
from ..permissions.service import organization_dependency
from ..runtime import get_runtime

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", dependencies=[Depends(organization_dependency("view_notifications"))])
async def list_notifications(
    organization_id: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    principal=Depends(get_current_user),
) -> list[dict]:
    scoped = organization_id or (
        principal.get("organization_id") if not principal.get("platform_admin") else None
    )
    return await get_runtime().notification_store.list(scoped, limit)


@router.post("/{notification_id}/read", dependencies=[Depends(get_current_user)])
async def mark_read(notification_id: str, principal=Depends(get_current_user)) -> dict:
    notification = await get_runtime().notification_store.mark_read(
        notification_id, str(principal.get("actor_id") or "")
    )
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    assert_organization_access(principal, str(notification.get("organization_id") or ""))
    return notification


@router.websocket("/stream")
async def notification_stream(websocket: WebSocket) -> None:
    """Authenticated live notification channel.

    The token is sent as the first WebSocket message rather than in the URL so
    proxies cannot log it as a query parameter. The durable inbox remains the
    authoritative record if a client disconnects.
    """

    await websocket.accept()
    runtime = get_runtime()
    queue = None
    organization_id = ""
    try:
        handshake = await websocket.receive_json()
        token = str(handshake.get("token") or "")
        if not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        payload = verify_token(token)
        auth_id = str(
            payload.get("auth_id") or payload.get("sub") or payload.get("user_id") or ""
        )
        user = await get_user_lookup(auth_id)
        principal = normalize_principal(user or dict(payload), payload)
        requested = str(handshake.get("organization_id") or "")
        organization_id = requested or str(principal.get("organization_id") or "")
        assert_organization_access(principal, organization_id)
        queue = await runtime.notification_hub.subscribe(organization_id)
        while True:
            try:
                notification = await asyncio.wait_for(queue.get(), timeout=15)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue
            await websocket.send_json({"type": "notification", "data": notification})
    except HTTPException as exc:
        await websocket.close(code=1008, reason=str(exc.detail))
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close(code=1011, reason="Notification stream failed")
    finally:
        if queue is not None:
            await runtime.notification_hub.unsubscribe(organization_id, queue)
