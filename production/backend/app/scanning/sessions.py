"""Bulk RFID scan sessions with duplicate filtering and reconciliation."""

from __future__ import annotations

from fastapi import HTTPException, status

from ..core.principal import assert_organization_access
from ..events.models import new_event, utc_now
from ..identity.models import normalize_epc
from ..identity.service import IdentityService
from ..linen.lifecycle import resolve_stage
from ..rfid.adapters import build_adapter
from ..rfid.models import RfidRead
from .repository import ScanningRepository
from .transactions import ScanTransactionService

MAX_SESSION_READS = 5000


class ScanSessionService:
    def __init__(
        self,
        repository: ScanningRepository,
        identity_service: IdentityService,
        transactions: ScanTransactionService,
        settings=None,
        outbox=None,
    ) -> None:
        self.repository = repository
        self.identity_service = identity_service
        self.transactions = transactions
        self.settings = settings
        self.outbox = outbox

    async def start(self, payload: dict, principal: dict) -> dict:
        session_id = str(payload.get("session_id") or "").strip() or f"SES-{utc_now()}"
        organization_id = str(
            payload.get("organization_id") or principal.get("organization_id") or ""
        )
        assert_organization_access(principal, organization_id)
        action = str(payload.get("action") or "").strip().lower()
        try:
            stage = resolve_stage(action)
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
        expected = [
            str(value).strip() for value in (payload.get("expected_linen_ids") or []) if str(value).strip()
        ]
        session = {
            "session_id": session_id,
            "organization_id": organization_id,
            "reader_id": str(payload.get("reader_id") or ""),
            "operator_id": str(principal.get("actor_id") or ""),
            "stage": stage,
            "action": action,
            "mode": str(payload.get("mode") or "bulk"),
            "status": "ACTIVE",
            "expected_count": int(payload.get("expected_count") or len(expected)),
            "detected_count": 0,
            "duplicate_count": 0,
            "missing_count": 0,
            "unexpected_count": 0,
            "expected_linen_ids": expected,
            "missing_linen_ids": [],
            "unexpected_linen_ids": [],
            "started_at": utc_now(),
            "completed_at": None,
        }
        return await self.repository.save_session(session)

    async def get(self, session_id: str, principal: dict) -> dict:
        session = await self.repository.get_session(session_id)
        if session is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan session not found")
        assert_organization_access(principal, str(session.get("organization_id") or ""))
        return session

    async def list(self, principal: dict, limit: int = 200) -> list[dict]:
        if principal.get("platform_admin"):
            return await self.repository.list_sessions(limit=min(limit, 500))
        rows: list[dict] = []
        for organization_id in sorted(set(principal.get("organization_ids") or [])):
            rows.extend(
                await self.repository.list_sessions(organization_id, limit=min(limit, 500))
            )
        return rows[:limit]

    def _summary(self, session: dict) -> dict:
        expected = set(session.get("expected_linen_ids") or [])
        missing = [value for value in session.get("missing_linen_ids") or [] if value]
        unexpected = [
            value for value in session.get("unexpected_linen_ids") or [] if value
        ]
        return {
            "expected_items": session.get("expected_count", len(expected)),
            "detected_items": int(session.get("detected_count") or 0),
            "missing_items": len(missing),
            "unexpected_items": len(unexpected),
            "duplicate_reads": int(session.get("duplicate_count") or 0),
            "missing_linen_ids": sorted(missing),
            "unexpected_linen_ids": sorted(unexpected),
        }

    def _assert_reader_scope(self, session: dict, reader: dict | None) -> None:
        if reader is None:
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED, "A registered RFID reader is required"
            )
        reader_org = str(reader.get("organization_id") or "")
        if reader_org != str(session.get("organization_id") or ""):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Reader belongs to another organization"
            )

    @staticmethod
    def _reader_principal(reader: dict) -> dict:
        """Build an organization-scoped service principal for a trusted reader.

        Reader credentials are authenticated by ``ReaderService`` before any
        scan method is reached. The principal below is a least-privilege
        projection that downstream lifecycle and transaction services can
        authorize with the same tenant predicate used for human users.
        """

        organization_id = str(reader.get("organization_id") or "")
        reader_id = str(reader.get("reader_id") or "")
        return {
            "actor_id": reader_id,
            "auth_id": reader_id,
            "user_name": reader_id,
            "organization_id": organization_id,
            "organization_ids": [organization_id] if organization_id else [],
            "platform_admin": False,
            "role_names": ["RFID_READER"],
            "capabilities": ["record_scans"],
        }

    async def submit_reads(
        self,
        session_id: str,
        reads: list[dict],
        principal: dict,
        reader: dict | None = None,
    ) -> dict:
        if len(reads) > MAX_SESSION_READS:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"A session submission may contain at most {MAX_SESSION_READS} reads",
            )
        session = await self.repository.get_session(session_id)
        if session is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan session not found")
        self._assert_reader_scope(session, reader)
        if session.get("status") != "ACTIVE":
            raise HTTPException(status.HTTP_409_CONFLICT, "Scan session is not active")
        service_principal = self._reader_principal(reader)
        _, epc_length = self.identity_service.epc_config()
        reader_id = str((reader or {}).get("reader_id") or "")
        session_reader_id = str(session.get("reader_id") or "")
        if reader_id and session_reader_id and reader_id != session_reader_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Reader is not registered to this session"
            )

        results: list[dict] = []
        detected_linen_ids: list[str] = []
        duplicates = 0
        unexpected = 0
        unknown = 0
        wrong_hotel = 0
        for raw in reads:
            observation = RfidRead.from_payload(raw)
            epc = normalize_epc(observation.epc, epc_length)
            read_id = f"READ-{session_id}-{epc}"
            if not await self.repository.insert_read(
                {
                    "read_id": read_id,
                    "session_id": session_id,
                    "reader_id": reader_id,
                    "epc": epc,
                    "tid": observation.tid,
                    "linen_id": "",
                    "antenna": observation.antenna,
                    "rssi": observation.rssi,
                    "read_count": observation.read_count,
                    "result": "pending",
                    "scan_id": "",
                    "occurred_at": observation.occurred_at,
                }
            ):
                duplicates += 1
                results.append({"epc": epc, "result": "duplicate"})
                continue

            item = await self.identity_service.find_by_method("rfid", epc)
            linen_id = str((item or {}).get("linen_id") or "")
            result_name = "unknown"
            scan_id = ""
            if item is None:
                unknown += 1
            elif str(item.get("organization_id") or "") != session["organization_id"] and str(
                item.get("owner_organization_id") or ""
            ) != session["organization_id"]:
                result_name = "wrong_hotel"
                wrong_hotel += 1
            else:
                detected_linen_ids.append(linen_id)
                expected_ids = set(session.get("expected_linen_ids") or [])
                if expected_ids and linen_id not in expected_ids:
                    result_name = "unexpected"
                    unexpected += 1
                else:
                    scan_id = f"{session_id}:{epc}"
                    transaction = await self.transactions.submit(
                        {
                            "method": "rfid",
                            "scan_id": scan_id,
                            "identifier": epc,
                            "action": session["action"],
                            "organization_id": session["organization_id"],
                            "scanner_id": reader_id,
                            "reader_id": reader_id,
                            "session_id": session_id,
                            "occurred_at": observation.occurred_at,
                        },
                        service_principal,
                        reader,
                    )
                    result_name = str(transaction.get("result") or "rejected")
            await self.repository.update_read(
                read_id,
                {
                    "linen_id": linen_id,
                    "result": result_name,
                    "scan_id": scan_id,
                },
            )
            results.append(
                {
                    "epc": epc,
                    "linen_id": linen_id,
                    "result": result_name,
                    "scan_id": scan_id,
                }
            )

        known_detected = set(detected_linen_ids)
        expected_ids = set(session.get("expected_linen_ids") or [])
        session["detected_count"] = int(session.get("detected_count") or 0) + len(results) - duplicates
        session["duplicate_count"] = int(session.get("duplicate_count") or 0) + duplicates
        session["unexpected_count"] = int(session.get("unexpected_count") or 0) + unexpected
        session["missing_linen_ids"] = sorted(expected_ids - known_detected)
        session["unexpected_linen_ids"] = sorted(known_detected - expected_ids)
        session["missing_count"] = len(session["missing_linen_ids"])
        await self.repository.save_session(session)
        return {
            "session_id": session_id,
            "summary": self._summary(session),
            "unknown": unknown,
            "wrong_hotel": wrong_hotel,
            "results": results,
        }

    async def capture_from_reader(
        self, session_id: str, principal: dict, reader: dict, duration: float = 2.0
    ) -> dict:
        """Read from a registered physical adapter; no simulated success allowed."""

        service_principal = self._reader_principal(reader)
        session = await self.get(session_id, service_principal)
        self._assert_reader_scope(session, reader)
        if session.get("status") != "ACTIVE":
            raise HTTPException(status.HTTP_409_CONFLICT, "Scan session is not active")
        adapter = build_adapter(reader, self.settings)
        observation = await adapter.status()
        if not observation.connected:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "RFID reader is disconnected")
        reads = [row.to_dict() for row in await adapter.read_tags(timeout=duration)]
        for row in reads:
            row["reader_id"] = reader.get("reader_id", "")
        return await self.submit_reads(session_id, reads, service_principal, reader)

    async def complete(self, session_id: str, principal: dict) -> dict:
        session = await self.get(session_id, principal)
        if session.get("status") != "ACTIVE":
            raise HTTPException(status.HTTP_409_CONFLICT, "Scan session is already completed")
        summary = self._summary(session)
        session.update(
            {
                "status": "COMPLETED",
                "completed_at": utc_now(),
                "missing_count": summary["missing_items"],
                "unexpected_count": summary["unexpected_items"],
                "missing_linen_ids": summary["missing_linen_ids"],
                "unexpected_linen_ids": summary["unexpected_linen_ids"],
            }
        )
        saved = await self.repository.save_session(session)
        if self.outbox is not None:
            await self.outbox.publish(
                new_event(
                    "rfid.session.completed",
                    str(session.get("organization_id") or ""),
                    "rfid-scanning",
                    session_id,
                    summary,
                )
            )
        return {"session": saved, "summary": summary}

    async def reconcile(self, session_id: str, principal: dict) -> dict:
        session = await self.get(session_id, principal)
        reads = await self.repository.list_reads(session_id)
        return {
            "session_id": session_id,
            "summary": self._summary(session),
            "reads": reads,
        }
