"""Cross-store reconciliation over real operational records."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from ..billing.repository import BillingRepository
from ..core.principal import assert_organization_access
from ..events.models import utc_now
from ..events.outbox import OutboxStore
from ..linen.lifecycle import DISPATCHED_FROM_CLIENT, DISPATCHED_FROM_LAUNDRY
from ..linen.repository import LinenProfileRepository

_INVOICE_TOTAL_TOLERANCE = 0.01


class ReconciliationStore:
    async def save(self, run: dict) -> dict:
        raise NotImplementedError

    async def list(self, organization_id: str | None = None, limit: int = 100) -> list[dict]:
        raise NotImplementedError


class InMemoryReconciliationStore(ReconciliationStore):
    def __init__(self) -> None:
        self.runs: dict[str, dict] = {}

    async def save(self, run):
        self.runs[run["run_id"]] = dict(run)
        return dict(run)

    async def list(self, organization_id=None, limit=100):
        rows = sorted(
            self.runs.values(), key=lambda row: str(row.get("started_at")), reverse=True
        )
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        return [dict(row) for row in rows[:limit]]


class MongoReconciliationStore(ReconciliationStore):
    def __init__(self, database) -> None:
        self.collection = database["reconciliation_runs"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def save(self, run):
        await self.collection.replace_one(
            {"run_id": run["run_id"]}, dict(run), upsert=True
        )
        return run

    async def list(self, organization_id=None, limit=100):
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.collection.find(query).sort("started_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]


class ReconciliationService:
    def __init__(
        self,
        linen_repository: LinenProfileRepository,
        billing_repository: BillingRepository,
        outbox: OutboxStore,
        store: ReconciliationStore,
    ) -> None:
        self.linen_repository = linen_repository
        self.billing_repository = billing_repository
        self.outbox = outbox
        self.store = store

    @staticmethod
    def _discrepancy(kind: str, entity_id: str, detail: str) -> dict:
        return {"kind": kind, "entity_id": entity_id, "detail": detail}

    async def run(self, organization_id: str | None, principal: dict) -> dict:
        if organization_id:
            assert_organization_access(principal, organization_id)
        elif not principal.get("platform_admin") and not principal.get("organization_ids"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Organization scope is required"
            )

        started_at = utc_now()
        profiles = await self.linen_repository.list(
            organization_id=organization_id, limit=5000
        )
        scans = await self.linen_repository.list_scans(
            organization_id=organization_id, limit=5000
        )
        alerts = await self.linen_repository.list_alerts(
            organization_id=organization_id, status="open", limit=5000
        )
        manifests = await self.linen_repository.list_manifests(
            organization_id=organization_id, limit=5000
        )
        events = await self.outbox.list_events(organization_id, limit=5000)
        dead_letters = await self.outbox.dead_letters(limit=500)
        transactions = (
            await self.billing_repository.list_all_transactions(organization_id)
            if organization_id
            else []
        )
        invoices = (
            await self.billing_repository.list_invoices(organization_id)
            if organization_id
            else []
        )

        discrepancies: list[dict] = []
        dispatched_events = {
            str(event.get("entity_id"))
            for event in events
            if event.get("event_type") == "linen.dispatched"
        }
        open_alert_linens = {str(alert.get("linen_id")) for alert in alerts}
        for profile in profiles:
            linen_id = str(profile.get("linen_id") or "")
            stage = str(profile.get("current_stage") or "")
            if (
                stage in {DISPATCHED_FROM_CLIENT, DISPATCHED_FROM_LAUNDRY}
                and linen_id not in dispatched_events
            ):
                discrepancies.append(
                    self._discrepancy(
                        "missing_dispatch_event",
                        linen_id,
                        f"Stage {stage} has no corresponding outbox event",
                    )
                )
            if profile.get("status") == "exception" and linen_id not in open_alert_linens:
                discrepancies.append(
                    self._discrepancy(
                        "missing_exception_alert",
                        linen_id,
                        f"Exception stage {stage} has no open alert",
                    )
                )

        for manifest in manifests:
            if str(manifest.get("status")) == "closed":
                expected = int(manifest.get("expected_count") or 0)
                received = int(manifest.get("received_count") or 0)
                if expected != received:
                    discrepancies.append(
                        self._discrepancy(
                            "manifest_count_mismatch",
                            str(manifest.get("manifest_id") or ""),
                            f"Expected {expected}, received {received}",
                        )
                    )

        invoice_ids = {str(invoice.get("invoice_id")) for invoice in invoices}
        for transaction in transactions:
            billed_invoice = str(transaction.get("billed_invoice_id") or "")
            if billed_invoice and billed_invoice not in invoice_ids:
                discrepancies.append(
                    self._discrepancy(
                        "missing_billed_invoice",
                        str(transaction.get("transaction_id") or ""),
                        f"References missing invoice {billed_invoice}",
                    )
                )
        billed_transaction_ids = {
            str(row.get("transaction_id"))
            for row in transactions
            if row.get("billed_invoice_id")
        }
        for invoice in invoices:
            line_total = sum(
                float(line.get("amount") or 0) for line in invoice.get("line_items") or []
            )
            expected_total = line_total + float(invoice.get("adjustments") or 0)
            expected_total += float(invoice.get("fixed_charges") or 0)
            expected_total += float(invoice.get("tax") or 0)
            actual_total = float(invoice.get("total") or 0)
            if abs(expected_total - actual_total) > _INVOICE_TOTAL_TOLERANCE:
                discrepancies.append(
                    self._discrepancy(
                        "invoice_total_mismatch",
                        str(invoice.get("invoice_id") or ""),
                        f"Stored {actual_total:.2f}, computed {expected_total:.2f}",
                    )
                )
            unbilled = set(invoice.get("transaction_ids") or []) - billed_transaction_ids
            for transaction_id in sorted(unbilled):
                discrepancies.append(
                    self._discrepancy(
                        "invoice_transaction_not_marked_billed",
                        transaction_id,
                        f"Invoice {invoice.get('invoice_id')} includes an unbilled transaction",
                    )
                )

        for letter in dead_letters:
            if organization_id and str(letter.get("organization_id")) != organization_id:
                continue
            discrepancies.append(
                self._discrepancy(
                    "dead_letter",
                    str(letter.get("event_id") or ""),
                    str(letter.get("reason") or "Failed event"),
                )
            )

        summary = {
            "linen_profiles": len(profiles),
            "scan_events": len(scans),
            "open_alerts": len(alerts),
            "manifests": len(manifests),
            "outbox_events": len(events),
            "billing_transactions": len(transactions),
            "invoices": len(invoices),
            "discrepancies": len(discrepancies),
        }
        run = {
            "run_id": str(uuid.uuid4()),
            "status": "clean" if not discrepancies else "discrepancies_found",
            "organization_id": organization_id or "",
            "discrepancies": discrepancies[:200],
            "summary": summary,
            "started_at": started_at,
            "finished_at": utc_now(),
        }
        await self.store.save(run)
        return run

    async def list_runs(
        self, organization_id: str | None, principal: dict, limit: int = 100
    ) -> list[dict]:
        if organization_id:
            assert_organization_access(principal, organization_id)
        elif not principal.get("platform_admin") and not principal.get("organization_ids"):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Organization scope is required"
            )
        return await self.store.list(organization_id, min(limit, 200))
