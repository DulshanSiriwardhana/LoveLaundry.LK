"""Public chatbot conversations (encrypted at rest) — legacy parity.

Security posture (preserved from the hardened legacy code):
- Participants are access-controlled on *every* read/write; guessing another
  guest's ``conversation_id`` leaks nothing (the IDOR fix).
- A stranger can only join a group if an existing participant invites them
  (``inviter_guest_id``).
- Sensitive fields are envelope-encrypted via the shared crypto core.
"""
from __future__ import annotations

import json
import os
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ...core.security import get_current_user, require_role
from .chat_repository import ChatRepository, new_message
from .deps import get_chat_repo

router = APIRouter(prefix="/chat", tags=["chat"])

BOT_FALLBACK = "Thank you for your message. Our team will get back to you shortly."
_ADMIN = ["ADMIN", "MANAGER"]


def _participant_ids(conv: dict) -> set:
    ids = {p.get("guest_id") for p in (conv.get("participants") or [])}
    if conv.get("guest_id"):
        ids.add(conv["guest_id"])
    ids.discard(None)
    return ids


def _call_bot(message: str, lang: str = "en") -> str:
    bot_url = os.getenv("CHAT_BOT_URL")
    if not bot_url:
        return BOT_FALLBACK
    payload = json.dumps({"message": message, "lang": lang}).encode("utf-8")
    req = urllib.request.Request(
        f"{bot_url.rstrip('/')}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    bot_key = os.getenv("CHAT_API_KEY")
    if bot_key:
        req.add_header("x-api-key", bot_key)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("reply") or BOT_FALLBACK
    except Exception:
        return BOT_FALLBACK


class GuestMessageIn(BaseModel):
    message: str
    guest_id: str
    lang: str = "en"
    name: Optional[str] = None
    participants: Optional[list] = None
    title: Optional[str] = None


@router.post("/conversations/{conversation_id}/messages")
async def post_guest_message(
    conversation_id: str,
    body: GuestMessageIn,
    repo: ChatRepository = Depends(get_chat_repo),
):
    existing = await repo.get_conversation(conversation_id)
    if existing and body.guest_id not in _participant_ids(existing):
        raise HTTPException(status_code=403, detail="You don't have access to this conversation")

    participants = list(body.participants or [])
    if body.name and not any(p.get("guest_id") == body.guest_id for p in participants):
        participants.append({"guest_id": body.guest_id, "name": body.name})
    if not participants:
        participants = [{"guest_id": body.guest_id, "name": body.name or body.guest_id}]

    created = existing is None
    if created:
        conv = await repo.save_conversation(
            conversation_id,
            {
                "guest_id": body.guest_id,
                "guest_name": body.name or participants[0]["name"],
                "participants": participants,
                "title": body.title,
                "assigned_admin_name": None,
                "status": "open",
            },
        )
    else:
        conv = existing

    await repo.add_message(conversation_id, new_message("guest", body.message, body.name, body.guest_id))
    bot_replied = False
    if not conv.get("assigned_admin_name"):
        reply = _call_bot(body.message, body.lang)
        if reply:
            await repo.add_message(conversation_id, new_message("bot", reply))
            bot_replied = True

    conv = await repo.update_conversation(conversation_id, {}) or conv
    return {
        "conversation_id": conversation_id,
        "created": created,
        "messages": await repo.list_messages(conversation_id),
        "participants": conv["participants"],
        "title": conv.get("title"),
        "assigned_admin_name": conv.get("assigned_admin_name"),
        "bot_replied": bot_replied,
    }


@router.post("/conversations/{conversation_id}/participants")
async def add_participant(
    conversation_id: str,
    body: dict,
    repo: ChatRepository = Depends(get_chat_repo),
):
    guest_id = body.get("guest_id")
    name = body.get("name")
    if not guest_id or not name:
        raise HTTPException(status_code=400, detail="guest_id and name are required")

    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    participants = list(conv.get("participants") or [])
    already_in = any(p.get("guest_id") == guest_id for p in participants)
    if not already_in:
        inviter_id = body.get("inviter_guest_id")
        if not inviter_id or inviter_id not in _participant_ids(conv):
            raise HTTPException(
                status_code=403,
                detail="Only a participant can invite someone into this conversation",
            )
        participants.append({"guest_id": guest_id, "name": name})

    fields = {"participants": participants}
    if not conv.get("guest_name") and participants:
        fields["guest_name"] = participants[0]["name"]
    return await repo.update_conversation(conversation_id, fields)


@router.get("/conversations/{conversation_id}")
async def get_guest_conversation(
    conversation_id: str,
    guest_id: str = Query(...),
    repo: ChatRepository = Depends(get_chat_repo),
):
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        return {
            "conversation_id": conversation_id,
            "messages": [],
            "participants": [],
            "title": None,
            "assigned_admin_name": None,
        }
    if guest_id not in _participant_ids(conv):
        raise HTTPException(status_code=403, detail="You don't have access to this conversation")
    return {**conv, "messages": await repo.list_messages(conversation_id)}


# ── Admin endpoints (ADMIN / MANAGER) ────────────────────────────────────────
@router.get("/admin/conversations", dependencies=[Depends(require_role(_ADMIN))])
async def admin_list_conversations(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    repo: ChatRepository = Depends(get_chat_repo),
):
    return await repo.list_conversations(status, limit)


@router.get("/admin/conversations/{conversation_id}", dependencies=[Depends(require_role(_ADMIN))])
async def admin_get_conversation(conversation_id: str, repo: ChatRepository = Depends(get_chat_repo)):
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {**conv, "messages": await repo.list_messages(conversation_id)}


class AdminMessageIn(BaseModel):
    text: str


@router.post("/admin/conversations/{conversation_id}/messages", dependencies=[Depends(require_role(_ADMIN))])
async def admin_post_message(
    conversation_id: str,
    body: AdminMessageIn,
    repo: ChatRepository = Depends(get_chat_repo),
    current_user: dict = Depends(get_current_user),
):
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    sender_name = (
        current_user.get("user_name") or current_user.get("name") or current_user.get("sub") or "Admin"
    )
    await repo.add_message(conversation_id, new_message("admin", body.text, sender_name))
    conv = await repo.update_conversation(
        conversation_id, {"assigned_admin_name": sender_name}
    )
    return {**conv, "messages": await repo.list_messages(conversation_id)}


class AdminUpdateIn(BaseModel):
    status: Optional[str] = None
    guest_name: Optional[str] = None
    assigned_admin_name: Optional[str] = None
    title: Optional[str] = None


@router.patch("/admin/conversations/{conversation_id}", dependencies=[Depends(require_role(_ADMIN))])
async def admin_update_conversation(
    conversation_id: str,
    body: AdminUpdateIn,
    repo: ChatRepository = Depends(get_chat_repo),
):
    conv = await repo.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    fields = body.model_dump(exclude_unset=True, exclude_none=True)
    if fields:
        conv = await repo.update_conversation(conversation_id, fields)
    return {**conv, "messages": await repo.list_messages(conversation_id)}
