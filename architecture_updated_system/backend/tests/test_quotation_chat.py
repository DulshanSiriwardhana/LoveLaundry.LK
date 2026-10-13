"""Public chatbot tests — participant access control and admin takeover."""
from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_bot(monkeypatch):
    monkeypatch.delenv("CHAT_BOT_URL", raising=False)
    monkeypatch.delenv("CHAT_API_KEY", raising=False)


def _post_guest(client, conv, guest_id, message, name="Alice", **extra):
    return client.post(
        f"/chat/conversations/{conv}/messages",
        json={"message": message, "guest_id": guest_id, "name": name, **extra},
    )


def test_guest_creates_conversation_and_gets_bot_fallback(client):
    resp = _post_guest(client, "conv-1", "g1", "Hello")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["created"] is True
    assert body["bot_replied"] is True
    assert {p["guest_id"] for p in body["participants"]} == {"g1"}
    assert [m["sender"] for m in body["messages"]] == ["guest", "bot"]


def test_non_participant_cannot_read_or_write(client):
    _post_guest(client, "conv-2", "g1", "Hi")
    assert client.get("/chat/conversations/conv-2?guest_id=g2").status_code == 403
    assert _post_guest(client, "conv-2", "g2", "sneak").status_code == 403
    ok = client.get("/chat/conversations/conv-2?guest_id=g1")
    assert ok.status_code == 200 and len(ok.json()["messages"]) == 2


def test_unknown_conversation_returns_empty(client):
    resp = client.get("/chat/conversations/nope?guest_id=g1")
    assert resp.status_code == 200
    assert resp.json()["messages"] == []


def test_group_invite_requires_participant(client):
    _post_guest(client, "conv-3", "g1", "Hi", name="Alice")
    stranger = client.post(
        "/chat/conversations/conv-3/participants",
        json={"guest_id": "g9", "name": "Mallory", "inviter_guest_id": "g9"},
    )
    assert stranger.status_code == 403

    invited = client.post(
        "/chat/conversations/conv-3/participants",
        json={"guest_id": "g2", "name": "Bob", "inviter_guest_id": "g1"},
    )
    assert invited.status_code == 200
    assert "g2" in {p["guest_id"] for p in invited.json()["participants"]}
    assert client.get("/chat/conversations/conv-3?guest_id=g2").status_code == 200


def test_admin_list_and_takeover(client, manager_headers, staff_headers):
    _post_guest(client, "conv-4", "g1", "Need help")

    assert client.get("/chat/admin/conversations", headers=staff_headers).status_code == 403
    listing = client.get("/chat/admin/conversations", headers=manager_headers)
    assert listing.status_code == 200
    assert listing.json()[0]["conversation_id"] == "conv-4"
    assert listing.json()[0]["message_count"] == 2

    reply = client.post(
        "/chat/admin/conversations/conv-4/messages",
        json={"text": "On it"},
        headers=manager_headers,
    )
    assert reply.status_code == 200
    assert reply.json()["assigned_admin_name"]

    after = _post_guest(client, "conv-4", "g1", "thanks")
    assert after.json()["bot_replied"] is False
    assert [m["sender"] for m in after.json()["messages"]][-1] == "guest"


def test_admin_patch_and_404(client, manager_headers):
    _post_guest(client, "conv-5", "g1", "Hi")
    patched = client.patch(
        "/chat/admin/conversations/conv-5",
        json={"status": "closed", "title": "Support"},
        headers=manager_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "closed"
    assert patched.json()["title"] == "Support"
    assert client.get("/chat/admin/conversations/missing", headers=manager_headers).status_code == 404
