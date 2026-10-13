"""AI insights routes — recreates the legacy love-ai ``/api/ai/*`` surface.

All insight routes require the signed-request guard. Responses carry a SHA-256
``data_hash`` over the canonical JSON payload so clients can verify integrity.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query

from ...core.crypto import canonical_json, decrypt_dict, sha256_hex
from . import analytics
from .deps import get_insights_repo, optional_current_user, verify_signed_request
from .repository import InsightsRepository

router = APIRouter(prefix="/api/ai", tags=["AI Insights"])

TXN_SENSITIVE = ["customer_name", "invoice_number", "items", "notes"]
EMPLOYEE_SENSITIVE = ["name", "phone", "nic", "notes"]
EXPCAT_SENSITIVE = ["name"]


def _hash_payload(payload: dict) -> str:
    return sha256_hex(canonical_json(payload).encode("utf-8"))


def _wrap(payload: dict, trusted: bool = False) -> dict:
    return {
        "data": payload,
        "data_hash": _hash_payload(payload),
        "source": "love_ai_v1",
        "verified": trusted,
    }


def _wrap_series(series: list[dict], forecast: dict) -> dict:
    return {"series": series, "forecast": forecast}


@router.get("/health")
async def ai_health(
    _key: dict = Depends(verify_signed_request),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    ok = await repo.ping()
    return {
        "service": "love-ai",
        "status": "ok" if ok else "degraded",
        "database": "main" if ok else "unreachable",
    }


@router.get("/insights/dashboard")
async def dashboard_insights(
    months: int = Query(12, ge=1, le=24),
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    txns_fut = repo.find("transactions", {}, {"transaction_date": 1, "total_amount": 1})
    expenses_fut = repo.find("expenses", {}, {"date": 1, "amount": 1})
    slips_fut = repo.find(
        "salary_slips", {"status": {"$ne": "DELETED"}}, {"period_start": 1, "net_salary": 1}
    )
    txns, expenses, slips = await asyncio.gather(txns_fut, expenses_fut, slips_fut)

    revenue_series = analytics.default_series_data(txns, "transaction_date", "total_amount", months)
    expense_series = analytics.default_series_data(expenses, "date", "amount", months)
    payroll_series = analytics.default_series_data(slips, "period_start", "net_salary", months)

    revenue_vals = [s["value"] for s in revenue_series]
    expense_vals = [s["value"] for s in expense_series]
    payroll_vals = [s["value"] for s in payroll_series]
    net = [round(r - e, 2) for r, e in zip(revenue_vals, expense_vals)]

    payload = {
        "generated_at": None,
        "months": months,
        "period": {
            "start": revenue_series[0]["month"] if revenue_series else None,
            "end": revenue_series[-1]["month"] if revenue_series else None,
        },
        "revenue": _wrap_series(revenue_series, analytics.ols_forecast(revenue_vals, 3)),
        "expenses": _wrap_series(expense_series, analytics.ols_forecast(expense_vals, 3)),
        "payroll": _wrap_series(payroll_series, analytics.ols_forecast(payroll_vals, 3)),
        "net_profit": {"history": net, "total": round(sum(net), 2)},
        "total_revenue": round(sum(revenue_vals), 2),
        "total_expenses": round(sum(expense_vals), 2),
        "total_payroll": round(sum(payroll_vals), 2),
        "avg_monthly_net": round(sum(net) / len(net), 2) if net else 0.0,
    }
    return _wrap(payload)


@router.get("/insights/revenue")
async def revenue_insights(
    months: int = Query(12, ge=1, le=24),
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    txns = await repo.find(
        "transactions",
        {},
        {
            "transaction_date": 1,
            "total_amount": 1,
            "customer_id": 1,
            "customer_name": 1,
            "encryption_metadata": 1,
        },
    )
    series = analytics.default_series_data(txns, "transaction_date", "total_amount", months)
    vals = [s["value"] for s in series]
    forecast = analytics.ols_forecast(vals, 3)

    by_customer: dict[str, float] = {}
    for t in txns:
        dec = decrypt_dict(t, TXN_SENSITIVE)
        cid = str(dec.get("customer_id") or "")
        name = (dec.get("customer_name") or "").strip() or "Walk-in"
        key = f"{cid}|{name}"
        by_customer[key] = by_customer.get(key, 0.0) + analytics._num(dec.get("total_amount"))
    top_customers = [
        {"customer_name": name.split("|", 1)[1], "amount": round(amt, 2)}
        for name, amt in sorted(by_customer.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

    payload = {
        "months": months,
        "series": series,
        "forecast": forecast,
        "total": round(sum(vals), 2),
        "best_month": max(series, key=lambda s: s["value"], default=None),
        "top_customers": top_customers,
        "projected_next_3_months": forecast["forecast"],
    }
    return _wrap(payload)


@router.get("/insights/expenses")
async def expense_insights(
    months: int = Query(12, ge=1, le=24),
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    expenses = await repo.find("expenses", {}, {"date": 1, "amount": 1, "category_id": 1})
    series = analytics.default_series_data(expenses, "date", "amount", months)
    vals = [s["value"] for s in series]
    forecast = analytics.ols_forecast(vals, 3)

    cat_rows = await repo.find("expense_categories", {}, {"name": 1, "encryption_metadata": 1})
    cat_names: dict[str, str] = {}
    for c in cat_rows:
        dec = decrypt_dict(c, EXPCAT_SENSITIVE)
        cat_names[str(dec.get("_id"))] = dec.get("name") or "Uncategorized"
    by_cat: dict[str, float] = {}
    for e in expenses:
        cid = str(e.get("category_id") or "None")
        label = cat_names.get(cid, "Uncategorized")
        by_cat[label] = by_cat.get(label, 0.0) + analytics._num(e.get("amount"))
    top_categories = [
        {"category": k, "amount": round(v, 2)}
        for k, v in sorted(by_cat.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

    payload = {
        "months": months,
        "series": series,
        "forecast": forecast,
        "total": round(sum(vals), 2),
        "highest_month": max(series, key=lambda s: s["value"], default=None),
        "top_categories": top_categories,
        "projected_next_3_months": forecast["forecast"],
    }
    return _wrap(payload)


@router.get("/insights/salary")
async def salary_insights(
    months: int = Query(12, ge=1, le=24),
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    slips_docs = await repo.find(
        "salary_slips",
        {"status": {"$ne": "DELETED"}},
        {"period_start": 1, "net_salary": 1, "employee_id": 1, "employee_name": 1},
    )
    series = analytics.default_series_data(slips_docs, "period_start", "net_salary", months)
    vals = [s["value"] for s in series]
    forecast = analytics.ols_forecast(vals, 3)

    per_emp: dict[str, dict] = {}
    for s in slips_docs:
        eid = str(s.get("employee_id") or "")
        rec = per_emp.setdefault(
            eid,
            {
                "employee_id": eid,
                "employee_name": s.get("employee_name") or "Unknown",
                "total": 0.0,
                "slips": 0,
            },
        )
        rec["total"] += analytics._num(s.get("net_salary"))
        rec["slips"] += 1
    employees_sorted = sorted(per_emp.values(), key=lambda r: r["total"], reverse=True)

    payload = {
        "months": months,
        "series": series,
        "forecast": forecast,
        "total_payroll": round(sum(vals), 2),
        "avg_monthly_payroll": round(sum(vals) / len(vals), 2) if vals else 0.0,
        "top_employees": [{**e, "total": round(e["total"], 2)} for e in employees_sorted[:10]],
        "projected_next_3_months": forecast["forecast"],
    }
    return _wrap(payload)


@router.get("/insights/payroll-risk")
async def payroll_risk_insights(
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    advances = await repo.find(
        "salary_advances",
        {"status": "OUTSTANDING", "outstanding": {"$gt": 0}},
        {"employee_id": 1, "outstanding": 1},
    )
    employees = await repo.find("employees", {}, {"name": 1, "encryption_metadata": 1})
    emp_names: dict[str, str] = {}
    for e in employees:
        dec = decrypt_dict(e, EMPLOYEE_SENSITIVE)
        emp_names[str(dec.get("_id"))] = dec.get("name") or "Unknown"

    by_emp: dict[str, dict] = {}
    for a in advances:
        eid = str(a.get("employee_id") or "")
        rec = by_emp.setdefault(
            eid,
            {
                "employee_id": eid,
                "employee_name": emp_names.get(eid, "Unknown"),
                "outstanding": 0.0,
                "count": 0,
            },
        )
        rec["outstanding"] += analytics._num(a.get("outstanding"))
        rec["count"] += 1
    risk_rows = [dict(r, outstanding=round(r["outstanding"], 2)) for r in by_emp.values()]
    risk_rows.sort(key=lambda r: r["outstanding"], reverse=True)

    payload = {
        "as_of": None,
        "total_outstanding_advances": round(sum(r["outstanding"] for r in risk_rows), 2),
        "employees_at_risk": risk_rows,
    }
    return _wrap(payload)


@router.post("/insights/query")
async def custom_query(
    payload: dict,
    _auth: dict = Depends(verify_signed_request),
    user: dict | None = Depends(optional_current_user),
    repo: InsightsRepository = Depends(get_insights_repo),
):
    """Structured analytical query: {metric: 'revenue'|'expenses'|'salary', months?: int}."""
    metric = str(payload.get("metric") or "revenue").lower()
    months = int(payload.get("months") or 12)
    months = max(1, min(months, 24))

    spec = {
        "revenue": ("transactions", "transaction_date", "total_amount", "Revenue"),
        "expenses": ("expenses", "date", "amount", "Expenses"),
        "salary": ("salary_slips", "period_start", "net_salary", "Payroll"),
    }.get(metric)

    if spec is None:
        raise HTTPException(status_code=400, detail=f"Unknown metric '{metric}'")

    coll, date_key, value_key, label = spec
    docs = await repo.find(coll, {}, {date_key: 1, value_key: 1})
    series = analytics.default_series_data(docs, date_key, value_key, months)
    vals = [s["value"] for s in series]
    forecast = analytics.ols_forecast(vals, 3)
    result = {
        "metric": metric,
        "label": label,
        "months": months,
        "series": series,
        "forecast": forecast,
        "total": round(sum(vals), 2),
        "average": round(sum(vals) / len(vals), 2) if vals else 0.0,
        "trend": "up" if forecast["slope"] > 0 else ("down" if forecast["slope"] < 0 else "flat"),
        "projected_next_3_months": forecast["forecast"],
    }
    return _wrap(result)
