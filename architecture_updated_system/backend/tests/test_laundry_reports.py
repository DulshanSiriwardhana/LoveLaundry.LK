"""Tests for laundry derived summaries, bulk ops, salary lifecycle, reports and import."""
from __future__ import annotations

CSV_IMPORT = (
    "Date,Customer Name,Invoice Number,Item Name,Qty Received,Qty Washed,"
    "Qty Delivered,Qty Rejected,Qty Damaged,Rate,Cost,Notes\n"
    "2026-10-01,Sunshine Hotel,INV-1,Shirt,20,20,18,2,0,150,80,\n"
)


def test_advances_summary(client, manager_headers):
    emp = client.post("/employees", json={"name": "Kamal"}, headers=manager_headers).json()
    eid = emp["id"]
    client.post("/advances", json={"employee_id": eid, "amount": 3000, "outstanding": 3000, "status": "OUTSTANDING"}, headers=manager_headers)
    client.post("/advances", json={"employee_id": eid, "amount": 1000, "outstanding": 1000, "status": "OUTSTANDING"}, headers=manager_headers)
    client.post("/advances", json={"employee_id": eid, "amount": 500, "outstanding": 500, "status": "CANCELLED"}, headers=manager_headers)
    summary = client.get(f"/employees/{eid}/advances/summary", headers=manager_headers).json()
    assert summary == {"total_outstanding": 4000.0, "count": 2}


def test_employee_salary_create_and_transitions(client, manager_headers):
    emp = client.post("/employees", json={"name": "Nimal"}, headers=manager_headers).json()
    eid = emp["id"]
    slip = client.post(f"/employees/{eid}/salaries", json={"net_pay": 45000}, headers=manager_headers)
    assert slip.status_code == 201
    sid = slip.json()["id"]
    assert client.put(f"/employees/{eid}/salaries/{sid}", json={"net_pay": 46000}, headers=manager_headers).json()["net_pay"] == 46000

    finalized = client.post(f"/salary/slips/{sid}/finalize", headers=manager_headers)
    assert finalized.status_code == 200 and finalized.json()["status"] == "FINALIZED"
    paid = client.post(f"/salary/slips/{sid}/pay", headers=manager_headers)
    assert paid.json()["status"] == "PAID"


def test_transactions_bulk_and_attendance(client, manager_headers):
    bulk = client.post("/transactions/bulk", json=[{"total_amount": 100}, {"total_amount": 200}], headers=manager_headers)
    assert bulk.status_code == 201 and bulk.json()["created"] == 2

    emp = client.post("/employees", json={"name": "A"}, headers=manager_headers).json()["id"]
    day = client.post("/attendance/bulk-day", json={"date": "2026-10-02", "employee_ids": [emp], "status": "PRESENT"}, headers=manager_headers)
    assert day.status_code == 201 and day.json()["created"] == 1

    summary = client.get("/attendance/summary", headers=manager_headers).json()
    assert summary["total"] == 1 and summary["by_status"]["PRESENT"] == 1


def test_customer_rate_delete(client, manager_headers):
    cust = client.post("/customers", json={"name": "Hotel"}, headers=manager_headers).json()["id"]
    rate = client.post(f"/customers/{cust}/rates", json={"item_name": "Shirt", "rate": 150}, headers=manager_headers).json()
    assert client.delete(f"/customers/{cust}/rates/{rate['id']}", headers=manager_headers).json() == {"success": True}
    assert client.delete(f"/customers/{cust}/rates/{rate['id']}", headers=manager_headers).status_code == 404


def test_profit_loss_and_outstanding(client, manager_headers):
    client.post("/transactions", json={"total_amount": 1000, "total_cost": 600, "transaction_date": "2026-10-01", "customer_id": "c1", "customer_name": "Hotel"}, headers=manager_headers)
    client.post("/expenses", json={"amount": 100, "date": "2026-10-01"}, headers=manager_headers)
    client.post("/payments", json={"amount": 400, "customer_id": "c1"}, headers=manager_headers)

    pl = client.get("/reports/profit-loss?start_date=2026-10-01&end_date=2026-10-01", headers=manager_headers).json()
    assert pl["total_revenue"] == 1000.0
    assert pl["gross_profit"] == 400.0
    assert pl["total_expenses"] == 100.0
    assert pl["net_profit"] == 300.0

    os_row = client.get("/reports/outstanding", headers=manager_headers).json()[0]
    assert os_row["total_billed"] == 1000.0 and os_row["total_paid"] == 400.0 and os_row["outstanding"] == 600.0


