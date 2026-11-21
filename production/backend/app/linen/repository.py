"""Repository boundary for the authoritative linen registry and scan ledger."""

from __future__ import annotations

from ..events.models import utc_now


class LinenProfileRepository:
    async def get(self, linen_id: str) -> dict | None:
        raise NotImplementedError

    async def find_by_code(self, organization_id: str, code: str) -> dict | None:
        raise NotImplementedError

    async def register(self, profile: dict) -> dict:
        raise NotImplementedError

    async def save(self, profile: dict) -> dict:
        raise NotImplementedError

    async def increment(self, linen_id: str, field: str) -> dict | None:
        raise NotImplementedError

    async def list(
        self,
        organization_id: str | None = None,
        stage: str | None = None,
        status: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        raise NotImplementedError

    async def insert_scan(self, scan: dict) -> bool:
        """Insert a scan event once. False means an idempotent duplicate."""
        raise NotImplementedError

    async def list_scans(
        self,
        linen_id: str | None = None,
        organization_id: str | None = None,
        limit: int = 200,
    ) -> list[dict]:
        raise NotImplementedError

    async def list_manifests(
        self, organization_id: str | None = None, limit: int = 200
    ) -> list[dict]:
        raise NotImplementedError

    async def save_alert(self, alert: dict) -> bool:
        """Create or update an alert. False means a duplicate open alert existed."""
        raise NotImplementedError

    async def list_alerts(
        self, organization_id: str | None = None, status: str | None = None, limit: int = 200
    ) -> list[dict]:
        raise NotImplementedError


class InMemoryLinenProfileRepository(LinenProfileRepository):
    def __init__(self) -> None:
        self.profiles: dict[str, dict] = {}
        self.scans: dict[str, dict] = {}
        self.alerts: dict[str, dict] = {}
        self.manifests: dict[str, dict] = {}

    async def get(self, linen_id: str) -> dict | None:
        return dict(self.profiles.get(linen_id) or {})

    async def find_by_code(self, organization_id: str, code: str) -> dict | None:
        for profile in self.profiles.values():
            if profile.get("organization_id") == organization_id and profile.get("code") == code:
                return dict(profile)
        return None

    async def register(self, profile: dict) -> dict:
        if profile["linen_id"] in self.profiles:
            return dict(self.profiles[profile["linen_id"]])
        document = dict(profile)
        document.setdefault("created_at", utc_now())
        self.profiles[document["linen_id"]] = document
        return dict(document)

    async def save(self, profile: dict) -> dict:
        document = dict(profile)
        document["updated_at"] = utc_now()
        self.profiles[document["linen_id"]] = document
        return dict(document)

    async def increment(self, linen_id: str, field: str) -> dict | None:
        profile = self.profiles.get(linen_id)
        if profile is None:
            return None
        profile[field] = int(profile.get(field) or 0) + 1
        profile["updated_at"] = utc_now()
        return dict(profile)

    async def list(self, organization_id=None, stage=None, status=None, limit=200) -> list[dict]:
        rows = list(self.profiles.values())
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        if stage:
            rows = [row for row in rows if row.get("current_stage") == stage]
        if status:
            rows = [row for row in rows if row.get("status") == status]
        return [dict(row) for row in rows[:limit]]

    async def insert_scan(self, scan: dict) -> bool:
        if scan["scan_id"] in self.scans:
            return False
        self.scans[scan["scan_id"]] = dict(scan)
        return True

    async def list_scans(self, linen_id=None, organization_id=None, limit=200) -> list[dict]:
        rows = list(self.scans.values())
        if linen_id:
            rows = [row for row in rows if row.get("linen_id") == linen_id]
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        return [dict(row) for row in rows[:limit]]

    async def list_manifests(self, organization_id=None, limit=200) -> list[dict]:
        rows = list(self.manifests.values())
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        return [dict(row) for row in rows[:limit]]

    async def save_alert(self, alert: dict) -> bool:
        alert_id = alert["alert_id"]
        existing = self.alerts.get(alert_id)
        open_alert = next(
            (
                row
                for row in self.alerts.values()
                if row.get("linen_id") == alert["linen_id"]
                and row.get("status") == "open"
                and row.get("alert_id") != alert_id
            ),
            None,
        )
        if existing is not None or open_alert is not None:
            target = existing or open_alert
            target.update(alert)
            target["updated_at"] = utc_now()
            return False
        document = dict(alert)
        document.setdefault("created_at", utc_now())
        self.alerts[document["alert_id"]] = document
        return True

    async def list_alerts(self, organization_id=None, status=None, limit=200) -> list[dict]:
        rows = list(self.alerts.values())
        if organization_id:
            rows = [row for row in rows if row.get("organization_id") == organization_id]
        if status:
            rows = [row for row in rows if row.get("status") == status]
        return [dict(row) for row in rows[:limit]]


class MongoLinenProfileRepository(LinenProfileRepository):
    def __init__(self, database) -> None:
        self.profiles = database["linen_profiles"]
        self.scans = database["scan_events"]
        self.alerts = database["missing_alerts"]
        self.manifests = database["manifests"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def get(self, linen_id: str) -> dict | None:
        return self._clean(await self.profiles.find_one({"linen_id": linen_id}))

    async def find_by_code(self, organization_id: str, code: str) -> dict | None:
        return self._clean(
            await self.profiles.find_one(
                {"organization_id": organization_id, "code": code}
            )
        )

    async def register(self, profile: dict) -> dict:
        document = dict(profile)
        document.setdefault("created_at", utc_now())
        try:
            await self.profiles.insert_one(document)
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return await self.get(document["linen_id"]) or document
        return self._clean(document) or document

    async def save(self, profile: dict) -> dict:
        document = dict(profile)
        document["updated_at"] = utc_now()
        await self.profiles.replace_one({"linen_id": document["linen_id"]}, document, upsert=True)
        return self._clean(document) or document

    async def increment(self, linen_id: str, field: str) -> dict | None:
        document = await self.profiles.find_one_and_update(
            {"linen_id": linen_id},
            {"$inc": {field: 1}, "$set": {"updated_at": utc_now()}},
            return_document=True,
        )
        return self._clean(document)

    async def list(self, organization_id=None, stage=None, status=None, limit=200) -> list[dict]:
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        if stage:
            query["current_stage"] = stage
        if status:
            query["status"] = status
        cursor = self.profiles.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def insert_scan(self, scan: dict) -> bool:
        try:
            await self.scans.insert_one(dict(scan))
            return True
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return False

    async def list_scans(self, linen_id=None, organization_id=None, limit=200) -> list[dict]:
        query: dict = {}
        if linen_id:
            query["linen_id"] = linen_id
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.scans.find(query).sort("occurred_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def list_manifests(self, organization_id=None, limit=200) -> list[dict]:
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        cursor = self.manifests.find(query).sort("created_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_alert(self, alert: dict) -> bool:
        existing = await self.alerts.find_one({"alert_id": alert["alert_id"]})
        open_alert = (
            None
            if existing is not None
            else await self.alerts.find_one(
                {"linen_id": alert["linen_id"], "status": "open"}
            )
        )
        if existing is not None or open_alert is not None:
            update = dict(alert)
            update["updated_at"] = utc_now()
            target = existing or open_alert
            await self.alerts.update_one({"_id": target["_id"]}, {"$set": update})
            return False
        document = dict(alert)
        document.setdefault("created_at", utc_now())
        try:
            await self.alerts.insert_one(document)
            return True
        except Exception as exc:
            if "duplicate" not in str(exc).lower():
                raise
            return False

    async def list_alerts(self, organization_id=None, status=None, limit=200) -> list[dict]:
        query: dict = {}
        if organization_id:
            query["organization_id"] = organization_id
        if status:
            query["status"] = status
        cursor = self.alerts.find(query).sort("created_at", -1).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]
