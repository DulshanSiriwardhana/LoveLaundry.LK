"""Bill-service router integration tests (Slice A).

Exercises the ported routers against an in-process mongomock database (bound by
``create_app`` in ``APP_ENV=test``). Uses MANAGER headers because the bill
capability map does not list SUPER_ADMIN.
"""
from __future__ import annotations


def _gp_payload(number="GP-TEST-0001", client="Hilton Colombo", received=10):
    return {
        "gate_pass_number": number,
        "client_name": client,
        "receiving_date": "2026-10-01T08:00:00+05:30",
        "received_by": "Alice",
        "items": [
            {"item_name": "Pillow", "client_qty": received, "received_qty": received},
        ],
    }


def test_gate_pass_create_list_and_journal(client, manager_headers):
    created = client.post("/gatepasses", json=_gp_payload(), headers=manager_headers)
    assert created.status_code == 201, created.text
    gp = created.json()
    assert gp["gate_pass_number"] == "GP-TEST-0001"
    assert gp["client_name"] == "Hilton Colombo"
    assert gp["status"] == "RECEIVED"
    assert gp["items"][0]["received_qty"] == 10
    gp_id = gp["id"]

    listing = client.get("/gatepasses", headers=manager_headers)
    assert listing.status_code == 200
    assert any(g["id"] == gp_id for g in listing.json())

    # The creation is journaled in the append-only event feed.
    events = client.get("/events", headers=manager_headers)
    assert events.status_code == 200
    assert any(
        e["event_type"] == "GATE_PASS_CREATED" and e["entity_id"] == gp_id
        for e in events.json()
    )


def test_gate_pass_balance_reflects_received(client, manager_headers):
    gp = client.post("/gatepasses", json=_gp_payload(), headers=manager_headers).json()
    bal = client.get(f"/gatepasses/{gp['id']}/balance", headers=manager_headers)
    assert bal.status_code == 200, bal.text
    body = bal.json()
    assert body["totals"]["received_qty"] == 10
    assert body["totals"]["outstanding_delivery_qty"] == 10


def test_gate_pass_number_uniqueness_conflicts(client, manager_headers):
    assert client.post("/gatepasses", json=_gp_payload(), headers=manager_headers).status_code == 201
    dup = client.post("/gatepasses", json=_gp_payload(), headers=manager_headers)
    assert dup.status_code == 400, dup.text
    assert "already exists" in dup.json()["detail"]


def test_loyalty_adjust_and_fetch(client, manager_headers):
    first = client.post(
        "/loyalty/adjust",
        json={"client_name": "Grand Hotel", "delta_points": 120, "reason": "signup"},
        headers=manager_headers,
    )
    assert first.status_code == 200, first.text
    acc = first.json()
    assert acc["points"] == 120
    assert acc["tier"] == "SILVER"

    got = client.get("/loyalty/Grand Hotel", headers=manager_headers)
    assert got.status_code == 200
    assert got.json()["client_name"] == "Grand Hotel"

    more = client.post(
        "/loyalty/adjust",
        json={"client_name": "Grand Hotel", "delta_points": 400},
        headers=manager_headers,
    )
    assert more.json()["points"] == 520
    assert more.json()["tier"] == "GOLD"


def test_notifications_pending_from_balance(client, manager_headers):
    client.post("/gatepasses", json=_gp_payload(), headers=manager_headers)
    feed = client.get("/notifications/gatepass-pending", headers=manager_headers)
    assert feed.status_code == 200, feed.text
    entries = feed.json()
    assert any(e["item_name"] == "Pillow" and e["pending"] == 10 for e in entries)

    summary = client.get("/notifications/summary", headers=manager_headers).json()
    assert summary["pending_pieces"] == 10
    assert summary["pending_gate_passes"] == 1


def test_day_money_and_day_close(client, manager_headers):
    money = client.get("/day-money", params={"date": "2026-10-01"}, headers=manager_headers)
    assert money.status_code == 200, money.text
    assert money.json()["date"] == "2026-10-01"

    closed = client.post(
        "/day-close",
        json={"date": "2026-10-01", "totals": {"received": 10}, "note": "close"},
        headers=manager_headers,
    )
    assert closed.status_code == 200, closed.text
    assert closed.json()["event_type"] == "DAY_CLOSED"

    fetched = client.get("/day-close", params={"date": "2026-10-01"}, headers=manager_headers)
    assert fetched.status_code == 200
    assert fetched.json()["meta"]["totals"] == {"received": 10}


