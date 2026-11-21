"""Billing data access with idempotent invoice-run enforcement."""

from __future__ import annotations

from pymongo.errors import DuplicateKeyError

from ..events.models import utc_now


class BillingRepository:
    async def list_transactions(
        self, organization_id: str, hotel_id: str, start: str, end: str
    ) -> list[dict]:
        raise NotImplementedError

    async def list_all_transactions(
        self, organization_id: str, limit: int = 5000
    ) -> list[dict]:
        raise NotImplementedError

    async def record_validated_transaction(self, transaction: dict) -> bool:
        """Store one billable operational event exactly once."""
        raise NotImplementedError

    async def rate_for(
        self, organization_id: str, service: str, occurred_at: str
    ) -> dict | None:
        raise NotImplementedError

    async def find_run(self, idempotency_key: str) -> dict | None:
        raise NotImplementedError

    async def find_run_by_scope(
        self, organization_id: str, hotel_id: str, start: str, end: str
    ) -> dict | None:
        raise NotImplementedError

    async def save_run(self, run: dict) -> dict:
        raise NotImplementedError

    async def save_invoice(self, invoice: dict) -> dict:
        raise NotImplementedError

    async def get_invoice(self, invoice_id: str) -> dict | None:
        raise NotImplementedError

    async def list_invoices(self, organization_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def mark_transactions_billed(self, transaction_ids: list[str], invoice_id: str) -> None:
        raise NotImplementedError

    async def save_payment(self, payment: dict) -> bool:
        """Store a payment once. False means an idempotent duplicate."""
        raise NotImplementedError

    async def list_payments(self, invoice_id: str) -> list[dict]:
        raise NotImplementedError


class InMemoryBillingRepository(BillingRepository):
    def __init__(self) -> None:
        self.transactions: dict[str, dict] = {}
        self.rates: dict[str, dict] = {}
        self.runs: dict[str, dict] = {}
        self.invoices: dict[str, dict] = {}
        self.payments: dict[str, dict] = {}

    async def list_transactions(self, organization_id, hotel_id, start, end):
        return [
            dict(row)
            for row in self.transactions.values()
            if row.get("organization_id") == organization_id
            and row.get("hotel_id") == hotel_id
            and start <= str(row.get("occurred_at") or "")[:10] <= end
            and not row.get("billed_invoice_id")
        ]

    async def list_all_transactions(self, organization_id, limit=5000):
        return [
            dict(row)
            for row in self.transactions.values()
            if row.get("organization_id") == organization_id
        ][:limit]

    async def record_validated_transaction(self, transaction):
        key = transaction["transaction_id"]
        if key in self.transactions:
            return False
        self.transactions[key] = dict(transaction)
        return True

    async def rate_for(self, organization_id, service, occurred_at):
        candidates = [
            row
            for row in self.rates.values()
            if row.get("organization_id") == organization_id and row.get("service") == service
        ]
        candidates = [
            row
            for row in candidates
            if str(row.get("effective_from") or "")[:10] <= occurred_at[:10]
            and (
                not row.get("effective_to")
                or occurred_at[:10] <= str(row["effective_to"])[:10]
            )
        ]
        return dict(candidates[-1]) if candidates else None

    async def find_run(self, idempotency_key):
        row = self.runs.get(idempotency_key)
        return dict(row) if row is not None else None

    async def find_run_by_scope(self, organization_id, hotel_id, start, end):
        matches = [
            row
            for row in self.runs.values()
            if row.get("organization_id") == organization_id
            and row.get("hotel_id") == hotel_id
            and row.get("period_start") == start
            and row.get("period_end") == end
            and row.get("invoice_id")
        ]
        matches.sort(key=lambda row: str(row.get("created_at") or ""), reverse=True)
        return dict(matches[0]) if matches else None

    async def save_run(self, run):
        self.runs[run["idempotency_key"]] = dict(run)
        return dict(run)

    async def save_invoice(self, invoice):
        self.invoices[invoice["invoice_id"]] = dict(invoice)
        return dict(invoice)

    async def get_invoice(self, invoice_id):
        invoice = self.invoices.get(invoice_id)
        return dict(invoice) if invoice is not None else None

    async def list_invoices(self, organization_id, limit=200):
        return [
            dict(row)
            for row in self.invoices.values()
            if row.get("organization_id") == organization_id
        ][:limit]

    async def mark_transactions_billed(self, transaction_ids, invoice_id):
        for transaction_id in transaction_ids:
            row = self.transactions.get(transaction_id)
            if row is not None:
                row["billed_invoice_id"] = invoice_id

    async def save_payment(self, payment):
        if payment["payment_id"] in self.payments:
            return False
        self.payments[payment["payment_id"]] = dict(payment)
        return True

    async def list_payments(self, invoice_id):
        return [
            dict(row)
            for row in self.payments.values()
            if row.get("invoice_id") == invoice_id
        ]


class MongoBillingRepository(BillingRepository):
    def __init__(self, database) -> None:
        self.database = database
        self.transactions = database["billing_transactions"]
        self.rates = database["rate_cards"]
        self.runs = database["billing_runs"]
        self.invoices = database["invoices"]
        self.lines = database["invoice_lines"]
        self.payments = database["payments"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def list_transactions(self, organization_id, hotel_id, start, end):
        cursor = self.transactions.find(
            {
                "organization_id": organization_id,
                "hotel_id": hotel_id,
                "occurred_at": {"$gte": start, "$lte": f"{end}"},
                "$or": [
                    {"billed_invoice_id": {"$exists": False}},
                    {"billed_invoice_id": ""},
                ],
            }
        )
        return [self._clean(row) or {} for row in await cursor.to_list(length=5000)]

    async def list_all_transactions(self, organization_id, limit=5000):
        cursor = self.transactions.find({"organization_id": organization_id}).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def record_validated_transaction(self, transaction):
        try:
            await self.transactions.insert_one(dict(transaction))
            return True
        except DuplicateKeyError:
            return False

    async def rate_for(self, organization_id, service, occurred_at):
        cursor = (
            self.rates.find(
                {
                    "organization_id": organization_id,
                    "service": service,
                    "effective_from": {"$lte": occurred_at[:10]},
                    "$or": [
                        {"effective_to": {"$exists": False}},
                        {"effective_to": ""},
                        {"effective_to": {"$gte": occurred_at[:10]}},
                    ],
                }
            )
            .sort("effective_from", -1)
            .limit(1)
        )
        rows = await cursor.to_list(length=1)
        return self._clean(rows[0]) if rows else None

    async def find_run(self, idempotency_key):
        return self._clean(await self.runs.find_one({"idempotency_key": idempotency_key}))

    async def find_run_by_scope(self, organization_id, hotel_id, start, end):
        cursor = (
            self.runs.find(
                {
                    "organization_id": organization_id,
                    "hotel_id": hotel_id,
                    "period_start": start,
                    "period_end": end,
                    "invoice_id": {"$exists": True, "$ne": ""},
                }
            )
            .sort("created_at", -1)
            .limit(1)
        )
        rows = await cursor.to_list(length=1)
        return self._clean(rows[0]) if rows else None

    async def save_run(self, run):
        await self.runs.update_one(
            {"idempotency_key": run["idempotency_key"]},
            {"$setOnInsert": dict(run)},
            upsert=True,
        )
        return run

    async def save_invoice(self, invoice):
        await self.invoices.replace_one(
            {"invoice_id": invoice["invoice_id"]}, dict(invoice), upsert=True
        )
        return invoice

    async def get_invoice(self, invoice_id):
        return self._clean(await self.invoices.find_one({"invoice_id": invoice_id}))

    async def list_invoices(self, organization_id, limit=200):
        cursor = self.invoices.find({"organization_id": organization_id}).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def mark_transactions_billed(self, transaction_ids, invoice_id):
        if not transaction_ids:
            return
        await self.transactions.update_many(
            {"transaction_id": {"$in": transaction_ids}},
            {"$set": {"billed_invoice_id": invoice_id}},
        )

    async def save_payment(self, payment):
        try:
            await self.payments.insert_one(dict(payment))
            return True
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return False

    async def list_payments(self, invoice_id):
        cursor = self.payments.find({"invoice_id": invoice_id})
        return [self._clean(row) or {} for row in await cursor.to_list(length=200)]
