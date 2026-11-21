"""Advisory RFID tag health monitoring.

Tag wear cannot be measured electronically. These signals are configuration
thresholds derived from validated wash cycles and operator inspection reports;
they are planning aids, not guaranteed failure predictions.
"""

from __future__ import annotations

from fastapi import HTTPException, status

from ..core.principal import assert_organization_access
from ..events.models import new_event, utc_now
from .repository import IdentityRepository


class TagHealthService:
    def __init__(self, repository: IdentityRepository, settings=None, outbox=None) -> None:
        self.repository = repository
        self.settings = settings
        self.outbox = outbox

    def _threshold(self, name: str, default: int) -> int:
        return int(getattr(self.settings, name, default) or default)

    async def evaluate(self, item: dict) -> dict:
        wash_count = int(item.get("wash_cycles") or 0)
        batch = await self.repository.get_batch(str(item.get("batch_id") or ""))
        rated = int(
            (batch or {}).get("durability_rating_cycles")
            or self._threshold("tag_rated_limit_alert_cycles", 300)
        )
        inspection = min(self._threshold("tag_inspection_threshold_cycles", 250), rated)
        planning = min(
            self._threshold("tag_replacement_planning_threshold_cycles", 275), rated
        )
        if str(item.get("tag_status") or "ACTIVE").upper() != "ACTIVE":
            signal = "tag_inactive"
        elif wash_count >= rated:
            signal = "manufacturer_rated_limit_reached"
        elif wash_count >= planning:
            signal = "replacement_planning"
        elif wash_count >= inspection:
            signal = "inspection_recommended"
        else:
            signal = "within_configured_thresholds"
        return {
            "linen_id": item.get("linen_id", ""),
            "tag_serial": item.get("tag_serial", ""),
            "epc": item.get("epc", ""),
            "wash_cycles": wash_count,
            "rated_cycles": rated,
            "inspection_threshold": inspection,
            "planning_threshold": planning,
            "signal": signal,
            "advisory": True,
            "evaluated_at": utc_now(),
        }

    async def alerts(self, principal: dict, limit: int = 500) -> list[dict]:
        if principal.get("platform_admin"):
            items = await self.repository.list_items(limit=limit)
        else:
            rows: list[dict] = []
            for organization_id in sorted(set(principal.get("organization_ids") or [])):
                rows.extend(
                    await self.repository.list_items(
                        organization_id=organization_id, limit=limit
                    )
                )
            items = rows[:limit]
        evaluated = [await self.evaluate(item) for item in items]
        return [row for row in evaluated if row["signal"] != "within_configured_thresholds"]

    async def record_inspection(self, linen_id: str, payload: dict, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        row = {
            "inspection_id": str(payload.get("inspection_id") or "").strip()
            or f"INS-{linen_id}-{utc_now()}",
            "linen_id": linen_id,
            "tag_serial": str(item.get("tag_serial") or ""),
            "result": str(payload.get("result") or "PASSED").upper(),
            "qr_readable": bool(payload.get("qr_readable", True)),
            "rfid_readable": bool(payload.get("rfid_readable", True)),
            "wash_cycles_observed": int(
                payload.get("wash_cycles_observed") or item.get("wash_cycles") or 0
            ),
            "inspector_id": str(principal.get("actor_id") or ""),
            "notes": str(payload.get("notes") or ""),
            "occurred_at": utc_now(),
        }
        saved = await self.repository.save_inspection(row)
        if self.outbox is not None:
            await self.outbox.publish(
                new_event(
                    "tag.inspection.recorded",
                    str(item.get("organization_id") or ""),
                    "tag-health",
                    linen_id,
                    {
                        "result": row["result"],
                        "qr_readable": row["qr_readable"],
                        "rfid_readable": row["rfid_readable"],
                    },
                )
            )
        return saved

    async def report_failure(self, linen_id: str, payload: dict, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        failure_type = str(payload.get("failure_type") or "").strip().upper()
        if not failure_type:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "A failure_type is required"
            )
        row = {
            "failure_id": str(payload.get("failure_id") or "").strip()
            or f"FAIL-{linen_id}-{utc_now()}",
            "linen_id": linen_id,
            "tag_serial": str(item.get("tag_serial") or ""),
            "failure_type": failure_type,
            "status": "OPEN",
            "description": str(payload.get("description") or ""),
            "reporter_id": str(principal.get("actor_id") or ""),
            "reported_at": utc_now(),
            "resolved_at": None,
        }
        saved = await self.repository.save_failure_report(row)
        if self.outbox is not None:
            await self.outbox.publish(
                new_event(
                    "tag.failure.reported",
                    str(item.get("organization_id") or ""),
                    "tag-health",
                    linen_id,
                    {"failure_type": failure_type},
                )
            )
        return saved

    async def history(self, linen_id: str, principal: dict) -> dict:
        item = await self.repository.get_item(linen_id)
        if item is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Linen item not found")
        assert_organization_access(principal, str(item.get("organization_id") or ""))
        return {
            "health": await self.evaluate(item),
            "inspections": await self.repository.list_inspections(linen_id),
            "failures": await self.repository.list_failure_reports(linen_id),
            "replacements": await self.repository.list_replacements(linen_id),
        }
