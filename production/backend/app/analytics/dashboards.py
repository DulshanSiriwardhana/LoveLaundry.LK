"""Dashboard figures derived from authoritative stores, never frontend state."""

from __future__ import annotations

from collections import Counter

from ..core.principal import assert_organization_access, is_platform_admin
from ..identity.health import TagHealthService
from ..identity.repository import IdentityRepository
from ..linen.lifecycle import DRYING, INSPECTED, IRONING, READY, RECEIVED_AT_LAUNDRY, SORTED, WASHING
from ..linen.repository import LinenProfileRepository
from ..rfid.registry import ReaderRepository
from ..scanning.repository import ScanningRepository


class DashboardService:
    def __init__(
        self,
        identity_repository: IdentityRepository,
        linen_repository: LinenProfileRepository,
        scanning_repository: ScanningRepository,
        reader_repository: ReaderRepository,
        tag_health: TagHealthService,
    ) -> None:
        self.identity_repository = identity_repository
        self.linen_repository = linen_repository
        self.scanning_repository = scanning_repository
        self.reader_repository = reader_repository
        self.tag_health = tag_health

    async def _scopes(self, principal: dict, organization_id: str | None) -> list[str]:
        if organization_id:
            assert_organization_access(principal, organization_id)
            return [organization_id]
        if is_platform_admin(principal):
            return []
        scopes = sorted(set(principal.get("organization_ids") or []))
        if not scopes:
            from fastapi import HTTPException, status

            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Organization scope is required"
            )
        return scopes

    async def _items(self, scopes: list[str]) -> list[dict]:
        if not scopes:
            return await self.identity_repository.list_items(limit=5000)
        rows: list[dict] = []
        for organization_id in scopes:
            rows.extend(
                await self.identity_repository.list_items(
                    organization_id=organization_id, limit=5000
                )
            )
        return rows

    async def _profiles(self, scopes: list[str]) -> list[dict]:
        if not scopes:
            return await self.linen_repository.list(limit=5000)
        rows: list[dict] = []
        for organization_id in scopes:
            rows.extend(
                await self.linen_repository.list(organization_id=organization_id, limit=5000)
            )
        return rows

    async def platform(self, principal: dict) -> dict:
        items = await self._items(await self._scopes(principal, None))
        profiles = await self._profiles(await self._scopes(principal, None))
        stages = Counter(str(row.get("current_stage") or "") for row in profiles)
        readers = await self.reader_repository.list(limit=500)
        scans = await self.scanning_repository.list_transactions(limit=500)
        alerts = await self.tag_health.alerts(principal, limit=500)
        return {
            "total_linen_items": len(items),
            "active_qr_tags": sum(
                1 for row in items if str(row.get("qr_id") or "") and str(row.get("tag_status") or "ACTIVE").upper() == "ACTIVE"
            ),
            "active_rfid_tags": sum(
                1 for row in items if str(row.get("epc") or "") and str(row.get("tag_status") or "ACTIVE").upper() == "ACTIVE"
            ),
            "linen_at_hotels": stages.get("available_in_inventory", 0)
            + stages.get("hotel_inventory", 0),
            "linen_at_laundries": sum(
                stages.get(stage, 0)
                for stage in (
                    RECEIVED_AT_LAUNDRY,
                    SORTED,
                    WASHING,
                    DRYING,
                    IRONING,
                    INSPECTED,
                    READY,
                )
            ),
            "linen_in_transit": stages.get("dispatched_from_client", 0)
            + stages.get("dispatched_from_laundry", 0),
            "missing_linen": stages.get("missing", 0),
            "damaged_linen": stages.get("damaged", 0),
            "awaiting_processing": stages.get("received_at_laundry", 0)
            + stages.get("sorted_and_classified", 0),
            "tag_replacement_alerts": sum(
                1 for row in alerts if row["signal"] in {"replacement_planning", "manufacturer_rated_limit_reached"}
            ),
            "reader_health": {
                "registered": len(readers),
                "active": sum(1 for row in readers if row.get("status") == "ACTIVE" and not row.get("revoked")),
                "revoked": sum(1 for row in readers if row.get("revoked")),
            },
            "recent_scans": scans[:20],
            "stage_breakdown": dict(stages),
        }

    async def hotel(self, principal: dict, organization_id: str | None = None) -> dict:
        scopes = await self._scopes(principal, organization_id)
        items = await self._items(scopes)
        profiles = await self._profiles(scopes)
        stages = Counter(str(row.get("current_stage") or "") for row in profiles)
        alerts = await self.tag_health.alerts(principal, limit=500)
        return {
            "organization_ids": scopes,
            "owned_inventory": len(items),
            "clean_linen": stages.get("available_in_inventory", 0),
            "dirty_linen": stages.get("collected_for_laundry", 0),
            "dispatched": stages.get("dispatched_from_client", 0),
            "received": stages.get("received_at_client", 0),
            "missing": stages.get("missing", 0),
            "damaged": stages.get("damaged", 0),
            "tag_alerts": len(alerts),
            "stage_breakdown": dict(stages),
        }

    async def laundry(self, principal: dict, organization_id: str | None = None) -> dict:
        scopes = await self._scopes(principal, organization_id)
        profiles = await self._profiles(scopes)
        stages = Counter(str(row.get("current_stage") or "") for row in profiles)
        sessions = await self.scanning_repository.list_sessions(
            scopes[0] if len(scopes) == 1 else None, limit=200
        )
        return {
            "organization_ids": scopes,
            "dirty_received": stages.get(RECEIVED_AT_LAUNDRY, 0),
            "awaiting_sorting": stages.get(SORTED, 0),
            "in_washing": stages.get(WASHING, 0),
            "in_drying": stages.get(DRYING, 0),
            "in_ironing": stages.get(IRONING, 0),
            "awaiting_quality_check": stages.get(INSPECTED, 0),
            "clean_stock": stages.get(READY, 0),
            "dispatch_ready": stages.get(READY, 0),
            "active_scan_sessions": sum(1 for row in sessions if row.get("status") == "ACTIVE"),
            "stage_breakdown": dict(stages),
        }
