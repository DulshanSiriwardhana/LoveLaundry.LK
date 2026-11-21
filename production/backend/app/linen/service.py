"""Linen registration and high-volume idempotent scan ingestion."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from ..core.principal import assert_organization_access
from ..events.models import new_event, utc_now
from ..events.outbox import OutboxStore
from .lifecycle import (
    ACTION_STAGE,
    AVAILABLE,
    REGISTERED,
    can_transition,
    is_exception_stage,
    resolve_stage,
)
from .repository import LinenProfileRepository

WASH_ACTIONS = {"start_washing", "start_drying", "iron_fold", "inspect", "mark_ready"}


class LinenWorkflow:
    def __init__(self, repository: LinenProfileRepository, outbox: OutboxStore) -> None:
        self.repository = repository
        self.outbox = outbox

    async def register(self, payload: dict, principal: dict) -> dict:
        organization_id = str(payload.get("organization_id") or "")
        assert_organization_access(principal, organization_id)
        code = str(payload.get("code") or "").strip()
        if not code:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A linen QR code is required")
        existing = await self.repository.find_by_code(organization_id, code)
        if existing is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Linen QR code is already registered")
        linen_id = str(payload.get("linen_id") or "").strip() or code
        profile = {
            "linen_id": linen_id,
            "organization_id": organization_id,
            "owner_organization_id": str(
                payload.get("owner_organization_id") or organization_id
            ),
            "code": code,
            "category": str(payload.get("category") or ""),
            "item_type": str(payload.get("item_type") or ""),
            "size": str(payload.get("size") or ""),
            "material": str(payload.get("material") or ""),
            "current_stage": REGISTERED,
            "status": "active",
            "current_location": str(payload.get("current_location") or organization_id),
            "responsible_organization_id": organization_id,
            "last_seen_organization_id": organization_id,
            "last_seen_at": utc_now(),
            "cycle_number": 0,
            "wash_count": 0,
            "updated_at": utc_now(),
        }
        saved = await self.repository.register(profile)
        await self.outbox.publish(
            new_event(
                "linen.registered",
                organization_id,
                "central-tracking",
                linen_id,
                {"code": code, "category": profile["category"]},
                correlation_id=str(payload.get("correlation_id") or ""),
            )
        )
        return saved

    async def record_scan(self, payload: dict, principal: dict) -> dict:
        organization_id = str(payload.get("organization_id") or "")
        assert_organization_access(principal, organization_id)
        code = str(payload.get("code") or "").strip()
        scan_id = str(payload.get("scan_id") or "").strip()
        if not code or not scan_id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "scan_id and code are required"
            )
        try:
            next_stage = resolve_stage(payload.get("action"))
        except ValueError as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

        profile = await self.repository.find_by_code(organization_id, code)
        if profile is None:
            await self._record_unknown_scan(payload, principal, code, next_stage)
            return {
                "result": "unknown",
                "code": code,
                "scan_id": scan_id,
                "organization_id": organization_id,
            }

        scan = {
            "scan_id": scan_id,
            "linen_id": profile["linen_id"],
            "organization_id": organization_id,
            "code": code,
            "stage": next_stage,
            "action": str(payload.get("action") or "").lower(),
            "scanner_id": str(payload.get("scanner_id") or ""),
            "operator_id": principal.get("actor_id", ""),
            "session_id": str(payload.get("session_id") or ""),
            "batch_id": str(payload.get("batch_id") or ""),
            "result": "accepted",
            "occurred_at": str(payload.get("occurred_at") or utc_now()),
        }
        inserted = await self.repository.insert_scan(scan)
        if not inserted:
            return {
                "result": "duplicate",
                "code": code,
                "scan_id": scan_id,
                "linen_id": profile["linen_id"],
                "organization_id": organization_id,
            }

        current_stage = str(profile.get("current_stage") or "")
        if next_stage != current_stage and not can_transition(current_stage, next_stage):
            scan["result"] = "invalid_transition"
            await self.outbox.publish(
                new_event(
                    "linen.transition.rejected",
                    organization_id,
                    "scanner",
                    profile["linen_id"],
                    {
                        "scan_id": scan_id,
                        "from": current_stage,
                        "to": next_stage,
                        "operator_id": scan["operator_id"],
                    },
                )
            )
            return {
                "result": "invalid_transition",
                "code": code,
                "scan_id": scan_id,
                "linen_id": profile["linen_id"],
                "from": current_stage,
                "to": next_stage,
            }

        updated = dict(profile)
        updated["current_stage"] = next_stage
        updated["status"] = "exception" if is_exception_stage(next_stage) else "active"
        updated["current_location"] = str(
            payload.get("to_organization_id")
            or payload.get("location")
            or profile.get("current_location")
            or organization_id
        )
        updated["responsible_organization_id"] = str(
            payload.get("to_organization_id") or organization_id
        )
        updated["last_seen_organization_id"] = organization_id
        updated["last_seen_scanner_id"] = scan["scanner_id"]
        updated["last_seen_operator_id"] = scan["operator_id"]
        updated["last_seen_at"] = scan["occurred_at"]
        updated["updated_at"] = utc_now()
        if scan["action"] in WASH_ACTIONS:
            updated["wash_count"] = int(profile.get("wash_count") or 0) + 1
        if next_stage == AVAILABLE:
            updated["cycle_number"] = int(profile.get("cycle_number") or 0) + 1
        if next_stage in {"damaged", "rejected", "quarantined", "retired"}:
            updated["expected_next_at"] = None
        else:
            horizon = 30 if next_stage == AVAILABLE else 7
            updated["expected_next_at"] = (
                datetime.now(timezone.utc) + timedelta(days=horizon)
            ).isoformat()
        saved = await self.repository.save(updated)

        event_type = "linen.scanned"
        if next_stage in {"missing", "damaged", "retired"}:
            event_type = f"linen.{next_stage}.detected"
        elif next_stage in {"dispatched_from_client", "dispatched_from_laundry"}:
            event_type = "linen.dispatched"
        elif next_stage in {"received_at_laundry", "received_at_client"}:
            event_type = "linen.received"
        await self.outbox.publish(
            new_event(
                event_type,
                organization_id,
                str(payload.get("source") or "scanner"),
                profile["linen_id"],
                {
                    "scan_id": scan_id,
                    "action": scan["action"],
                    "from_stage": current_stage,
                    "to_stage": next_stage,
                    "scanner_id": scan["scanner_id"],
                    "operator_id": scan["operator_id"],
                    "session_id": scan["session_id"],
                    "batch_id": scan["batch_id"],
                    "to_organization_id": updated["responsible_organization_id"],
                },
                correlation_id=str(payload.get("correlation_id") or scan_id),
            )
        )
        return {
            "result": "accepted",
            "code": code,
            "scan_id": scan_id,
            "linen_id": profile["linen_id"],
            "stage": next_stage,
            "profile": saved,
        }

    async def _record_unknown_scan(self, payload, principal, code, stage) -> None:
        scan_id = str(payload.get("scan_id") or "")
        inserted = await self.repository.insert_scan(
            {
                "scan_id": scan_id,
                "linen_id": "",
                "organization_id": str(payload.get("organization_id") or ""),
                "code": code,
                "stage": stage,
                "action": str(payload.get("action") or ""),
                "scanner_id": str(payload.get("scanner_id") or ""),
                "operator_id": principal.get("actor_id", ""),
                "session_id": str(payload.get("session_id") or ""),
                "batch_id": str(payload.get("batch_id") or ""),
                "result": "unknown",
                "occurred_at": str(payload.get("occurred_at") or utc_now()),
            }
        )
        if inserted:
            await self.outbox.publish(
                new_event(
                    "linen.unknown.scan",
                    str(payload.get("organization_id") or ""),
                    "scanner",
                    code,
                    {"scan_id": scan_id, "code": code, "stage": stage},
                )
            )

    async def profile(self, linen_id: str, principal: dict) -> dict:
        profile = await self.repository.get(linen_id)
        if profile is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(profile.get("organization_id") or ""))
        history = await self.repository.list_scans(linen_id)
        return {"profile": profile, "history": history}

    async def list_profiles(
        self, principal: dict, organization_id: str | None = None, limit: int = 200
    ) -> list[dict]:
        if organization_id:
            assert_organization_access(principal, organization_id)
        if not organization_id and not principal.get("platform_admin"):
            scopes = principal.get("organization_ids") or []
            if not scopes:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN, "Organization scope is required"
                )
        return await self.repository.list(
            organization_id=organization_id, limit=min(limit, 500)
        )