def test_reconciliation_clean_on_fresh_pass(client, manager_headers):
    client.post("/gatepasses", json=_gp_payload(), headers=manager_headers)
    resp = client.get("/reconciliation/issues", headers=manager_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["items"] == []


def test_bill_routes_require_capability(client, staff_headers):
    # STAFF may read gate passes but not write bills.
    assert client.get("/gatepasses", headers=staff_headers).status_code == 200
    denied = client.post("/bills", json={"client_name": "X"}, headers=staff_headers)
    assert denied.status_code == 403


def _create_gate_pass(client, headers, number="GP-FLOW-1", received=10):
    resp = client.post("/gatepasses", json=_gp_payload(number=number, received=received), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_delivery(client, headers, gp, quantity=10):
    payload = {
        "gate_pass_id": gp["id"],
        "client_name": gp["client_name"],
        "delivery_date": "2026-10-02T08:00:00+05:30",
        "delivered_by": "Bob",
        "received_by": "Customer Rep",
        "items": [{"item_name": "Pillow", "quantity": quantity}],
    }
    resp = client.post("/deliveries", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_receive_deliver_bill_payment_flow(client, manager_headers):
    gp = _create_gate_pass(client, manager_headers)
    delivery = _create_delivery(client, manager_headers, gp)
    assert delivery["gate_pass_id"] == gp["id"]

    # After a full delivery the pass derives to DELIVERED.
    bal = client.get(f"/gatepasses/{gp['id']}/balance", headers=manager_headers).json()
    assert bal["totals"]["outstanding_delivery_qty"] == 0

    bill_resp = client.post(
        "/bills",
        json={
            "client_name": gp["client_name"],
            "gate_pass_id": gp["id"],
            "items": [{"item_name": "Pillow", "quantity": 10, "unit_price": 5.0}],
            "instant": False,
        },
        headers=manager_headers,
    )
    assert bill_resp.status_code == 201, bill_resp.text
    bill = bill_resp.json()
    assert bill["grand_total"] == 50.0
    assert bill["payment_status"] == "DRAFT"

    issued = client.patch(
        f"/bills/{bill['id']}/status",
        params={"status_update": "ISSUED"},
        headers=manager_headers,
    )
    assert issued.status_code == 200, issued.text
    assert issued.json()["payment_status"] == "ISSUED"

    payment = client.post(
        f"/bills/{bill['id']}/payments",
        json={"amount": 50.0, "payment_method": "CASH", "payment_date": "2026-10-03T10:00:00+05:30"},
        headers=manager_headers,
    )
    assert payment.status_code == 201, payment.text

    payments = client.get(f"/bills/{bill['id']}/payments", headers=manager_headers)
    assert payments.status_code == 200
    assert len(payments.json()) == 1

    settled = client.get(f"/bills/{bill['id']}", headers=manager_headers).json()
    assert settled["payment_status"] == "PAID"


def test_delivery_cannot_exceed_received(client, manager_headers):
    gp = _create_gate_pass(client, manager_headers, number="GP-OVER-1", received=5)
    resp = client.post(
        "/deliveries",
        json={
            "gate_pass_id": gp["id"],
            "client_name": gp["client_name"],
            "delivery_date": "2026-10-02T08:00:00+05:30",
            "delivered_by": "Bob",
            "received_by": "Cust",
            "items": [{"item_name": "Pillow", "quantity": 6}],
        },
        headers=manager_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "DELIVERY_NOT_ALLOWED"


def test_shop_bill_create_and_stats(client, manager_headers):
    resp = client.post(
        "/shop-bills",
        json={"client_name": "Corner Cafe", "items": [{"item_name": "Shirt", "unit_price": 2.0, "quantity": 3}]},
        headers=manager_headers,
    )
    assert resp.status_code == 201, resp.text
    bill = resp.json()
    assert bill["grand_total"] == 6.0
    assert bill["bill_number"]

    stats = client.get("/shop-bills/stats/overview", headers=manager_headers)
    assert stats.status_code == 200, stats.text


def test_dashboard_endpoints_respond(client, manager_headers):
    _create_gate_pass(client, manager_headers, number="GP-DASH-1")
    for path in (
        "/dashboard/summary",
        "/dashboard/recent-activity",
        "/dashboard/outstanding-aging",
        "/balances/client?client_name=Hilton%20Colombo",
    ):
        resp = client.get(path, headers=manager_headers)
        assert resp.status_code == 200, f"{path}: {resp.text}"

