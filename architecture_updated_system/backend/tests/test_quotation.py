"""Quotation module tests — lifecycle, tags and public tracking endpoints."""
from __future__ import annotations


def _create(client, headers, **overrides):
    payload = {
        "client_name": "Grand Hotel",
        "quotation_title": "Weekly linen",
        "line_items": [
            {"item_name": "Bed Sheet", "unit_price": 250.0},
            {"item_name": "Towel", "unit_price": 120.0},
        ],
        "tag": "hotel",
    }
    payload.update(overrides)
    return client.post("/quotations", json=payload, headers=headers)


def test_create_and_fetch_quotation(client, manager_headers):
    resp = _create(client, manager_headers)
    assert resp.status_code == 201, resp.text
    q = resp.json()
    assert q["client_name"] == "Grand Hotel"
    assert q["tag"] == "hotel"
    assert q["status"] == "draft"
    assert len(q["line_items"]) == 2
    assert q["status_history"][0]["note"] == "Created"

    got = client.get(f"/quotations/{q['id']}", headers=manager_headers)
    assert got.status_code == 200
    assert got.json()["id"] == q["id"]


def test_list_and_tag_filter(client, manager_headers):
    _create(client, manager_headers, tag="shop")
    _create(client, manager_headers, tag="hotel")
    all_resp = client.get("/quotations", headers=manager_headers)
    assert all_resp.status_code == 200
    assert len(all_resp.json()) >= 2
    shop = client.get("/quotations?tag=shop", headers=manager_headers)
    assert all(q["tag"] == "shop" for q in shop.json())


def test_guest_shop_view_is_public(client, manager_headers):
    _create(client, manager_headers, tag="shop")
    resp = client.get("/quotations/guest/shop")
    assert resp.status_code == 200
    assert all(q["tag"] == "shop" for q in resp.json())


def test_status_advance_transition_rules(client, manager_headers):
    q = _create(client, manager_headers).json()
    qid = q["id"]

    ok = client.post(
        f"/quotations/{qid}/status", json={"status": "received"}, headers=manager_headers
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "received"

    bad = client.post(
        f"/quotations/{qid}/status", json={"status": "delivered"}, headers=manager_headers
    )
    assert bad.status_code == 422
    assert "Cannot move" in bad.json()["detail"]


def test_update_records_history_on_status_change(client, manager_headers):
    q = _create(client, manager_headers).json()
    resp = client.put(
        f"/quotations/{q['id']}", json={"status": "received"}, headers=manager_headers
    )
    assert resp.status_code == 200, resp.text
    history = resp.json()["status_history"]
    assert history[-1]["status"] == "received"
    assert history[-1]["note"] == "Status updated"


def test_tracking_is_public(client, manager_headers):
    q = _create(client, manager_headers).json()
    resp = client.get(f"/quotations/{q['id']}/tracking")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "draft"
    assert "status_history" in body


def test_delete_quotation(client, manager_headers):
    q = _create(client, manager_headers).json()
    assert client.delete(f"/quotations/{q['id']}", headers=manager_headers).status_code == 200
    assert client.get(f"/quotations/{q['id']}", headers=manager_headers).status_code == 404


def test_tags_mint_list_and_lookup(client, manager_headers):
    q = _create(client, manager_headers).json()
    qid = q["id"]

    minted = client.post(
        f"/quotations/{qid}/tags", json={"per_item": True}, headers=manager_headers
    )
    assert minted.status_code == 200, minted.text
    tags = minted.json()["tags"]
    assert len(tags) == 2
    assert tags[0]["label"] == "Bed Sheet"
    assert tags[0]["tracking_url"].endswith(f"tag={tags[0]['code']}")

    listing = client.get(f"/quotations/{qid}/tags", headers=manager_headers)
    assert listing.status_code == 200
    assert len(listing.json()["tags"]) == 2

    code = tags[0]["code"]
    public = client.get(f"/tags/{code}")
    assert public.status_code == 200
    assert public.json()["client_first_name"] == "Grand"
    track = client.get(f"/tags/{code}/tracking")
    assert track.status_code == 200
    assert track.json()["garment_label"] == "Bed Sheet"


def test_loose_tags_count(client, manager_headers):
    q = _create(client, manager_headers).json()
    minted = client.post(
        f"/quotations/{q['id']}/tags", json={"count": 3}, headers=manager_headers
    )
    assert minted.status_code == 200
    assert len(minted.json()["tags"]) == 3


def test_tags_for_missing_quotation(client, manager_headers):
    resp = client.post("/quotations/nope/tags", json={}, headers=manager_headers)
    assert resp.status_code == 404


def test_write_requires_role(client, staff_headers):
    resp = _create(client, staff_headers)
    assert resp.status_code == 403


def test_quotation_requires_auth(client):
    assert client.get("/quotations").status_code in (401, 403)