def test_daily_range_monthly_and_data_quality(client, manager_headers):
    client.post("/transactions", json={"total_amount": 500, "transaction_date": "2026-10-03"}, headers=manager_headers)

    daily = client.get("/reports/daily?date=2026-10-03", headers=manager_headers).json()
    assert daily["total_revenue"] == 500.0

    rng = client.get("/reports/range?start_date=2026-10-03&end_date=2026-10-04", headers=manager_headers).json()
    assert rng["days"] == 2 and rng["total_revenue"] == 500.0

    monthly = client.get("/reports/monthly?year=2026&month=10", headers=manager_headers).json()
    assert monthly["total_revenue"] == 500.0

    dq = client.get("/reports/data-quality?start_date=2026-10-03&end_date=2026-10-04", headers=manager_headers).json()
    assert dq["missing_data_days"] == ["2026-10-04"]
    assert client.get("/reports/health", headers=manager_headers).json()["status"] == "ok"


def test_hotel_item_wise_and_master(client, manager_headers):
    client.post("/transactions", json={
        "total_amount": 900, "total_cost": 500, "total_quantity": 6,
        "transaction_date": "2026-10-05", "customer_id": "c1", "customer_name": "Grand Hotel",
        "items": [
            {"item_name": "Shirt", "category_name": "Linen", "quantity_received": 4, "quantity_washed": 4, "line_total": 600, "line_cost": 320},
            {"item_name": "Towel", "category_name": "Linen", "quantity_received": 2, "quantity_washed": 2, "line_total": 300, "line_cost": 180},
        ],
    }, headers=manager_headers)
    client.post("/expenses", json={"amount": 120, "date": "2026-10-05"}, headers=manager_headers)

    hotels = client.get("/reports/hotel-wise?start_date=2026-10-05&end_date=2026-10-05", headers=manager_headers).json()
    assert len(hotels) == 1
    assert hotels[0]["client_name"] == "Grand Hotel"
    assert hotels[0]["total_revenue"] == 900.0
    assert hotels[0]["gross_profit"] == 400.0

    items = client.get("/reports/item-wise?start_date=2026-10-05&end_date=2026-10-05", headers=manager_headers).json()
    assert {i["item_name"] for i in items} == {"Shirt", "Towel"}
    shirt = next(i for i in items if i["item_name"] == "Shirt")
    assert shirt["total_revenue"] == 600.0 and shirt["client_count"] == 1

    master = client.get("/reports/master?start_date=2026-10-05&end_date=2026-10-05", headers=manager_headers).json()
    assert master["source_of_truth"] == "management_payroll_and_expenses"
    assert master["other_expense_total"] == 120.0
    assert master["total_expenses"] == 120.0

    assert client.get("/reports/master", headers=manager_headers).status_code == 400


def test_import_preview_and_execute(client, manager_headers):
    assert client.get("/import/template", headers=manager_headers).status_code == 200

    files = {"file": ("import.csv", CSV_IMPORT, "text/csv")}
    preview = client.post("/import/preview", files=files, headers=manager_headers).json()
    assert preview["total_rows"] == 1 and preview["errors"] == []

    files = {"file": ("import.csv", CSV_IMPORT, "text/csv")}
    executed = client.post("/import/execute", files=files, headers=manager_headers).json()
    assert executed["success_rows"] == 1 and executed["transactions_created"] == 1

    history = client.get("/import/history", headers=manager_headers).json()
    assert len(history) == 1 and history[0]["success_rows"] == 1

    pl = client.get("/reports/profit-loss?start_date=2026-10-01&end_date=2026-10-01", headers=manager_headers).json()
    assert pl["total_revenue"] == 3000.0
