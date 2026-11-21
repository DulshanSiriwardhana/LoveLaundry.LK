"""Read models for the isolated Platform Admin portal.

Every value comes from a production collection. Empty collections return empty
lists; the portal never substitutes sample or generated records.
"""

from __future__ import annotations

import inspect
import uuid

from ..audit.service import AuditStore
from ..events.models import utc_now


def _clean(document: dict | None) -> dict | None:
    if document is None:
        return None
    return {key: value for key, value in document.items() if key != "_id"}


async def _all(collection, limit: int) -> list[dict]:
    found = collection.find({})
    if inspect.isawaitable(found):
        found = await found
    cursor = found.limit(limit)
    rows = cursor.to_list(length=limit)
    if inspect.isawaitable(rows):
        rows = await rows
    return [_clean(row) or {} for row in rows]


class PlatformAdminService:
    def __init__(
        self,
        central_database,
        laundry_database,
        linen_database,
        audit_store: AuditStore,
    ) -> None:
        self.central = central_database
        self.laundry = laundry_database
        self.linen = linen_database
        self.audit_store = audit_store

    async def summary(self) -> dict:
        collections = {
            "laundries": self.central["laundries"],
            "hotels": self.central["hotels"],
            "shops": self.central["shops"],
            "users": self.central["users"],
            "invoices": self.laundry["invoices"],
            "linen_profiles": self.linen["linen_profiles"],
            "missing_alerts": self.linen["missing_alerts"],
        }
        counts: dict[str, int] = {}
        for name, collection in collections.items():
            try:
                counts[name] = await collection.count_documents({})
            except Exception:
                counts[name] = 0
        return {"counts": counts, "audit_entries": await self.audit_store.count()}

    async def organizations(self) -> list[dict]:
        rows: list[dict] = []
        for kind in ("laundries", "hotels", "shops"):
            for document in await _all(self.central[kind], 500):
                identifier = (
                    document.get("laundry_id")
                    or document.get("hotel_id")
                    or document.get("shop_id")
                    or document.get("id")
                    or document.get("_id")
                )
                rows.append(
                    {
                        "organization_id": str(identifier or ""),
                        "name": str(document.get("name") or document.get("user_name") or ""),
                        "type": kind[:-1],
                        "status": str(document.get("status") or ""),
                    }
                )
        return rows

    async def announcements(self) -> list[dict]:
        return await _all(self.central["announcements"], 200)

    async def themes(self) -> list[dict]:
        return await _all(self.central["appearance_settings"], 200)

    async def audit(self, limit: int = 200) -> list[dict]:
        return await self.audit_store.list(min(limit, 500))

    async def save_announcement(self, payload: dict) -> dict:
        document = dict(payload)
        if not document.get("announcement_id"):
            document["announcement_id"] = f"ann-{uuid.uuid4().hex[:12]}"
        document.setdefault("enabled", True)
        document.setdefault("created_at", utc_now())
        await self.central["announcements"].replace_one(
            {"announcement_id": document["announcement_id"]}, document, upsert=True
        )
        return _clean(document) or document

    async def save_theme(self, payload: dict) -> dict:
        document = dict(payload)
        if not document.get("settings_id"):
            document["settings_id"] = f"theme-{uuid.uuid4().hex[:12]}"
        document.setdefault("scope", "global")
        document.setdefault("status", "active")
        document["updated_at"] = utc_now()
        await self.central["appearance_settings"].replace_one(
            {"settings_id": document["settings_id"]}, document, upsert=True
        )
        return _clean(document) or document
