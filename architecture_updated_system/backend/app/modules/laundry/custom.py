"""Custom (non-generic) laundry endpoints: dashboard, summaries, derived
employee collections, holidays, company settings and attendance bulk entry.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from ...core.capabilities import require_capability
from .deps import get_laundry_repo
from .repository import LaundryRepository

CUSTOMER_SENSITIVE = ["name", "contact_person", "phone", "email", "address", "notes"]
EMPLOYEE_SENSITIVE = ["name", "phone", "nic", "notes"]
EXPENSE_SENSITIVE = ["description", "reference", "notes"]
TXN_SENSITIVE = ["customer_name", "invoice_number", "items", "notes"]
SALARY_SENSITIVE = ["notes"]


def _num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def register_custom(router: APIRouter) -> None:
    @router.get("/dashboard", dependencies=[Depends(require_capability("dashboard:read"))])
    async def dashboard(repo: LaundryRepository = Depends(get_laundry_repo)):
        txns = await repo.all_docs("transactions", TXN_SENSITIVE)
        expenses = await repo.all_docs("expenses", EXPENSE_SENSITIVE)
        payments = await repo.all_docs("payments", ["customer_name", "reference", "notes"])
        customers = await repo.all_docs("customers", CUSTOMER_SENSITIVE)

        total_revenue = round(sum(_num(t.get("total_amount")) for t in txns), 2)
        total_expenses = round(sum(_num(e.get("amount")) for e in expenses), 2)
        total_payments = round(sum(_num(p.get("amount")) for p in payments), 2)
        return {
            "total_customers": len(customers),
            "total_transactions": len(txns),
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "total_payments": total_payments,
            "net_profit": round(total_revenue - total_expenses, 2),
            "outstanding": round(total_revenue - total_payments, 2),
        }

    @router.get("/customers/summary", dependencies=[Depends(require_capability("customer:read"))])
    async def customers_summary(repo: LaundryRepository = Depends(get_laundry_repo)):
        customers = await repo.all_docs("customers", CUSTOMER_SENSITIVE)
        active = [c for c in customers if c.get("is_active", True)]
        by_type: dict[str, int] = {}
        for c in customers:
            key = str(c.get("customer_type") or "unspecified")
            by_type[key] = by_type.get(key, 0) + 1
        return {"total": len(customers), "active": len(active), "by_type": by_type}

    @router.get("/expenses/summary", dependencies=[Depends(require_capability("expense:read"))])
    async def expenses_summary(repo: LaundryRepository = Depends(get_laundry_repo)):
        expenses = await repo.all_docs("expenses", EXPENSE_SENSITIVE)
        categories = await repo.all_docs("expense_categories", ["name"])
        cat_names = {c.get("id"): c.get("name") for c in categories}
        by_category: dict[str, float] = {}
        for e in expenses:
            label = cat_names.get(str(e.get("category_id")), "Uncategorized") or "Uncategorized"
            by_category[label] = by_category.get(label, 0.0) + _num(e.get("amount"))
        return {
            "total": round(sum(_num(e.get("amount")) for e in expenses), 2),
            "count": len(expenses),
            "by_category": {k: round(v, 2) for k, v in by_category.items()},
        }

    @router.get("/holidays/check/{date}", dependencies=[Depends(require_capability("management:read"))])
    async def holidays_check(date: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        matches = await repo.all_docs("holidays", [], {"date": date})
        return {
            "date": date,
            "is_holiday": bool(matches),
            "holiday": matches[0] if matches else None,
        }

    @router.get("/employees/{employee_id}/advances", dependencies=[Depends(require_capability("salary:read"))])
    async def employee_advances(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        return await repo.all_docs("salary_advances", [], {"employee_id": employee_id})

    @router.get("/employees/{employee_id}/attendance", dependencies=[Depends(require_capability("employee:read"))])
    async def employee_attendance(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        return await repo.all_docs("attendance", [], {"employee_id": employee_id})

    @router.get("/employees/{employee_id}/salaries", dependencies=[Depends(require_capability("salary:read"))])
    async def employee_salaries(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        return await repo.all_docs("salary_slips", SALARY_SENSITIVE, {"employee_id": employee_id})

    @router.get("/employees/{employee_id}/salary-history", dependencies=[Depends(require_capability("salary:read"))])
    async def employee_salary_history(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        slips = await repo.all_docs("salary_slips", SALARY_SENSITIVE, {"employee_id": employee_id})
        slips.sort(key=lambda s: str(s.get("period_start") or ""))
        return slips

    @router.post("/employees/{employee_id}/activate", dependencies=[Depends(require_capability("employee:write"))])
    async def employee_activate(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        updated = await repo.update("employees", EMPLOYEE_SENSITIVE, employee_id, {"is_active": True})
        if not updated:
            raise HTTPException(status_code=404, detail="Employee not found")
        return updated

    @router.get("/company-settings", dependencies=[Depends(require_capability("management:read"))])
    async def get_company_settings(repo: LaundryRepository = Depends(get_laundry_repo)):
        docs = await repo.all_docs("company_settings", [])
        return docs[0] if docs else {}

    @router.put("/company-settings", dependencies=[Depends(require_capability("management:write"))])
    async def put_company_settings(
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        docs = await repo.all_docs("company_settings", [])
        if docs:
            return await repo.update("company_settings", [], docs[0]["id"], payload)
        return await repo.create("company_settings", [], payload)

    @router.post("/attendance/bulk", status_code=201, dependencies=[Depends(require_capability("employee:write"))])
    async def attendance_bulk(
        payload: list[dict] = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        created = []
        for record in payload:
            created.append(await repo.create("attendance", [], record))
        return {"created": len(created), "items": created}

    @router.get("/customers/{customer_id}/rates", dependencies=[Depends(require_capability("customer:read"))])
    async def customer_rates(customer_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        return await repo.all_docs("customer_rates", [], {"customer_id": customer_id})

    @router.post("/customers/{customer_id}/rates", status_code=201, dependencies=[Depends(require_capability("customer:write"))])
    async def create_customer_rate(
        customer_id: str,
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        return await repo.create("customer_rates", [], {**payload, "customer_id": customer_id})
