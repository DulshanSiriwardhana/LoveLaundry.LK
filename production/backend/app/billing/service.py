"""Hotel-wise billing computed only from recorded operational transactions."""

from __future__ import annotations

import hashlib
import json
import uuid

from fastapi import HTTPException, status

from ..core.principal import assert_organization_access
from ..events.models import new_event, utc_now
from ..events.outbox import OutboxStore
from .repository import BillingRepository


def _money(value: float) -> float:
    return round(float(value) + 1e-9, 2)


class BillingEngine:
    def __init__(self, repository: BillingRepository, outbox: OutboxStore) -> None:
        self.repository = repository
        self.outbox = outbox

    @staticmethod
    def _key(payload: dict, transaction_ids: list[str]) -> str:
        material = {
            "organization_id": payload.get("organization_id"),
            "hotel_id": payload.get("hotel_id"),
            "period_start": payload.get("period_start"),
            "period_end": payload.get("period_end"),
            "transaction_ids": sorted(transaction_ids),
            "adjustments": payload.get("adjustments") or [],
        }
        return hashlib.sha256(
            json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()

    async def generate_invoice(self, payload: dict, principal: dict) -> dict:
        organization_id = str(payload.get("organization_id") or "")
        assert_organization_access(principal, organization_id)
        hotel_id = str(payload.get("hotel_id") or "")
        if not hotel_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A hotel is required")
        start = str(payload.get("period_start") or "")
        end = str(payload.get("period_end") or "")
        if not start or not end or start > end:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid billing period")

        # The first run marks its transactions as billed. Check the scoped run
        # ledger before filtering them out, otherwise a retry would look like a
        # fresh request and could produce a second invoice.
        prior_run = await self.repository.find_run_by_scope(
            organization_id, hotel_id, start, end
        )
        if prior_run and prior_run.get("invoice_id"):
            prior_invoice = await self.repository.get_invoice(prior_run["invoice_id"])
            if prior_invoice is not None:
                return {"invoice": prior_invoice, "duplicate": True}

        transactions = await self.repository.list_transactions(
            organization_id, hotel_id, start, end
        )
        if not transactions:
            raise HTTPException(
                status.HTTP_409_CONFLICT, "No unbilled transactions in this period"
            )
        transaction_ids = sorted(str(row["transaction_id"]) for row in transactions)
        idempotency_key = self._key(payload, transaction_ids)
        existing_run = await self.repository.find_run(idempotency_key)
        if existing_run and existing_run.get("invoice_id"):
            invoice = await self.repository.get_invoice(existing_run["invoice_id"])
            if invoice:
                return {"invoice": invoice, "duplicate": True}

        lines: list[dict] = []
        groups: dict[tuple, dict] = {}
        for transaction in transactions:
            service = str(transaction.get("service") or "")
            occurred_at = str(transaction.get("occurred_at") or "")[:10]
            rate = await self.repository.rate_for(organization_id, service, occurred_at)
            if rate is None:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"No effective rate for service '{service}' on {occurred_at}",
                )
            unit = str(rate.get("unit") or "item")
            unit_rate = float(rate.get("unit_rate") or 0)
            tax_rate = float(rate.get("tax_rate") or 0)
            fixed_charge = float(rate.get("fixed_charge") or 0)
            rate_identity = str(
                rate.get("rate_card_id") or rate.get("effective_from") or unit_rate
            )
            # Rate changes must create separate lines. Grouping only by service
            # would price transactions from different effective periods at one
            # of the rates and silently under- or over-bill the hotel.
            key = (
                service,
                unit,
                rate_identity,
                unit_rate,
                tax_rate,
                fixed_charge,
            )
            group = groups.setdefault(
                key,
                {
                    "service": service,
                    "unit": unit,
                    "quantity": 0.0,
                    "unit_rate": unit_rate,
                    "tax_rate": tax_rate,
                    "fixed_charge": fixed_charge,
                    "transaction_ids": [],
                },
            )
            group["quantity"] += float(transaction.get("quantity") or 0)
            group["transaction_ids"].append(transaction["transaction_id"])

        for group in groups.values():
            subtotal = _money(group["quantity"] * group["unit_rate"])
            lines.append(
                {
                    "line_id": str(uuid.uuid4()),
                    "description": f"{service} ({unit})",
                    "quantity": _money(group["quantity"]),
                    "unit_rate": _money(group["unit_rate"]),
                    "amount": subtotal,
                    "transaction_ids": group["transaction_ids"],
                    "_tax_rate": group["tax_rate"],
                    "_fixed_charge": group["fixed_charge"],
                }
            )

        subtotal = _money(sum(line["amount"] for line in lines))
        adjustments = payload.get("adjustments") or []
        adjustment_total = _money(
            sum(float(row.get("amount") or 0) for row in adjustments)
        )
        fixed_charges = _money(sum(line.pop("_fixed_charge") for line in lines))
        tax = _money(
            sum(
                line["amount"] * float(line.pop("_tax_rate"))
                for line in lines
            )
        )
        total = _money(subtotal + adjustment_total + fixed_charges + tax)
        invoice_id = str(payload.get("invoice_id") or f"INV-{uuid.uuid4().hex[:12].upper()}")
        invoice = {
            "invoice_id": invoice_id,
            "organization_id": organization_id,
            "bill_id": hotel_id,
            "hotel_id": hotel_id,
            "status": "draft",
            "period": f"{start}..{end}",
            "period_start": start,
            "period_end": end,
            "subtotal": subtotal,
            "adjustments": adjustment_total,
            "tax": tax,
            "fixed_charges": fixed_charges,
            "total": total,
            "line_items": lines,
            "transaction_ids": transaction_ids,
            "created_by": principal.get("actor_id", ""),
            "created_at": utc_now(),
        }
        await self.repository.save_invoice(invoice)
        await self.repository.save_run(
            {
                "run_id": str(uuid.uuid4()),
                "organization_id": organization_id,
                "hotel_id": hotel_id,
                "period_start": start,
                "period_end": end,
                "status": "completed",
                "idempotency_key": idempotency_key,
                "transaction_ids": transaction_ids,
                "invoice_id": invoice_id,
                "summary": {"total": total, "lines": len(lines)},
                "created_by": principal.get("actor_id", ""),
                "created_at": utc_now(),
            }
        )
        await self.repository.mark_transactions_billed(transaction_ids, invoice_id)
        await self.outbox.publish(
            new_event(
                "invoice.generated",
                organization_id,
                "billing",
                invoice_id,
                {
                    "hotel_id": hotel_id,
                    "period_start": start,
                    "period_end": end,
                    "total": total,
                    "transaction_ids": transaction_ids,
                },
            )
        )
        return {"invoice": invoice, "duplicate": False}

    async def finalize_invoice(self, invoice_id: str, principal: dict) -> dict:
        invoice = await self.repository.get_invoice(invoice_id)
        if invoice is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
        assert_organization_access(principal, str(invoice.get("organization_id") or ""))
        if invoice.get("status") not in {"draft", "issued"}:
            raise HTTPException(status.HTTP_409_CONFLICT, "Invoice cannot be finalized")
        invoice["status"] = "issued"
        invoice["issued_by"] = principal.get("actor_id", "")
        invoice["issued_at"] = utc_now()
        await self.repository.save_invoice(invoice)
        await self.outbox.publish(
            new_event(
                "invoice.issued",
                invoice.get("organization_id", ""),
                "billing",
                invoice_id,
                {"total": invoice.get("total", 0)},
            )
        )
        return invoice

    async def record_payment(self, payload: dict, principal: dict) -> dict:
        invoice_id = str(payload.get("invoice_id") or "")
        invoice = await self.repository.get_invoice(invoice_id)
        if invoice is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
        assert_organization_access(principal, str(invoice.get("organization_id") or ""))
        if invoice.get("status") != "issued":
            raise HTTPException(status.HTTP_409_CONFLICT, "Only issued invoices accept payments")
        amount = float(payload.get("amount") or 0)
        if amount <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment amount must be positive")
        payment_id = str(payload.get("payment_id") or "")
        if not payment_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A payment id is required")
        payment = {
            "payment_id": payment_id,
            "organization_id": invoice["organization_id"],
            "invoice_id": invoice_id,
            "status": "recorded",
            "amount": amount,
            "created_at": utc_now(),
            "recorded_by": principal.get("actor_id", ""),
        }
        inserted = await self.repository.save_payment(payment)
        if not inserted:
            return {"payment": payment, "invoice": invoice, "duplicate": True}
        payments = await self.repository.list_payments(invoice_id)
        paid = _money(sum(float(row.get("amount") or 0) for row in payments))
        total = float(invoice.get("total") or 0)
        invoice["amount_paid"] = paid
        invoice["balance"] = _money(total - paid)
        invoice["status"] = "paid" if paid >= total else "partially_paid"
        await self.repository.save_invoice(invoice)
        await self.outbox.publish(
            new_event(
                "payment.recorded",
                invoice["organization_id"],
                "billing",
                payment_id,
                {"invoice_id": invoice_id, "amount": amount, "balance": invoice["balance"]},
            )
        )
        return {"payment": payment, "invoice": invoice, "duplicate": False}
