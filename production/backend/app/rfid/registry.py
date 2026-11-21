"""RFID reader registration, authentication and revocation."""

from __future__ import annotations

import hmac
import hashlib
import secrets

from fastapi import HTTPException, status

from ..core.config import get_settings
from ..core.principal import assert_organization_access, is_platform_admin
from ..events.models import utc_now
from .adapters import build_adapter, supported_adapters
from .compatibility import compatibility_matrix


class ReaderRepository:
    async def save(self, reader: dict) -> dict:
        raise NotImplementedError

    async def get(self, reader_id: str) -> dict | None:
        raise NotImplementedError

    async def list(self, organization_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError


class InMemoryReaderRepository(ReaderRepository):
    def __init__(self) -> None:
        self.readers: dict[str, dict] = {}

    async def save(self, reader: dict) -> dict:
        self.readers[reader["reader_id"]] = dict(reader)
        return dict(reader)

    async def get(self, reader_id: str) -> dict | None:
        row = self.readers.get(reader_id)
        return dict(row) if row is not None else None

    async def list(self, organization_id=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.readers.values()
            if organization_id is None or row.get("organization_id") == organization_id
        ]
        return rows[:limit]


class MongoReaderRepository(ReaderRepository):
    def __init__(self, database) -> None:
        self.collection = database["rfid_readers"]

    @staticmethod
    def _clean(document: dict | None) -> dict | None:
        if document is None:
            return None
        return {key: value for key, value in document.items() if key != "_id"}

    async def save(self, reader: dict) -> dict:
        await self.collection.replace_one(
            {"reader_id": reader["reader_id"]}, dict(reader), upsert=True
        )
        return dict(reader)

    async def get(self, reader_id: str) -> dict | None:
        return self._clean(await self.collection.find_one({"reader_id": reader_id}))

    async def list(self, organization_id=None, limit=200) -> list[dict]:
        query = {"organization_id": organization_id} if organization_id else {}
        cursor = self.collection.find(query).limit(limit)
        return [self._clean(row) or {} for row in await cursor.to_list(length=limit)]


def hash_reader_key(api_key: str, master_key: str) -> str:
    return hmac.new(
        master_key.encode("utf-8"), api_key.encode("utf-8"), hashlib.sha256
    ).hexdigest()


class ReaderService:
    def __init__(
        self,
        repository: ReaderRepository,
        settings=None,
        outbox=None,
    ) -> None:
        self.repository = repository
        self.settings = settings or get_settings()
        self.outbox = outbox

    def _require_manage(self, principal: dict) -> None:
        if "manage_readers" not in (principal.get("capabilities") or []):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "RFID reader management capability required"
            )

    async def register(self, payload: dict, principal: dict) -> dict:
        self._require_manage(principal)
        reader_id = str(payload.get("reader_id") or "").strip()
        organization_id = str(payload.get("organization_id") or "").strip()
        adapter = str(payload.get("adapter") or "").strip().lower()
        if not reader_id or not organization_id or not adapter:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "reader_id, organization_id and adapter are required",
            )
        assert_organization_access(principal, organization_id)
        if adapter not in supported_adapters():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported RFID adapter")
        if adapter == "development":
            mode = str(getattr(self.settings, "rfid_mode", "production")).lower()
            if mode not in {"development", "test"} or not getattr(
                self.settings, "rfid_allow_simulated_reads", False
            ):
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "Simulated RFID readers are disabled in production",
                )

        reader = {
            "reader_id": reader_id,
            "organization_id": organization_id,
            "name": str(payload.get("name") or reader_id),
            "manufacturer": str(payload.get("manufacturer") or ""),
            "model": str(payload.get("model") or ""),
            "adapter": adapter,
            "transport": str(payload.get("transport") or "tcp"),
            "endpoint": str(payload.get("endpoint") or ""),
            "region": str(
                payload.get("region") or getattr(self.settings, "rfid_region", "")
            ),
            "frequency_mhz": payload.get(
                "frequency_mhz", getattr(self.settings, "rfid_frequency_mhz", None)
            ),
            "antenna_config": dict(payload.get("antenna_config") or {}),
            "capabilities": dict(payload.get("capabilities") or {}),
            "metadata": dict(payload.get("metadata") or {}),
            "status": "ACTIVE",
            "revoked": False,
            "created_at": utc_now(),
            "revoked_at": None,
            "last_seen_at": None,
        }
        try:
            build_adapter(reader, self.settings)
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

        api_key = secrets.token_urlsafe(32)
        reader["auth_key_hash"] = hash_reader_key(
            api_key, str(self.settings.master_key)
        )
        saved = await self.repository.save(reader)
        if self.outbox is not None:
            from ..events.models import new_event

            await self.outbox.publish(
                new_event(
                    "rfid.reader.registered",
                    organization_id,
                    "rfid-registry",
                    reader_id,
                    {"adapter": adapter, "name": reader["name"]},
                )
            )
        return {"reader": saved, "api_key": api_key}

    async def list(self, principal: dict, limit: int = 200) -> list[dict]:
        if is_platform_admin(principal):
            return await self.repository.list(limit=min(limit, 500))
        scopes = set(principal.get("organization_ids") or [])
        rows: list[dict] = []
        for organization_id in scopes:
            rows.extend(await self.repository.list(organization_id, limit=min(limit, 500)))
        return [
            {key: value for key, value in row.items() if key != "auth_key_hash"}
            for row in rows[:limit]
        ]

    async def get(self, reader_id: str, principal: dict) -> dict:
        reader = await self.repository.get(reader_id)
        if reader is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "RFID reader not found")
        assert_organization_access(principal, str(reader.get("organization_id") or ""))
        return {key: value for key, value in reader.items() if key != "auth_key_hash"}

    async def authenticate(self, reader_id: str, api_key: str) -> dict:
        if not reader_id or not api_key:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Reader credentials required")
        reader = await self.repository.get(reader_id)
        if reader is None or reader.get("revoked") or reader.get("status") != "ACTIVE":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Reader is not registered")
        expected = str(reader.get("auth_key_hash") or "")
        actual = hash_reader_key(api_key, str(self.settings.master_key))
        if not hmac.compare_digest(expected, actual):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid reader credentials")
        return reader

    async def heartbeat(self, reader_id: str, api_key: str) -> dict:
        reader = await self.authenticate(reader_id, api_key)
        return await self.heartbeat_authenticated(reader)

    async def heartbeat_authenticated(self, reader: dict) -> dict:
        reader_id = str(reader.get("reader_id") or "")
        reader["last_seen_at"] = utc_now()
        await self.repository.save(reader)
        return {"reader_id": reader_id, "last_seen_at": reader["last_seen_at"]}

    async def revoke(self, reader_id: str, principal: dict) -> dict:
        self._require_manage(principal)
        reader = await self.repository.get(reader_id)
        if reader is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "RFID reader not found")
        assert_organization_access(principal, str(reader.get("organization_id") or ""))
        reader["revoked"] = True
        reader["status"] = "REVOKED"
        reader["revoked_at"] = utc_now()
        saved = await self.repository.save(reader)
        if self.outbox is not None:
            from ..events.models import new_event

            await self.outbox.publish(
                new_event(
                    "rfid.reader.revoked",
                    str(reader.get("organization_id") or ""),
                    "rfid-registry",
                    reader_id,
                    {"reason": "operator revocation"},
                )
            )
        return {key: value for key, value in saved.items() if key != "auth_key_hash"}

    def matrix(self) -> list[dict]:
        return compatibility_matrix()
