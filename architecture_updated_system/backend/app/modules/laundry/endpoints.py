"""Custom laundry endpoints beyond generic CRUD: derived summaries, bulk
loading, salary-slip lifecycle, financial reports and CSV/XLSX import.

Shapes follow the legacy routers. Two documented divergences (see
``docs/current_checkpoint.md``):

- Salary *expense* in the daily/monthly reports is derived from stored
  ``salary_slips`` (status FINALIZED/PAID) rather than the full legacy payroll
  accrual engine, which is a separate backlog item.
- Import supports CSV natively; XLSX requires the optional ``openpyxl`` extra.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from ...core.capabilities import require_capability
from ...core.clock import this_month_number, this_year, today_str
from .deps import get_laundry_repo
from .repository import LaundryRepository

TXN_SENSITIVE = ["customer_name", "invoice_number", "items", "notes"]
EXPENSE_SENSITIVE = ["description", "reference", "notes"]
SALARY_SENSITIVE = ["notes"]
CUSTOMER_SENSITIVE = ["name", "contact_person", "phone", "email", "address", "notes"]
ITEM_SENSITIVE = ["name"]
IMPORT_SENSITIVE = ["file_name", "errors", "notes"]

PAID_STATUSES = {"FINALIZED", "PAID"}

TEMPLATE_HEADERS = [
    "Date", "Customer Name", "Invoice Number", "Item Name",
    "Qty Received", "Qty Washed", "Qty Delivered", "Qty Rejected", "Qty Damaged",
    "Rate", "Cost", "Notes",
]
COLUMN_KEYS = {
    0: "date", 1: "customer_name", 2: "invoice_number", 3: "item_name",
    4: "qty_received", 5: "qty_washed", 6: "qty_delivered", 7: "qty_rejected",
    8: "qty_damaged", 9: "rate", 10: "cost", 11: "notes",
}


def _num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _today() -> str:
    return today_str()


def _slip_amount(slip: dict) -> float:
    return _num(slip.get("net_pay") or slip.get("total_pay") or slip.get("net_salary") or slip.get("amount"))


async def _transactions(repo: LaundryRepository, query: dict) -> list[dict]:
    return await repo.all_docs("transactions", TXN_SENSITIVE, query)


async def _expenses(repo: LaundryRepository, query: dict) -> list[dict]:
    return await repo.all_docs("expenses", EXPENSE_SENSITIVE, query)


async def _salary_expense(repo: LaundryRepository, start: str, end: str) -> float:
    """Payroll expense from stored slips overlapping [start, end] (see module docstring)."""
    slips = await repo.all_docs("salary_slips", SALARY_SENSITIVE)
    total = 0.0
    for s in slips:
        if str(s.get("status") or "").upper() not in PAID_STATUSES:
            continue
        ps = str(s.get("period_start") or s.get("date") or "")
        if not ps or start <= ps <= end:
            total += _slip_amount(s)
    return round(total, 2)


def _require_period(start_date: Optional[str], end_date: Optional[str]) -> None:
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="Both start_date and end_date are required.")
    try:
        start = date_type.fromisoformat(start_date)
        end = date_type.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if end < start:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date.")


def _summaries_from_transactions(txns: list[dict]) -> tuple[list, list]:
    """Hotel-wise and item-wise rollups (pure), shared by both report endpoints."""
    hotels: dict = {}
    items: dict = {}
    for txn in txns:
        cid = str(txn.get("customer_id") or "")
        name = (txn.get("customer_name") or "Unknown").strip() or "Unknown"
        hotel = hotels.setdefault(cid or name, {
            "client_name": name, "customer_id": cid or None, "transactions": 0,
            "total_quantity": 0.0, "total_revenue": 0.0, "total_cost": 0.0,
            "gross_profit": 0.0, "items": {},
        })
        hotel["transactions"] += 1
        hotel["total_quantity"] += _num(txn.get("total_quantity"))
        hotel["total_revenue"] += _num(txn.get("total_amount"))
        hotel["total_cost"] += _num(txn.get("total_cost"))
        for it in txn.get("items") or []:
            item_name = (it.get("item_name") or "Unknown").strip() or "Unknown"
            category = it.get("category_name") or "Uncategorized"
            row = items.setdefault((item_name, category), {
                "item_name": item_name, "category_name": category, "total_quantity": 0.0,
                "total_revenue": 0.0, "total_cost": 0.0, "gross_profit": 0.0, "clients": set(),
            })
            qty = _num(it.get("quantity_washed")) or _num(it.get("quantity_received"))
            row["total_quantity"] += qty
            row["total_revenue"] += _num(it.get("line_total"))
            row["total_cost"] += _num(it.get("line_cost"))
            row["clients"].add(name)
            hotel["items"][item_name] = hotel["items"].get(item_name, 0.0) + qty

    hotel_rows = []
    for hotel in hotels.values():
        hotel["total_quantity"] = round(hotel["total_quantity"], 2)
        hotel["total_revenue"] = round(hotel["total_revenue"], 2)
        hotel["total_cost"] = round(hotel["total_cost"], 2)
        hotel["gross_profit"] = round(hotel["total_revenue"] - hotel["total_cost"], 2)
        hotel["items"] = [
            {"item_name": k, "quantity": round(v, 2)}
            for k, v in sorted(hotel["items"].items(), key=lambda kv: kv[1], reverse=True)
        ]
        hotel_rows.append(hotel)
    hotel_rows.sort(key=lambda h: h["total_revenue"], reverse=True)

    item_rows = []
    for row in items.values():
        row["total_quantity"] = round(row["total_quantity"], 2)
        row["total_revenue"] = round(row["total_revenue"], 2)
        row["total_cost"] = round(row["total_cost"], 2)
        row["gross_profit"] = round(row["total_revenue"] - row["total_cost"], 2)
        row["client_count"] = len(row["clients"])
        row["clients"] = sorted(row["clients"])
        item_rows.append(row)
    item_rows.sort(key=lambda i: i["total_revenue"], reverse=True)

    return hotel_rows, item_rows


def _tpl_headers_csv() -> str:
    return ",".join(TEMPLATE_HEADERS) + "\n"


def _parse_rows(content: bytes, filename: str) -> list[dict]:
    name = (filename or "").lower()
    if name.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        data = list(csv.reader(io.StringIO(text)))
    else:
        try:
            from openpyxl import load_workbook
        except ImportError:
            raise HTTPException(
                status_code=400,
                detail="XLSX import requires the optional 'openpyxl' extra; upload CSV instead.",
            )
        wb = load_workbook(io.BytesIO(content), data_only=True)
        data = list(wb.active.iter_rows(values_only=True))
    if not data:
        return []
    rows = []
    for line in data[1:]:
        if not any(str(c or "").strip() for c in line):
            continue
        rows.append({key: (line[idx] if idx < len(line) else None) for idx, key in COLUMN_KEYS.items()})
    return rows


def _fmt_date(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date_type):
        return value.isoformat()
    s = str(value or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s.split(" ")[0], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


def _validate_row(row: dict, row_num: int) -> dict:
    errors: list[str] = []
    rec = {
        "row": row_num,
        "date": _fmt_date(row.get("date")),
        "customer_name": str(row.get("customer_name") or "").strip(),
        "invoice_number": str(row.get("invoice_number") or "").strip(),
        "item_name": str(row.get("item_name") or "").strip(),
        "qty_received": _num(row.get("qty_received")),
        "qty_washed": _num(row.get("qty_washed")),
        "qty_delivered": _num(row.get("qty_delivered")),
        "qty_rejected": _num(row.get("qty_rejected")),
        "qty_damaged": _num(row.get("qty_damaged")),
        "rate": _num(row.get("rate")),
        "cost": _num(row.get("cost")),
        "notes": str(row.get("notes") or "").strip(),
    }
    if not rec["date"]:
        errors.append("Date is required")
    else:
        try:
            date_type.fromisoformat(rec["date"])
        except ValueError:
            errors.append("Invalid date. Use YYYY-MM-DD")
    if not rec["customer_name"]:
        errors.append("Customer Name is required")
    if not rec["item_name"]:
        errors.append("Item Name is required")
    if rec["qty_received"] <= 0 and rec["qty_washed"] <= 0:
        errors.append("Quantity (Received or Washed) must be greater than 0")
    rec["valid"] = not errors
    rec["errors"] = errors
    return rec


async def _find_or_create_customer(repo: LaundryRepository, name: str) -> str:
    cleaned = name.strip()
    for c in await repo.all_docs("customers", CUSTOMER_SENSITIVE):
        if str(c.get("name") or "").strip().lower() == cleaned.lower():
            return c["id"]
    doc = await repo.create(
        "customers",
        CUSTOMER_SENSITIVE,
        {"name": cleaned, "customer_type": "INDIVIDUAL", "is_active": True},
    )
    return doc["id"]


async def _find_or_create_item(repo: LaundryRepository, name: str) -> tuple[str, Optional[str]]:
    cleaned = name.strip()
    for it in await repo.all_docs("items", ITEM_SENSITIVE):
        if str(it.get("name") or "").strip().lower() == cleaned.lower():
            return it["id"], it.get("category_id")
    doc = await repo.create(
        "items",
        ITEM_SENSITIVE,
        {"name": cleaned, "category_id": None, "unit": "PIECE", "is_active": True},
    )
    return doc["id"], doc.get("category_id")


async def _require_slip(repo: LaundryRepository, slip_id: str, status: str) -> dict:
    updated = await repo.update("salary_slips", SALARY_SENSITIVE, slip_id, {"status": status})
    if not updated:
        raise HTTPException(status_code=404, detail="Salary slip not found")
    return updated


def register_endpoints(router: APIRouter) -> None:
    # ── advances ────────────────────────────────────────────────────────────
    @router.get("/employees/{employee_id}/advances/summary",
                dependencies=[Depends(require_capability("salary:read"))])
    async def advances_summary(employee_id: str, repo: LaundryRepository = Depends(get_laundry_repo)):
        adv = await repo.all_docs("salary_advances", [], {"employee_id": employee_id, "status": "OUTSTANDING"})
        return {
            "total_outstanding": round(sum(_num(a.get("outstanding")) for a in adv), 2),
            "count": len(adv),
        }

    # ── employee salaries / attendance ──────────────────────────────────────
    @router.post("/employees/{employee_id}/salaries", status_code=201,
                 dependencies=[Depends(require_capability("salary:write"))])
    async def create_employee_salary(
        employee_id: str,
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        return await repo.create("salary_slips", SALARY_SENSITIVE, {**payload, "employee_id": employee_id})

    @router.put("/employees/{employee_id}/salaries/{salary_id}",
                dependencies=[Depends(require_capability("salary:write"))])
    async def update_employee_salary(
        employee_id: str,
        salary_id: str,
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        updated = await repo.update("salary_slips", SALARY_SENSITIVE, salary_id, payload)
        if not updated:
            raise HTTPException(status_code=404, detail="Salary slip not found")
        return updated

    @router.post("/employees/{employee_id}/attendance", status_code=201,
                 dependencies=[Depends(require_capability("employee:write"))])
    async def create_employee_attendance(
        employee_id: str,
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        return await repo.create("attendance", [], {**payload, "employee_id": employee_id})

    # ── salary slip lifecycle ───────────────────────────────────────────────
    for _action, _status in (("finalize", "FINALIZED"), ("cancel", "CANCELLED"), ("pay", "PAID")):
        @router.post(f"/salary/slips/{{slip_id}}/{_action}",
                     name=f"salary_slip_{_action}",
                     dependencies=[Depends(require_capability("salary:write"))])
        async def _transition(
            slip_id: str,
            repo: LaundryRepository = Depends(get_laundry_repo),
            _s: str = _status,
        ):
            return await _require_slip(repo, slip_id, _s)

    # ── bulk loading ────────────────────────────────────────────────────────
    @router.post("/transactions/bulk", status_code=201,
                 dependencies=[Depends(require_capability("transaction:write"))])
    async def transactions_bulk(
        payload: list[dict] = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        created = [await repo.create("transactions", TXN_SENSITIVE, row) for row in payload]
        return {"created": len(created), "items": created}

    @router.post("/attendance/bulk-day", status_code=201,
                 dependencies=[Depends(require_capability("employee:write"))])
    async def attendance_bulk_day(
        payload: dict = Body(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        day = payload.get("date")
        records = payload.get("records")
        if records is None:
            records = [
                {"employee_id": eid, "status": payload.get("status", "PRESENT")}
                for eid in payload.get("employee_ids", [])
            ]
        created = [
            await repo.create("attendance", [], {**rec, "date": rec.get("date") or day})
            for rec in records
        ]
        return {"created": len(created), "items": created}

    @router.get("/attendance/summary", dependencies=[Depends(require_capability("employee:read"))])
    async def attendance_summary(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        query: dict = {}
        if start_date or end_date:
            rng: dict = {}
            if start_date:
                rng["$gte"] = start_date
            if end_date:
                rng["$lte"] = end_date
            query["date"] = rng
        rows = await repo.all_docs("attendance", [], query)
        by_status: dict[str, int] = {}
        by_employee: dict[str, int] = {}
        for r in rows:
            by_status[str(r.get("status") or "UNKNOWN")] = by_status.get(str(r.get("status") or "UNKNOWN"), 0) + 1
            by_employee[str(r.get("employee_id"))] = by_employee.get(str(r.get("employee_id")), 0) + 1
        return {"total": len(rows), "by_status": by_status, "by_employee": by_employee}

    # ── customer rates ──────────────────────────────────────────────────────
    @router.delete("/customers/{customer_id}/rates/{rate_id}",
                   dependencies=[Depends(require_capability("customer:write"))])
    async def delete_customer_rate(
        customer_id: str,
        rate_id: str,
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        if not await repo.delete("customer_rates", rate_id):
            raise HTTPException(status_code=404, detail="Rate not found")
        return {"success": True}

    # ── reports ─────────────────────────────────────────────────────────────
    @router.get("/reports/profit-loss", dependencies=[Depends(require_capability("report:read"))])
    async def profit_loss(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        customer_id: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        q: dict = {}
        if start_date or end_date:
            rng: dict = {}
            if start_date:
                rng["$gte"] = start_date
            if end_date:
                rng["$lte"] = end_date
            q["transaction_date"] = rng
        if customer_id:
            q["customer_id"] = customer_id
        txns = await _transactions(repo, q)

        eq: dict = {}
        if start_date or end_date:
            rng = {}
            if start_date:
                rng["$gte"] = start_date
            if end_date:
                rng["$lte"] = end_date
            eq["date"] = rng
        expenses = await _expenses(repo, eq)

        revenue = round(sum(_num(t.get("total_amount")) for t in txns), 2)
        cogs = round(sum(_num(t.get("total_cost")) for t in txns), 2)
        other = round(sum(_num(e.get("amount")) for e in expenses), 2)

        by_customer: dict = {}
        by_category: dict = {}
        for t in txns:
            key = str(t.get("customer_id") or t.get("customer_name") or "Unknown")
            row = by_customer.setdefault(key, {"name": t.get("customer_name") or "Unknown", "value": 0.0})
            row["value"] += _num(t.get("total_amount"))
            for it in t.get("items") or []:
                cname = it.get("category_name") or it.get("category_id") or "Uncategorized"
                by_category[cname] = by_category.get(cname, 0.0) + _num(it.get("line_total"))
        by_exp_cat: dict = {}
        for e in expenses:
            name = e.get("category_name") or e.get("category_id") or "Uncategorized"
            by_exp_cat[name] = by_exp_cat.get(name, 0.0) + _num(e.get("amount"))

        return {
            "total_revenue": revenue,
            "total_cogs": cogs,
            "gross_profit": round(revenue - cogs, 2),
            "total_expenses": other,
            "net_profit": round(revenue - cogs - other, 2),
            "revenue_by_customer": [
                {"name": r["name"], "value": round(r["value"], 2)}
                for r in sorted(by_customer.values(), key=lambda x: x["value"], reverse=True)
            ],
            "revenue_by_category": [
                {"name": k, "value": round(v, 2)}
                for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
            ],
            "expenses_by_category": [
                {"name": k, "value": round(v, 2)}
                for k, v in sorted(by_exp_cat.items(), key=lambda x: x[1], reverse=True)
            ],
        }

    async def _day_row(repo: LaundryRepository, day: str) -> dict:
        txns = await _transactions(repo, {"transaction_date": day})
        expenses = await _expenses(repo, {"date": day})
        revenue = round(sum(_num(t.get("total_amount")) for t in txns), 2)
        cogs = round(sum(_num(t.get("total_cost")) for t in txns), 2)
        other = round(sum(_num(e.get("amount")) for e in expenses), 2)
        salary = await _salary_expense(repo, day, day)
        return {
            "date": day,
            "transactions": len(txns),
            "total_quantity": round(sum(_num(t.get("total_quantity")) for t in txns), 2),
            "total_revenue": revenue,
            "other_expense_total": other,
            "salary_expense_total": salary,
            "total_expenses": round(other + salary, 2),
            "gross_profit": round(revenue - cogs, 2),
            "net_profit": round(revenue - cogs - other - salary, 2),
        }

    @router.get("/reports/daily", dependencies=[Depends(require_capability("report:read"))])
    async def daily_report(
        date: Optional[str] = Query(None),
        report_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        selected = date or report_date or _today()
        try:
            date_type.fromisoformat(selected)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        return await _day_row(repo, selected)

    @router.get("/reports/range", dependencies=[Depends(require_capability("report:read"))])
    async def range_report(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Both start_date and end_date are required.")
        try:
            start = date_type.fromisoformat(start_date)
            end = date_type.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        if end < start:
            raise HTTPException(status_code=400, detail="end_date must be on or after start_date.")

        rows = []
        current = start
        while current <= end:
            rows.append(await _day_row(repo, current.isoformat()))
            current += timedelta(days=1)
        return {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "days": len(rows),
            "transactions": sum(r["transactions"] for r in rows),
            "total_quantity": round(sum(r["total_quantity"] for r in rows), 2),
            "total_revenue": round(sum(r["total_revenue"] for r in rows), 2),
            "total_expenses": round(sum(r["total_expenses"] for r in rows), 2),
            "gross_profit": round(sum(r["gross_profit"] for r in rows), 2),
            "net_profit": round(sum(r["net_profit"] for r in rows), 2),
            "daily": rows,
        }

    @router.get("/reports/monthly", dependencies=[Depends(require_capability("report:read"))])
    async def monthly_report(
        year: int = Query(this_year()),
        month: int = Query(this_month_number()),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        start = f"{year:04d}-{month:02d}-01"
        end = f"{year + 1:04d}-01-01" if month == 12 else f"{year:04d}-{month + 1:02d}-01"
        txns = await _transactions(repo, {"transaction_date": {"$gte": start, "$lt": end}})
        expenses = await _expenses(repo, {"date": {"$gte": start, "$lt": end}})
        revenue = round(sum(_num(t.get("total_amount")) for t in txns), 2)
        cogs = round(sum(_num(t.get("total_cost")) for t in txns), 2)
        other = round(sum(_num(e.get("amount")) for e in expenses), 2)
        salary = await _salary_expense(repo, start, (date_type.fromisoformat(end) - timedelta(days=1)).isoformat())
        by_customer: dict = {}
        for t in txns:
            key = str(t.get("customer_id") or t.get("customer_name") or "Unknown")
            row = by_customer.setdefault(key, {"name": t.get("customer_name") or "Unknown", "value": 0.0})
            row["value"] += _num(t.get("total_amount"))
        return {
            "year": year,
            "month": month,
            "transactions": len(txns),
            "total_quantity": round(sum(_num(t.get("total_quantity")) for t in txns), 2),
            "total_revenue": revenue,
            "other_expense_total": other,
            "salary_expense_total": salary,
            "total_expenses": round(other + salary, 2),
            "gross_profit": round(revenue - cogs, 2),
            "net_profit": round(revenue - cogs - other - salary, 2),
            "revenue_by_customer": [
                {"name": r["name"], "value": round(r["value"], 2)}
                for r in sorted(by_customer.values(), key=lambda x: x["value"], reverse=True)
            ],
        }

    @router.get("/reports/outstanding", dependencies=[Depends(require_capability("report:read"))])
    async def outstanding(repo: LaundryRepository = Depends(get_laundry_repo)):
        billed: dict = {}
        for t in await _transactions(repo, {}):
            key = str(t.get("customer_id") or "")
            row = billed.setdefault(key, {"name": t.get("customer_name") or "Unknown", "billed": 0.0})
            row["billed"] += _num(t.get("total_amount"))
            row["name"] = t.get("customer_name") or row["name"]
        paid: dict = {}
        for p in await repo.all_docs("payments", ["customer_name", "reference", "notes"]):
            key = str(p.get("customer_id") or "")
            paid[key] = paid.get(key, 0.0) + _num(p.get("amount"))
        result = []
        for key in set(billed) | set(paid):
            b = billed.get(key, {}).get("billed", 0.0)
            amount_paid = paid.get(key, 0.0)
            outstanding_amt = max(b - amount_paid, 0.0)
            if outstanding_amt > 0 or b > 0:
                result.append({
                    "customer_id": key,
                    "customer_name": billed.get(key, {}).get("name") or "Unknown",
                    "total_billed": round(b, 2),
                    "total_paid": round(amount_paid, 2),
                    "outstanding": round(outstanding_amt, 2),
                })
        result.sort(key=lambda x: x["outstanding"], reverse=True)
        return result

    @router.get("/reports/hotel-wise", dependencies=[Depends(require_capability("report:read"))])
    async def hotel_wise(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        _require_period(start_date, end_date)
        txns = await _transactions(repo, {"transaction_date": {"$gte": start_date, "$lte": end_date}})
        hotel_rows, _ = _summaries_from_transactions(txns)
        return hotel_rows

    @router.get("/reports/item-wise", dependencies=[Depends(require_capability("report:read"))])
    async def item_wise(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        _require_period(start_date, end_date)
        txns = await _transactions(repo, {"transaction_date": {"$gte": start_date, "$lte": end_date}})
        _, item_rows = _summaries_from_transactions(txns)
        return item_rows

    @router.get("/reports/master", dependencies=[Depends(require_capability("report:read"))])
    async def master_report(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        _require_period(start_date, end_date)
        expenses = await _expenses(repo, {"date": {"$gte": start_date, "$lte": end_date}})
        other = round(sum(_num(e.get("amount")) for e in expenses), 2)
        salary = await _salary_expense(repo, start_date, end_date)
        return {
            "source_of_truth": "management_payroll_and_expenses",
            "other_expense_total": other,
            "salary_expense_total": salary,
            "total_expenses": round(other + salary, 2),
            "salary_period_details": {"start_date": start_date, "end_date": end_date},
            "other_expense_details": expenses,
            "start_date": start_date,
            "end_date": end_date,
        }

    @router.get("/reports/health", dependencies=[Depends(require_capability("report:read"))])
    async def reports_health():
        return {
            "status": "ok",
            "service": "laundry-management-reports",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {"transactions": "available", "expenses": "available"},
        }

    @router.get("/reports/data-quality", dependencies=[Depends(require_capability("report:read"))])
    async def data_quality(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Both start_date and end_date are required.")
        try:
            start = date_type.fromisoformat(start_date)
            end = date_type.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
        if end < start:
            raise HTTPException(status_code=400, detail="end_date must be on or after start_date.")
        all_txns = await _transactions(repo, {"transaction_date": {"$gte": start_date, "$lte": end_date}})
        all_exp = await _expenses(repo, {"date": {"$gte": start_date, "$lte": end_date}})
        txn_days = {str(t.get("transaction_date")) for t in all_txns}
        exp_days = {str(e.get("date")) for e in all_exp}
        missing = []
        current = start
        while current <= end:
            day = current.isoformat()
            if day not in txn_days and day not in exp_days:
                missing.append(day)
            current += timedelta(days=1)
        return {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "missing_data_days": missing,
            "missing_data_count": len(missing),
            "status": "complete" if not missing else "incomplete_data",
        }

    # ── import / export ─────────────────────────────────────────────────────
    @router.get("/import/template", dependencies=[Depends(require_capability("import:write"))])
    async def import_template():
        try:
            from openpyxl import Workbook
        except ImportError:
            return StreamingResponse(
                io.StringIO(_tpl_headers_csv()),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=laundry_import_template.csv"},
            )
        wb = Workbook()
        ws = wb.active
        ws.title = "Laundry Import"
        ws.append(TEMPLATE_HEADERS)
        ws.append(["2026-01-05", "Sunshine Hotel", "INV-1001", "Shirt", 20, 20, 18, 2, 0, 150, 80, "Sample row"])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=laundry_import_template.xlsx"},
        )

    @router.post("/import/preview", dependencies=[Depends(require_capability("import:write"))])
    async def import_preview(file: UploadFile = File(...)):
        rows = _parse_rows(await file.read(), file.filename or "")
        if not rows:
            raise HTTPException(status_code=400, detail="Could not read file. Use the provided template.")
        preview = [_validate_row(r, i) for i, r in enumerate(rows, start=2)]
        errors = [{"row": r["row"], "errors": r["errors"]} for r in preview if not r["valid"]]
        return {"total_rows": len(preview), "preview": preview, "errors": errors}

    @router.post("/import/execute", dependencies=[Depends(require_capability("import:write"))])
    async def import_execute(
        file: UploadFile = File(...),
        repo: LaundryRepository = Depends(get_laundry_repo),
    ):
        rows = _parse_rows(await file.read(), file.filename or "")
        if not rows:
            raise HTTPException(status_code=400, detail="Could not read file. Use the provided template.")
        validated = [_validate_row(r, i) for i, r in enumerate(rows, start=2)]
        valid_rows = [r for r in validated if r["valid"]]
        error_rows = [r for r in validated if not r["valid"]]

        groups: dict = {}
        order: list = []
        for rec in valid_rows:
            key = (rec["date"], rec["customer_name"], rec["invoice_number"])
            if key not in groups:
                order.append(key)
                groups[key] = {"date": rec["date"], "customer": rec["customer_name"],
                               "invoice": rec["invoice_number"], "items": []}
            groups[key]["items"].append(rec)

        batch_id = str(uuid.uuid4())
        created = 0
        for key in order:
            grp = groups[key]
            customer_id = await _find_or_create_customer(repo, grp["customer"])
            items = []
            for rec in grp["items"]:
                item_id, _ = await _find_or_create_item(repo, rec["item_name"])
                qty = rec["qty_washed"] if rec["qty_washed"] > 0 else rec["qty_received"]
                items.append({
                    "item_id": item_id,
                    "item_name": rec["item_name"],
                    "quantity_received": rec["qty_received"],
                    "quantity_washed": rec["qty_washed"],
                    "quantity_delivered": rec["qty_delivered"],
                    "quantity_rejected": rec["qty_rejected"],
                    "quantity_damaged": rec["qty_damaged"],
                    "rate": rec["rate"],
                    "cost": rec["cost"],
                    "line_total": round(qty * rec["rate"], 2),
                    "line_cost": round(qty * rec["cost"], 2),
                    "line_profit": round(qty * (rec["rate"] - rec["cost"]), 2),
                    "status": "RECEIVED",
                    "notes": rec["notes"] or None,
                })
            await repo.create("transactions", TXN_SENSITIVE, {
                "transaction_date": grp["date"],
                "customer_id": customer_id,
                "customer_name": grp["customer"],
                "invoice_number": grp["invoice"] or None,
                "status": "COMPLETED",
                "source": "IMPORT",
                "import_batch_id": batch_id,
                "items": items,
                "total_quantity": round(sum(_num(i["quantity_washed"]) or _num(i["quantity_received"]) for i in items), 2),
                "total_amount": round(sum(_num(i["line_total"]) for i in items), 2),
                "total_cost": round(sum(_num(i["line_cost"]) for i in items), 2),
                "total_profit": round(sum(_num(i["line_profit"]) for i in items), 2),
            })
            created += 1

        await repo.create("imports", IMPORT_SENSITIVE, {
            "file_name": file.filename or "upload",
            "batch_id": batch_id,
            "status": "IMPORTED",
            "total_rows": len(validated),
            "success_rows": len(valid_rows),
            "error_rows": len(error_rows),
            "errors": [{"row": r["row"], "errors": r["errors"]} for r in error_rows],
        })
        return {
            "total_rows": len(validated),
            "success_rows": len(valid_rows),
            "error_rows": len(error_rows),
            "transactions_created": created,
            "batch_id": batch_id,
        }

    @router.get("/import/history", dependencies=[Depends(require_capability("import:write"))])
    async def import_history(repo: LaundryRepository = Depends(get_laundry_repo)):
        return await repo.all_docs("imports", IMPORT_SENSITIVE)
