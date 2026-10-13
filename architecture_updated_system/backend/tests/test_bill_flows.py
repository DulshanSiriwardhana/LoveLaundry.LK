"""Bill-service flow tests (Slice B/C breadth): returns, dispatch, adjustments,
monthly matrix, and operational reports — all against mongomock."""
from __future__ import annotations


def _gp_payload(number="GP-FLOW-A", client="Hilton Colombo", received=10):
    return {
        "gate_pass_number": number,
        "client_name": client,
        "receiving_date": "2026-10-01T08:00:00+05:30",
        "received_by": "Alice",
        "items": [
            {"item_name": "Pillow", "client_qty": received, "received_qty": received},
        ],
    }


def _seed_pass(client, headers, number="GP-FLOW-A", received=10):
    resp = client.post("/gatepasses", json=_gp_payload(number, received=received), headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _deliver(client, headers, gp, quantity=10, number_suffix=""):
    resp = client.post(
        "/deliveries",
        json={
            "gate_pass_id": gp["id"],
            "client_name": gp["client_name"],
            "delivery_date": "2026-10-02T08:00:00+05:30",
            "delivered_by": "Bob",
            "received_by": "Cust",
            "items": [{"item_name": "Pillow", "quantity": quantity}],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_return_records_and_recomputes_balance(client, manager_headers):
    gp = _seed_pass(client, manager_headers, number="GP-RET-1")
    _deliver(client, manager_headers, gp)

    resp = client.post(
        "/returns",
        json={
            "gate_pass_id": gp["id"],
            "client_name": gp["client_name"],
            "items": [
                {
                    "item_name": "Pillow",
                    "returned_qty": 2,
                    "reason": "DAMAGED",
                    "condition": "DAMAGED",
                    "action": "RE_WASH",
                }
            ],
            "notes": "two torn",
        },
        headers=manager_headers,
    )
    assert resp.status_code in (200, 201), resp.text
    returned = resp.json()
    assert returned["return_id"].startswith("RT-")

    listed = client.get("/returns", headers=manager_headers).json()
    assert any(r["return_id"] == returned["return_id"] for r in listed["items"])

    bal = client.get(f"/gatepasses/{gp['id']}/balance", headers=manager_headers).json()
    assert bal["totals"]["delivered_qty"] == 10
    assert bal["totals"]["outstanding_delivery_qty"] == 2


def test_return_cannot_exceed_delivered(client, manager_headers):
    gp = _seed_pass(client, manager_headers, number="GP-RET-2")
    _deliver(client, manager_headers, gp, quantity=3)
    resp = client.post(
        "/returns",
        json={
            "gate_pass_id": gp["id"],
            "client_name": gp["client_name"],
            "items": [{"item_name": "Pillow", "returned_qty": 5, "reason": "MISSING"}],
        },
        headers=manager_headers,
    )
    assert resp.status_code == 400


def test_dispatch_crud_and_optimize(client, manager_headers):
    created = client.post(
        "/dispatch",
        json={"job_type": "delivery", "client_name": "Hilton Colombo", "address": "1 Galle Rd"},
        headers=manager_headers,
    )
    assert created.status_code == 201, created.text
    job = created.json()
    assert job["client_name"] == "Hilton Colombo"

    updated = client.patch(
        f"/dispatch/{job['id']}",
        json={"status": "EN_ROUTE", "assigned_to": "driver-1"},
        headers=manager_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "EN_ROUTE"

    jobs = client.get("/dispatch", headers=manager_headers)
    assert jobs.status_code == 200
    assert any(j["id"] == job["id"] for j in jobs.json())

    optimized = client.post(
        "/dispatch/optimize",
        json={"assigned_to": "driver-1", "date": "2026-10-02"},
        headers=manager_headers,
    )
    assert optimized.status_code == 200, optimized.text

    deleted = client.delete(f"/dispatch/{job['id']}", headers=manager_headers)
    assert deleted.status_code == 204


def test_adjustment_request_created_and_listed(client, manager_headers):
    gp = _seed_pass(client, manager_headers, number="GP-ADJ-1")
    created = client.post(
        "/adjustments",
        json={
            "gate_pass_id": gp["id"],
            "item_name": "Pillow",
            "corrected_qty": 8,
            "reason": "miscounted at intake",
        },
        headers=manager_headers,
    )
    assert created.status_code in (200, 201), created.text

    listed = client.get("/adjustments", params={"gate_pass_id": gp["id"]}, headers=manager_headers)
    assert listed.status_code == 200
    assert len(listed.json()) >= 1
    assert listed.json()[0]["item_name"] == "Pillow"


def test_monthly_matrix_read_write(client, manager_headers):
    _seed_pass(client, manager_headers, number="GP-MON-1")

    matrix = client.get(
        "/monthly/delivery/Hilton Colombo/2026/10", headers=manager_headers
    )
    assert matrix.status_code == 200, matrix.text
    body = matrix.json()
    assert body["kind"] == "delivery"
    assert body["client_name"] == "Hilton Colombo"

    put = client.put(
        "/monthly/delivery/Hilton Colombo/2026/10/day/1/quantities",
        json={"quantities": {"Pillow||": 5.0}},
        headers=manager_headers,
    )
    assert put.status_code == 200, put.text

    reread = client.get(
        "/monthly/delivery/Hilton Colombo/2026/10", headers=manager_headers
    ).json()
    day1 = next(d for d in reread["days"] if d["day"] == 1)
    assert day1["status"] == "DRAFT"
    assert day1["total_qty"] == 5.0


def test_operational_reports_and_linen_categories(client, manager_headers):
    _seed_pass(client, manager_headers, number="GP-OPS-1")

    cats = client.get("/reports/linen-categories", headers=manager_headers)
    assert cats.status_code == 200, cats.text
    assert "categories" in cats.json()

    report = client.post(
        "/reports/monthly-operations",
        json={"start_date": "2026-10-01", "end_date": "2026-10-31"},
        headers=manager_headers,
    )
    assert report.status_code == 200, report.text
