"""AI insights module tests — signed-request auth + integrity-hashed payloads."""
from __future__ import annotations

import time

from app.core.crypto import canonical_json, sha256_hex, sign_request

API_KEY = "test-ai-api-key"


def _signed_headers(method: str, path: str, body: bytes = b"") -> dict:
    ts = str(int(time.time()))
    body_hash = sha256_hex(body)
    signature = sign_request(API_KEY, method, path, ts, body_hash)
    headers = {
        "X-API-Key": API_KEY,
        "X-Timestamp": ts,
        "X-Body-Hash": body_hash,
        "X-Signature": signature,
    }
    if body:
        headers["Content-Type"] = "application/json"
    return headers


def _seed(app):
    repo = app.state.insights_repo
    repo.add("transactions", {"transaction_date": "2026-10-05", "total_amount": 1000, "customer_id": 1, "customer_name": "Grand Hotel"})
    repo.add("transactions", {"transaction_date": "2026-09-05", "total_amount": 500, "customer_id": 1, "customer_name": "Grand Hotel"})
    repo.add("expenses", {"date": "2026-10-02", "amount": 200, "category_id": 7})
    repo.add("expense_categories", {"_id": 7, "name": "Detergent"})
    repo.add("salary_slips", {"period_start": "2026-10-01", "net_salary": 30000, "employee_id": 2, "employee_name": "Nimal", "status": "PAID"})
    repo.add("salary_advances", {"employee_id": 2, "outstanding": 5000, "status": "OUTSTANDING"})
    repo.add("employees", {"_id": 2, "name": "Nimal"})


def test_requires_api_key(client):
    assert client.get("/api/ai/insights/dashboard").status_code == 401


def test_requires_signature(client):
    assert (
        client.get("/api/ai/insights/dashboard", headers={"X-API-Key": API_KEY}).status_code
        == 401
    )


def test_dashboard(client, app):
    _seed(app)
    path = "/api/ai/insights/dashboard?months=12"
    resp = client.get(path, headers=_signed_headers("GET", path))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["source"] == "love_ai_v1"
    data = body["data"]
    assert data["total_revenue"] == 1500.0
    assert data["total_expenses"] == 200.0
    assert data["total_payroll"] == 30000.0
    assert body["data_hash"] == sha256_hex(canonical_json(data).encode())


def test_revenue_top_customers(client, app):
    _seed(app)
    path = "/api/ai/insights/revenue"
    resp = client.get(path, headers=_signed_headers("GET", path))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["total"] == 1500.0
    assert data["top_customers"][0]["customer_name"] == "Grand Hotel"
    assert data["top_customers"][0]["amount"] == 1500.0


def test_expenses_top_categories(client, app):
    _seed(app)
    path = "/api/ai/insights/expenses"
    resp = client.get(path, headers=_signed_headers("GET", path))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["top_categories"][0]["category"] == "Detergent"


def test_salary_and_payroll_risk(client, app):
    _seed(app)
    path = "/api/ai/insights/salary"
    resp = client.get(path, headers=_signed_headers("GET", path))
    assert resp.status_code == 200
    assert resp.json()["data"]["top_employees"][0]["employee_name"] == "Nimal"

    risk_path = "/api/ai/insights/payroll-risk"
    risk = client.get(risk_path, headers=_signed_headers("GET", risk_path))
    assert risk.status_code == 200
    body = risk.json()["data"]
    assert body["total_outstanding_advances"] == 5000.0
    assert body["employees_at_risk"][0]["employee_name"] == "Nimal"


def test_query_metric(client, app):
    _seed(app)
    path = "/api/ai/insights/query"
    body = b'{"metric": "revenue", "months": 12}'
    resp = client.post(path, content=body, headers=_signed_headers("POST", path, body))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["metric"] == "revenue"


def test_query_unknown_metric(client, app):
    _seed(app)
    path = "/api/ai/insights/query"
    body = b'{"metric": "bogus"}'
    resp = client.post(path, content=body, headers=_signed_headers("POST", path, body))
    assert resp.status_code == 400


def test_body_tamper_rejected(client):
    path = "/api/ai/insights/query"
    headers = _signed_headers("POST", path, b'{"metric": "revenue"}')
    resp = client.post(path, content=b'{"metric": "bogus"}', headers=headers)
    assert resp.status_code == 401
