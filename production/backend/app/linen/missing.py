"""Lifecycle-aware missing/overdue detection with deduplicated alerts."""

from __future__ import annotations

from datetime import datetime, timezone

from ..events.models import new_event, utc_now
from ..events.outbox import OutboxStore
from .lifecycle import (
    AVAILABLE,
    DISPATCHED_FROM_CLIENT,
    DISPATCHED_FROM_LAUNDRY,
    is_in_progress_stage,
)
from .repository import LinenProfileRepository


class MissingPolicyStore:
    async def policies(self) -> list[dict]:
        raise NotImplementedError


class InMemoryMissingPolicyStore(MissingPolicyStore):
    def __init__(self, policies: list[dict] | None = None) -> None:
        self.rows = policies or [
            {
                "policy_id": "default-15",
                "name": "Default 15 days",
                "threshold_days": 15,
                "enabled": True,
                "exempt_stages": [],
            }
        ]

    async def policies(self) -> list[dict]:
        return list(self.rows)


class MongoMissingPolicyStore(MissingPolicyStore):
    def __init__(self, database) -> None:
        self.collection = database["missing_alert_policies"]

    async def policies(self) -> list[dict]:
        cursor = self.collection.find({"enabled": True})
        return [
            {key: value for key, value in row.items() if key != "_id"}
            for row in await cursor.to_list(length=200)
        ]


def _days_since(value: str | None) -> int:
    if not value:
        return 0
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - parsed).total_seconds() // 86400))


class MissingLinenMonitor:
    def __init__(
        self,
        repository: LinenProfileRepository,
        policies: MissingPolicyStore,
        outbox: OutboxStore,
    ) -> None:
        self.repository = repository
        self.policies = policies
        self.outbox = outbox

    def _policy_for(self, policies: list[dict], profile: dict) -> dict:
        category = str(profile.get("category") or "")
        organization_id = str(profile.get("organization_id") or "")
        candidates = [
            policy
            for policy in policies
            if (
                str(policy.get("linen_category") or "") == category
                or str(policy.get("organization_id") or "") == organization_id
            )
        ]
        general = [policy for policy in policies if not policy.get("linen_category")]
        return (candidates or general or [{"threshold_days": 15, "exempt_stages": []}])[0]

    def severity(self, days: int, threshold: int) -> str:
        if days >= threshold * 4:
            return "critical"
        if days >= threshold * 3:
            return "red"
        if days >= threshold * 2:
            return "orange"
        if days >= threshold:
            return "amber"
        return "normal"

    async def scan(self, organization_id: str | None = None) -> dict:
        policies = [policy for policy in await self.policies.policies() if policy.get("enabled", True)]
        profiles = await self.repository.list(organization_id=organization_id, limit=5000)
        created = 0
        flagged = 0
        for profile in profiles:
            stage = str(profile.get("current_stage") or "")
            if is_in_progress_stage(stage):
                continue
            policy = self._policy_for(policies, profile)
            if stage in set(policy.get("exempt_stages") or []):
                continue
            threshold = max(1, int(policy.get("threshold_days") or 15))
            days = _days_since(profile.get("last_seen_at"))
            if days < threshold:
                continue
            flagged += 1
            severity = self.severity(days, threshold)
            alert = {
                "alert_id": f"missing-{profile['linen_id']}",
                "linen_id": profile["linen_id"],
                "organization_id": profile.get("organization_id", ""),
                "severity": severity,
                "status": "open",
                "days_since_last_seen": days,
                "threshold_days": threshold,
                "policy_id": policy.get("policy_id", ""),
                "last_seen_at": profile.get("last_seen_at", ""),
                "last_known_location": profile.get("current_location", ""),
                "current_stage": stage,
                "created_at": utc_now(),
            }
            is_new = await self.repository.save_alert(alert)
            if not is_new:
                continue
            created += 1
            await self.outbox.publish(
                new_event(
                    "linen.missing.detected",
                    alert["organization_id"],
                    "missing-monitor",
                    profile["linen_id"],
                    {
                        "alert_id": alert["alert_id"],
                        "severity": severity,
                        "days_since_last_seen": days,
                        "threshold_days": threshold,
                    },
                )
            )
        return {"evaluated": len(profiles), "flagged": flagged, "alerts_created": created}

    async def resolve(self, alert_id: str, actor: str) -> dict:
        alert = next(
            (
                row
                for row in await self.repository.list_alerts(status="open", limit=5000)
                if row.get("alert_id") == alert_id
            ),
            None,
        )
        if alert is None:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Open missing-linen alert not found")
        resolved = dict(alert)
        resolved.update(
            {
                "status": "resolved",
                "resolved_by": actor,
                "resolved_at": utc_now(),
                "investigation": {
                    **(alert.get("investigation") or {}),
                    "resolution": "reconciled_by_scan",
                    "resolved_by": actor,
                    "resolved_at": utc_now(),
                },
            }
        )
        await self.repository.save_alert(resolved)
        await self.outbox.publish(
            new_event(
                "linen.missing.resolved",
                alert.get("organization_id", ""),
                "missing-monitor",
                alert["linen_id"],
                {"alert_id": alert_id, "resolved_by": actor},
            )
        )
        return resolved
