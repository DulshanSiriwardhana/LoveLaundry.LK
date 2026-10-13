"""Chat persistence: encrypted conversations + messages (legacy parity).

Conversations are keyed by a client-supplied ``conversation_id`` string (not an
ObjectId) matching the legacy ``chat_conversations`` documents; messages live in
``chat_messages``. ``guest_name``/``participants`` and message ``text`` are
envelope-encrypted at rest.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Protocol

from ...core.clock import utcnow
from ...core.crypto import decrypt_dict, encrypt_dict

SENSITIVE_CONV = ["guest_name", "participants"]
SENSITIVE_MSG = ["text"]


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


class ChatRepository(Protocol):
    async def get_conversation(self, conversation_id: str) -> dict | None: ...
    async def save_conversation(self, conversation_id: str, doc: dict) -> dict: ...
    async def update_conversation(self, conversation_id: str, fields: dict) -> dict | None: ...
    async def list_conversations(self, status: Optional[str], limit: int) -> list[dict]: ...
    async def add_message(self, conversation_id: str, msg: dict) -> dict: ...
    async def list_messages(self, conversation_id: str) -> list[dict]: ...


class InMemoryChatRepository:
    """Hermetic chat repository used by tests (plaintext at rest)."""

    def __init__(self) -> None:
        self._convs: dict[str, dict] = {}
        self._msgs: list[dict] = []

    async def get_conversation(self, conversation_id: str) -> dict | None:
        doc = self._convs.get(str(conversation_id))
        return dict(doc) if doc else None

    async def save_conversation(self, conversation_id: str, doc: dict) -> dict:
        now = utcnow()
        stored = {
            **doc,
            "conversation_id": str(conversation_id),
            "created_at": doc.get("created_at") or now,
            "updated_at": now,
        }
        self._convs[str(conversation_id)] = stored
        return dict(stored)

    async def update_conversation(self, conversation_id: str, fields: dict) -> dict | None:
        doc = self._convs.get(str(conversation_id))
        if doc is None:
            return None
        doc.update(fields)
        doc["updated_at"] = utcnow()
        return dict(doc)

    async def list_conversations(self, status: Optional[str], limit: int) -> list[dict]:
        convs = list(self._convs.values())
        if status:
            convs = [c for c in convs if c.get("status") == status]
        convs.sort(key=lambda c: str(c.get("updated_at") or ""), reverse=True)
        out = []
        for c in convs[:limit]:
            msgs = await self.list_messages(c["conversation_id"])
            out.append({**c, "message_count": len(msgs), "last_message": msgs[-1] if msgs else None})
        return out

    async def add_message(self, conversation_id: str, msg: dict) -> dict:
        stored = {**msg, "conversation_id": str(conversation_id)}
        self._msgs.append(stored)
        return dict(stored)

    async def list_messages(self, conversation_id: str) -> list[dict]:
        msgs = [dict(m) for m in self._msgs if m["conversation_id"] == str(conversation_id)]
        msgs.sort(key=lambda m: str(m.get("timestamp") or ""))
        return msgs


class MongoChatRepository:
    """Motor-backed chat repository against the MAIN role database."""

    def __init__(self, db) -> None:
        self._convs = db["chat_conversations"]
        self._msgs = db["chat_messages"]

    def _serialize_conv(self, raw: dict | None) -> dict | None:
        if not raw:
            return None
        d = decrypt_dict(raw, SENSITIVE_CONV)
        d.pop("encryption_metadata", None)
        conv_id = str(d.pop("_id", "")) or d.get("conversation_id")
        participants = d.get("participants")
        if not participants and d.get("guest_name"):
            participants = [{"guest_id": d.get("guest_id"), "name": d.get("guest_name")}]
        return {
            "conversation_id": conv_id,
            "guest_id": d.get("guest_id"),
            "guest_name": d.get("guest_name"),
            "participants": participants or [],
            "title": d.get("title"),
            "assigned_admin_name": d.get("assigned_admin_name"),
            "status": d.get("status", "open"),
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
        }

    def _serialize_msg(self, raw: dict | None) -> dict | None:
        if not raw:
            return None
        d = decrypt_dict(raw, SENSITIVE_MSG)
        d.pop("encryption_metadata", None)
        d.pop("_id", None)
        d.pop("_search", None)
        return {
            "id": d.get("id"),
            "conversation_id": d.get("conversation_id"),
            "sender": d.get("sender"),
            "sender_name": d.get("sender_name"),
            "sender_guest_id": d.get("sender_guest_id"),
            "text": d.get("text"),
            "timestamp": _iso(d.get("timestamp")),
        }

    async def get_conversation(self, conversation_id: str) -> dict | None:
        return self._serialize_conv(await self._convs.find_one({"_id": str(conversation_id)}))

    async def save_conversation(self, conversation_id: str, doc: dict) -> dict:
        now = utcnow()
        stored = {
            "_id": str(conversation_id),
            **{k: v for k, v in doc.items() if k != "conversation_id"},
            "created_at": doc.get("created_at") or now,
            "updated_at": now,
        }
        encrypted = encrypt_dict(stored, SENSITIVE_CONV)
        await self._convs.replace_one({"_id": str(conversation_id)}, encrypted, upsert=True)
        return self._serialize_conv(encrypted)

    async def update_conversation(self, conversation_id: str, fields: dict) -> dict | None:
        current = await self.get_conversation(conversation_id)
        if current is None:
            return None
        merged = {**current, **fields}
        return await self.save_conversation(conversation_id, merged)

    async def list_conversations(self, status: Optional[str], limit: int) -> list[dict]:
        query = {"status": status} if status else {}
        cursor = self._convs.find(query).sort("updated_at", -1).limit(limit)
        out = []
        async for raw in cursor:
            conv = self._serialize_conv(raw)
            count = await self._msgs.count_documents({"conversation_id": conv["conversation_id"]})
            last = await self._msgs.find_one(
                {"conversation_id": conv["conversation_id"]}, sort=[("timestamp", -1)]
            )
            out.append({**conv, "message_count": count, "last_message": self._serialize_msg(last)})
        return out

    async def add_message(self, conversation_id: str, msg: dict) -> dict:
        doc = {**msg, "conversation_id": str(conversation_id)}
        encrypted = encrypt_dict(doc, SENSITIVE_MSG)
        result = await self._msgs.insert_one(encrypted)
        encrypted["_id"] = result.inserted_id
        return self._serialize_msg(encrypted)

    async def list_messages(self, conversation_id: str) -> list[dict]:
        cursor = self._msgs.find({"conversation_id": str(conversation_id)}).sort("timestamp", 1)
        return [self._serialize_msg(raw) async for raw in cursor]


def new_message(
    sender: str,
    text: str,
    sender_name: Optional[str] = None,
    sender_guest_id: Optional[str] = None,
) -> dict:
    import uuid

    return {
        "id": str(uuid.uuid4()),
        "sender": sender,
        "sender_name": sender_name,
        "sender_guest_id": sender_guest_id,
        "text": text,
        "timestamp": utcnow(),
    }
