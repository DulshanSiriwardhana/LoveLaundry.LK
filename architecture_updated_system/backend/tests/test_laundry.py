"""Laundry-management module tests — generic CRUD, capabilities, aggregations."""
from __future__ import annotations


def test_customer_crud_and_envelope(client, manager_headers):
    created = client.post(
        "/customers",
        json={"name": "Grand Hotel", "phone": "077", "customer_type": "hotel"},
        headers=manager_headers,
    )
    assert created.status_code == 201, created.text
    cust = created.json()
    assert cust["name"] == "Grand Hotel"
    cid = cust["id"]

    listing = client.get("/customers", headers=manager_headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1 and body["items"][0]["id"] == cid

    filtered = client.get("/customers?customer_type=hotel", headers=manager_headers)
    assert filtered.json()["total"] == 1
    assert client.get("/customers?customer_type=shop", headers=manager_headers).json()["total"] == 0

    updated = client.put(f"/customers/{cid}", json={"phone": "071"}, headers=manager_headers)
    assert updated.status_code == 200 and updated.json()["phone"] == "071"

    assert client.delete(f"/customers/{cid}", headers=manager_headers).json() == {"success": True}
    assert client.get(f"/customers/{cid}", headers=manager_headers).status_code == 404


def test_categories_bare_list(client, manager_headers):
    client.post("/items/categories", json={"name": "Linen"}, headers=manager_headers)
    resp = client.get("/items/categories", headers=manager_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["name"] == "Linen"


def test_customers_summary_not_shadowed_by_param_route(client, manager_headers):
    client.post("/customers", json={"name": "A", "customer_type": "shop"}, headers=manager_headers)
    resp = client.get("/customers/summary", headers=manager_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert resp.json()["by_type"]["shop"] == 1


def test_holiday_check(client, manager_headers):
    client.post("/holidays", json={"date": "2026-04-13", "name": "New Year"}, headers=manager_headers)
    hit = client.get("/holidays/check/2026-04-13", headers=manager_headers)
    assert hit.status_code == 200 and hit.json()["is_holiday"] is True
    miss = client.get("/holidays/check/2026-04-14", headers=manager_headers)
    assert miss.json()["is_holiday"] is False


def test_expense_summary(client, manager_headers):
    cat = client.post("/expenses/categories", json={"name": "Detergent"}, headers=manager_headers).json()
    client.post("/expenses", json={"amount": 300, "category_id": cat["id"]}, headers=manager_headers)
    client.post("/expenses", json={"amount": 200, "category_id": cat["id"]}, headers=manager_headers)
    summary = client.get("/expenses/summary", headers=manager_headers)
    assert summary.status_code == 200
    assert summary.json()["total"] == 500.0
    assert summary.json()["by_category"]["Detergent"] == 500.0


def test_employee_derived_lists_and_activate(client, manager_headers):
    emp = client.post("/employees", json={"name": "Nimal", "is_active": False}, headers=manager_headers).json()
    eid = emp["id"]
    client.post("/attendance/bulk", json=[{"employee_id": eid, "date": "2026-10-01", "status": "PRESENT"}], headers=manager_headers)
    client.post("/advances", json={"employee_id": eid, "amount": 5000, "status": "OUTSTANDING"}, headers=manager_headers)

    assert len(client.get(f"/employees/{eid}/attendance", headers=manager_headers).json()) == 1
    assert len(client.get(f"/employees/{eid}/advances", headers=manager_headers).json()) == 1

    activated = client.post(f"/employees/{eid}/activate", headers=manager_headers)
    assert activated.status_code == 200 and activated.json()["is_active"] is True


def test_company_settings_singleton(client, manager_headers):
    assert client.get("/company-settings", headers=manager_headers).json() == {}
    put = client.put("/company-settings", json={"company_name": "Love Laundry"}, headers=manager_headers)
    assert put.status_code == 200
    got = client.get("/company-settings", headers=manager_headers)
    assert got.json()["company_name"] == "Love Laundry"


def test_dashboard_aggregates(client, manager_headers):
    client.post("/transactions", json={"total_amount": 1000}, headers=manager_headers)
    client.post("/expenses", json={"amount": 250}, headers=manager_headers)
    client.post("/payments", json={"amount": 400}, headers=manager_headers)
    dash = client.get("/dashboard", headers=manager_headers)
    assert dash.status_code == 200
    body = dash.json()
    assert body["total_revenue"] == 1000.0
    assert body["total_expenses"] == 250.0
    assert body["total_payments"] == 400.0
    assert body["outstanding"] == 600.0


def test_staff_denied_expenses_and_salary(client, staff_headers):
    assert client.get("/expenses", headers=staff_headers).status_code == 403
    assert client.get("/salary/slips", headers=staff_headers).status_code == 403
    assert client.post("/expenses", json={"amount": 1}, headers=staff_headers).status_code == 403


def test_staff_allowed_transactions(client, staff_headers):
    resp = client.post("/transactions", json={"total_amount": 50}, headers=staff_headers)
    assert resp.status_code == 201
    assert client.get("/transactions", headers=staff_headers).status_code == 200


def test_requires_auth(client):
    assert client.get("/customers").status_code in (401, 403)
