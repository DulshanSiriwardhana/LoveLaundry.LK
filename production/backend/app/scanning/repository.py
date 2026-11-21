"""Storage boundary for idempotent scan transactions and bulk sessions."""

from __future__ import annotations

from pymongo.errors import DuplicateKeyError

from ..events.models import utc_now


class ScanningRepository:
    async def insert_transaction(self, row: dict) -> bool:
        raise NotImplementedError

    async def get_transaction(self, scan_id: str) -> dict | None:
        raise NotImplementedError

    async def update_transaction(self, transaction_id: str, patch: dict) -> None:
        raise NotImplementedError

    async def list_transactions(self, organization_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def save_session(self, row: dict) -> dict:
        raise NotImplementedError

    async def get_session(self, session_id: str) -> dict | None:
        raise NotImplementedError

    async def list_sessions(self, organization_id: str | None = None, limit: int = 200) -> list[dict]:
        raise NotImplementedError

    async def insert_read(self, row: dict) -> bool:
        raise NotImplementedError

    async def update_read(self, read_id: str, patch: dict) -> None:
        raise NotImplementedError

    async def list_reads(self, session_id: str, limit: int = 5000) -> list[dict]:
        raise NotImplementedError

    async def save_wash_cycle(self, row: dict) -> bool:
        raise NotImplementedError

    async def list_wash_cycles(self, linen_id: str, limit: int = 200) -> list[dict]:
        raise NotImplementedError


def _clean(document: dict | None) -> dict | None:
    if document is None:
        return None
    return {key: value for key, value in document.items() if key != "_id"}


class InMemoryScanningRepository(ScanningRepository):
    def __init__(self) -> None:
        self.transactions: dict[str, dict] = {}
        self.sessions: dict[str, dict] = {}
        self.reads: dict[str, dict] = {}
        self.wash_cycles: dict[str, dict] = {}

    async def insert_transaction(self, row: dict) -> bool:
        if row["scan_id"] in self.transactions:
            return False
        self.transactions[row["scan_id"]] = dict(row)
        return True

    async def get_transaction(self, scan_id: str) -> dict | None:
        row = self.transactions.get(scan_id)
        return dict(row) if row is not None else None

    async def update_transaction(self, transaction_id: str, patch: dict) -> None:
        for row in self.transactions.values():
            if row.get("transaction_id") == transaction_id:
                row.update(dict(patch))
                return

    async def list_transactions(self, organization_id=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.transactions.values()
            if organization_id is None or row.get("organization_id") == organization_id
        ]
        return rows[:limit]

    async def save_session(self, row: dict) -> dict:
        self.sessions[row["session_id"]] = dict(row)
        return dict(row)

    async def get_session(self, session_id: str) -> dict | None:
        row = self.sessions.get(session_id)
        return dict(row) if row is not None else None

    async def list_sessions(self, organization_id=None, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.sessions.values()
            if organization_id is None or row.get("organization_id") == organization_id
        ]
        return rows[:limit]

    async def insert_read(self, row: dict) -> bool:
        if row["read_id"] in self.reads:
            return False
        self.reads[row["read_id"]] = dict(row)
        return True

    async def update_read(self, read_id: str, patch: dict) -> None:
        row = self.reads.get(read_id)
        if row is not None:
            row.update(dict(patch))

    async def list_reads(self, session_id: str, limit=5000) -> list[dict]:
        rows = [dict(row) for row in self.reads.values() if row.get("session_id") == session_id]
        return rows[:limit]

    async def save_wash_cycle(self, row: dict) -> bool:
        if row["cycle_id"] in self.wash_cycles:
            return False
        self.wash_cycles[row["cycle_id"]] = dict(row)
        return True

    async def list_wash_cycles(self, linen_id: str, limit=200) -> list[dict]:
        rows = [
            dict(row)
            for row in self.wash_cycles.values()
            if row.get("linen_id") == linen_id
        ]
        return sorted(rows, key=lambda row: row.get("wash_count") or 0, reverse=True)[:limit]


class MongoScanningRepository(ScanningRepository):
    def __init__(self, database) -> None:
        self.transactions = database["scan_transactions"]
        self.sessions = database["scan_sessions"]
        self.reads = database["scan_session_reads"]
        self.wash_cycles = database["linen_wash_cycles"]

    async def insert_transaction(self, row: dict) -> bool:
        try:
            await self.transactions.insert_one(dict(row))
            return True
        except DuplicateKeyError:
            return False

    async def get_transaction(self, scan_id: str) -> dict | None:
        return _clean(await self.transactions.find_one({"scan_id": scan_id}))

    async def update_transaction(self, transaction_id: str, patch: dict) -> None:
        await self.transactions.update_one(
            {"transaction_id": transaction_id}, {"$set": dict(patch)}
        )

    async def list_transactions(self, organization_id=None, limit=200) -> list[dict]:
        query = {"organization_id": organization_id} if organization_id else {}
        cursor = self.transactions.find(query).limit(limit)
        return [_clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_session(self, row: dict) -> dict:
        await self.sessions.replace_one({"session_id": row["session_id"]}, dict(row), upsert=True)
        return dict(row)

    async def get_session(self, session_id: str) -> dict | None:
        return _clean(await self.sessions.find_one({"session_id": session_id}))

    async def list_sessions(self, organization_id=None, limit=200) -> list[dict]:
        query = {"organization_id": organization_id} if organization_id else {}
        cursor = self.sessions.find(query).limit(limit)
        return [_clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def insert_read(self, row: dict) -> bool:
        try:
            await self.reads.insert_one(dict(row))
            return True
        except DuplicateKeyError:
            return False

    async def update_read(self, read_id: str, patch: dict) -> None:
        await self.reads.update_one({"read_id": read_id}, {"$set": dict(patch)})

    async def list_reads(self, session_id: str, limit=5000) -> list[dict]:
        cursor = self.reads.find({"session_id": session_id}).limit(limit)
        return [_clean(row) or {} for row in await cursor.to_list(length=limit)]

    async def save_wash_cycle(self, row: dict) -> bool:
        try:
            await self.wash_cycles.insert_one(dict(row))
            return True
        except DuplicateKeyError:
            return False

    async def list_wash_cycles(self, linen_id: str, limit=200) -> list[dict]:
        cursor = self.wash_cycles.find({"linen_id": linen_id}).sort("wash_count", -1).limit(limit)
        return [_clean(row) or {} for row in await cursor.to_list(length=limit)]
