"""One business transaction for both QR and UHF RFID scans."""

from __future__ import annotations

from fastapi import HTTPException, status

from ..billing.verification import BillingVerificationService
from ..core.principal import assert_organization_access
from ..events.models import new_event, utc_now
from ..identity.models import normalize_epc, normalize_qr
from ..identity.service import IdentityService
from ..linen.service import LinenWorkflow
from .repository import ScanningRepository

QR_METHODS = {"qr", "qr_code", "qrcode"}
RFID_METHODS = {"rfid", "epc", "uhf"}


class ScanTransactionService:
    def __init__(
        self,
        repository: ScanningRepository,
        identity_service: IdentityService,
        linen_service: LinenWorkflow,
        billing_verification: BillingVerificationService | None = None,
        outbox=None,
    ) -> None:
        self.repository = repository
        self.identity_service = identity_service
        self.linen_service = linen_service
        self.billing_verification = billing_verification
        self.outbox = outbox

    def _normalize_identifier(self, method: str, identifier: str) -> str:
        key = method.strip().lower()
        if key in QR_METHODS:
            return normalize_qr(identifier)
        if key in RFID_METHODS:
            _, length = self.identity_service.epc_config()
            return normalize_epc(identifier, length)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported scan method")

    async def submit(self, payload: dict, principal: dict, reader: dict | None = None) -> dict:
        method = str(payload.get("method") or "qr").strip().lower()
        scan_id = str(payload.get("scan_id") or "").strip()
        action = str(payload.get("action") or "").strip().lower()
        if not scan_id or not action:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "scan_id and action are required"
            )
        identifier = self._normalize_identifier(
            method, str(payload.get("identifier") or "")
        )
        item = await self.identity_service.find_by_method(method, identifier)
        organization_id = str(
            payload.get("organization_id")
            or (item or {}).get("organization_id")
            or ""
        )
        assert_organization_access(principal, organization_id)
        to_organization_id = str(payload.get("to_organization_id") or "")
        if to_organization_id:
            assert_organization_access(principal, to_organization_id)

        existing = await self.repository.get_transaction(scan_id)
        if existing is not None:
            return {
                "result": existing.get("result"),
                "duplicate": True,
                "scan_id": scan_id,
                "linen_id": existing.get("linen_id", ""),
                "stage": existing.get("stage", ""),
                "method": method,
                "identifier": identifier,
            }

        occurred_at = str(payload.get("occurred_at") or utc_now())
        transaction_id = f"TXN-{scan_id}"
        transaction = {
            "transaction_id": transaction_id,
            "scan_id": scan_id,
            "linen_id": str((item or {}).get("linen_id") or ""),
            "organization_id": organization_id,
            "identifier": identifier,
            "method": method,
            "action": action,
            "stage": "",
            "result": "pending",
            "reader_id": str((reader or {}).get("reader_id") or payload.get("reader_id") or ""),
            "session_id": str(payload.get("session_id") or ""),
            "actor_id": str(principal.get("actor_id") or ""),
            "error": "",
            "occurred_at": occurred_at,
        }
        if not await self.repository.insert_transaction(transaction):
            existing = await self.repository.get_transaction(scan_id) or transaction
            return {
                "result": existing.get("result"),
                "duplicate": True,
                "scan_id": scan_id,
                "linen_id": existing.get("linen_id", ""),
                "stage": existing.get("stage", ""),
                "method": method,
                "identifier": identifier,
            }

        scan_payload = {
            "organization_id": organization_id,
            "scan_id": scan_id,
            "code": str((item or {}).get("linen_id") or identifier),
            "action": action,
            "scanner_id": transaction["reader_id"]
            or str(payload.get("scanner_id") or ""),
            "source": f"{method}-scan",
            "session_id": transaction["session_id"],
            "batch_id": str(payload.get("batch_id") or ""),
            "to_organization_id": to_organization_id,
            "location": str(payload.get("location") or ""),
            "occurred_at": occurred_at,
            "correlation_id": str(payload.get("correlation_id") or scan_id),
            "workflow_reference": str(payload.get("workflow_reference") or ""),
        }
        try:
            result = await self.linen_service.record_scan(scan_payload, principal)
        except HTTPException as exc:
            await self.repository.update_transaction(
                transaction_id, {"result": "rejected", "error": str(exc.detail)}
            )
            raise

        outcome = str(result.get("result") or "rejected")
        scan_record = {
            "action": action,
            "scan_id": scan_id,
            "stage": str(result.get("stage") or ""),
            "timestamp": occurred_at,
            "result": outcome,
            "session_id": transaction["session_id"],
            "method": method,
        }
        await self.repository.update_transaction(
            transaction_id,
            {
                "linen_id": str(result.get("linen_id") or ""),
                "stage": scan_record["stage"],
                "result": outcome,
            },
        )

        if item is not None and self.billing_verification is not None:
            await self.billing_verification.record_from_validated_scan(
                scan=scan_record,
                item=item,
                payload=payload,
                principal=principal,
            )

        if item is not None and outcome == "accepted" and action == "complete_washing":
            profile = result.get("profile") or {}
            wash_count = int(profile.get("wash_count") or 0)
            cycle_id = f"WASH-{scan_id}"
            saved_cycle = await self.repository.save_wash_cycle(
                {
                    "cycle_id": cycle_id,
                    "linen_id": str(item.get("linen_id") or ""),
                    "organization_id": organization_id,
                    "wash_count": wash_count,
                    "stage_from": str(result.get("from") or "washing_in_progress"),
                    "stage_to": scan_record["stage"],
                    "workflow_reference": scan_payload["workflow_reference"],
                    "operator_id": str(principal.get("actor_id") or ""),
                    "validator": str(principal.get("actor_id") or ""),
                    "completed_at": occurred_at,
                }
            )
            if saved_cycle:
                await self.identity_service.record_wash_cycle(
                    str(item.get("linen_id") or ""), wash_count
                )

        if self.outbox is not None:
            await self.outbox.publish(
                new_event(
                    "scan.transaction.completed",
                    organization_id,
                    f"{method}-scanner",
                    str(result.get("linen_id") or identifier),
                    {
                        "scan_id": scan_id,
                        "action": action,
                        "result": outcome,
                        "method": method,
                        "reader_id": transaction["reader_id"],
                        "session_id": transaction["session_id"],
                    },
                )
            )
        return {
            "result": outcome,
            "duplicate": False,
            "scan_id": scan_id,
            "linen_id": str(result.get("linen_id") or ""),
            "qr_id": (item or {}).get("qr_id", ""),
            "epc": (item or {}).get("epc", ""),
            "item_type": (item or {}).get("item_type", ""),
            "stage": result.get("stage", ""),
            "method": method,
            "identifier": identifier,
            "wash_count": int((result.get("profile") or {}).get("wash_count") or 0),
        }
