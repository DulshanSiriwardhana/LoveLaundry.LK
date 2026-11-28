"""Application composition root.

All production services share one runtime instance so event publication,
consumption, notification delivery, reconciliation, and API reads observe the
same stores. Tests can replace the runtime atomically with `set_runtime`.
"""

from __future__ import annotations

from collections import defaultdict
from uuid import uuid4

from .analytics.dashboards import DashboardService
from .audit.service import AuditEventHandler, InMemoryAuditStore, MongoAuditStore
from .billing.repository import BillingRepository, InMemoryBillingRepository, MongoBillingRepository
from .billing.service import BillingEngine
from .billing.verification import (
    BillingVerificationService,
    InMemoryBillableEventRepository,
    MongoBillableEventRepository,
)
from .core.config import get_settings
from .db.connection import DatabaseKind, get_database
from .events.consumer import EventConsumer, InMemoryProcessedStore, MongoProcessedStore
from .events.outbox import InMemoryOutbox, MongoOutbox
from .identity.health import TagHealthService
from .identity.repository import (
    IdentityRepository,
    InMemoryIdentityRepository,
    MongoIdentityRepository,
)
from .identity.service import IdentityService
from .linen.missing import InMemoryMissingPolicyStore, MissingLinenMonitor, MongoMissingPolicyStore
from .linen.repository import InMemoryLinenProfileRepository, LinenProfileRepository, MongoLinenProfileRepository
from .linen.service import LinenWorkflow
from .rfid.registry import (
    InMemoryReaderRepository,
    MongoReaderRepository,
    ReaderRepository,
    ReaderService,
)
from .scanning.repository import (
    InMemoryScanningRepository,
    MongoScanningRepository,
    ScanningRepository,
)
from .scanning.sessions import ScanSessionService
from .scanning.transactions import ScanTransactionService
from .notifications.service import (
    InMemoryNotificationStore,
    MongoNotificationStore,
    NotificationEventHandler,
    NotificationHub,
)
from .operations.repository import OperationalRepository
from .platform.service import PlatformAdminService
from .reconciliation.service import (
    InMemoryReconciliationStore,
    MongoReconciliationStore,
    ReconciliationService,
)


_QUERY_OPERATORS = {"$eq", "$ne", "$in", "$nin", "$gt", "$gte", "$lt", "$lte", "$exists"}


def _matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(document, clause) for clause in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches(document, clause) for clause in expected):
                return False
            continue
        value = document.get(key)
        if isinstance(expected, dict) and set(expected).issubset(_QUERY_OPERATORS):
            for operator, operand in expected.items():
                if operator == "$eq" and value != operand:
                    return False
                if operator == "$ne" and value == operand:
                    return False
                if operator == "$in" and value not in operand:
                    return False
                if operator == "$nin" and value in operand:
                    return False
                if operator == "$exists" and (key in document) != bool(operand):
                    return False
                if operator in {"$gt", "$gte", "$lt", "$lte"}:
                    if value is None:
                        return False
                    if operator == "$gt" and not value > operand:
                        return False
                    if operator == "$gte" and not value >= operand:
                        return False
                    if operator == "$lt" and not value < operand:
                        return False
                    if operator == "$lte" and not value <= operand:
                        return False
            continue
        if value != expected:
            return False
    return True


def _sort_value(value):
    if value is None:
        return (0, 0, "")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return (1, value, "")
    return (2, 0, str(value))


class _WriteResult:
    def __init__(
        self,
        inserted_id=None,
        matched_count: int = 0,
        modified_count: int = 0,
    ) -> None:
        self.inserted_id = inserted_id
        self.matched_count = matched_count
        self.modified_count = modified_count


class _InMemoryCollection:
    def __init__(self) -> None:
        self.documents: list[dict] = []

    async def find(self, query: dict | None = None, projection=None):
        return _InMemoryCursor(
            [dict(row) for row in self.documents if _matches(row, query or {})]
        )

    async def find_one(self, query: dict | None = None, *, sort=None) -> dict | None:
        cursor = _InMemoryCursor(
            [dict(row) for row in self.documents if _matches(row, query or {})]
        )
        if sort:
            cursor.sort(sort)
        rows = await cursor.to_list(length=1)
        return rows[0] if rows else None

    async def count_documents(self, query: dict | None = None) -> int:
        cursor = await self.find(query)
        return len(await cursor.to_list(length=None))

    async def insert_one(self, document: dict) -> _WriteResult:
        row = dict(document)
        row.setdefault("_id", uuid4().hex)
        self.documents.append(row)
        return _WriteResult(inserted_id=row["_id"])

    def _apply_update(self, row: dict, update: dict, inserting: bool = False) -> None:
        for operator, fields in update.items():
            if operator == "$set":
                row.update({key: dict(value) if isinstance(value, dict) else value for key, value in fields.items()})
            elif operator == "$setOnInsert" and inserting:
                row.update(fields)
            elif operator == "$inc":
                for key, amount in fields.items():
                    row[key] = int(row.get(key) or 0) + int(amount)
            elif operator == "$unset":
                for key in fields:
                    row.pop(key, None)
            elif operator == "$setOnInsert":
                continue
            else:
                raise ValueError(f"Unsupported in-memory update operator: {operator}")

    async def update_one(
        self, query: dict, update: dict, upsert: bool = False
    ) -> _WriteResult:
        for index, row in enumerate(self.documents):
            if _matches(row, query):
                self._apply_update(row, update)
                return _WriteResult(matched_count=1, modified_count=1)
        if upsert:
            row = {
                key: value
                for key, value in query.items()
                if isinstance(value, (str, int, float, bool)) or value is None
            }
            self._apply_update(row, update, inserting=True)
            row.setdefault("_id", uuid4().hex)
            self.documents.append(row)
            return _WriteResult(inserted_id=row["_id"], matched_count=0, modified_count=1)
        return _WriteResult()

    async def find_one_and_update(
        self, query: dict, update: dict, *, upsert: bool = False, return_document=False
    ) -> dict | None:
        for row in self.documents:
            if _matches(row, query):
                self._apply_update(row, update)
                return dict(row)
        if not upsert:
            return None
        row = {
            key: value
            for key, value in query.items()
            if isinstance(value, (str, int, float, bool)) or value is None
        }
        self._apply_update(row, update, inserting=True)
        row.setdefault("_id", uuid4().hex)
        self.documents.append(row)
        return dict(row)

    async def replace_one(self, query: dict, document: dict, upsert: bool = False) -> _WriteResult:
        for index, row in enumerate(self.documents):
            if _matches(row, query):
                self.documents[index] = dict(document)
                return _WriteResult(matched_count=1, modified_count=1)
        if upsert:
            row = dict(document)
            row.setdefault("_id", uuid4().hex)
            self.documents.append(row)
            return _WriteResult(inserted_id=row["_id"])
        return _WriteResult()


class _InMemoryCursor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def limit(self, count: int):
        self.rows = self.rows[:count]
        return self

    def skip(self, count: int):
        self.rows = self.rows[count:]
        return self

    def sort(self, key, direction: int = 1):
        specs = key if isinstance(key, (list, tuple)) else [(key, direction)]
        for field, order in reversed(list(specs)):
            self.rows.sort(
                key=lambda row: _sort_value(row.get(field)), reverse=order < 0
            )
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        return self.rows if length is None else self.rows[:length]

    def __aiter__(self):
        async def iterate():
            for row in self.rows:
                yield row

        return iterate()


class InMemoryDatabase:
    """Storage used by the explicit `PERSISTENCE=memory` mode.

    It contains no seeded records; collections stay empty until application
    code writes a real document.
    """

    def __init__(self) -> None:
        self._collections: dict[str, _InMemoryCollection] = defaultdict(_InMemoryCollection)

    def __getitem__(self, name: str) -> _InMemoryCollection:
        return self._collections[name]


class Runtime:
    def __init__(
        self,
        outbox,
        processed,
        audit_store,
        notification_store,
        notification_hub,
        linen_repository: LinenProfileRepository,
        billing_repository: BillingRepository,
        policies,
        reconciliation_store,
        platform_service: PlatformAdminService,
        identity_repository: IdentityRepository | None = None,
        reader_repository: ReaderRepository | None = None,
        scanning_repository: ScanningRepository | None = None,
        billable_event_repository=None,
        settings=None,
        central_database=None,
        laundry_database=None,
        linen_database=None,
    ) -> None:
        self.settings = settings or get_settings()
        self.central_database = central_database
        self.laundry_database = laundry_database
        self.linen_database = linen_database
        self.operational = OperationalRepository(laundry_database, linen_database)
        self.outbox = outbox
        self.processed = processed
        self.audit_store = audit_store
        self.notification_store = notification_store
        self.notification_hub = notification_hub
        self.linen_repository = linen_repository
        self.billing_repository = billing_repository
        self.policies = policies
        self.reconciliation_store = reconciliation_store
        self.platform_service = platform_service

        self.consumer = EventConsumer(
            self.outbox,
            self.processed,
            [
                AuditEventHandler(self.audit_store),
                NotificationEventHandler(self.notification_store, self.notification_hub),
            ],
        )
        self.linen_service = LinenWorkflow(self.linen_repository, self.outbox)
        self.missing_monitor = MissingLinenMonitor(
            self.linen_repository, self.policies, self.outbox
        )
        self.billing_engine = BillingEngine(self.billing_repository, self.outbox)

        self.identity_repository = identity_repository or InMemoryIdentityRepository()
        self.identity_service = IdentityService(
            self.identity_repository, self.outbox, self.settings
        )
        self.tag_health = TagHealthService(
            self.identity_repository, self.settings, self.outbox
        )
        self.reader_repository = reader_repository or InMemoryReaderRepository()
        self.reader_service = ReaderService(
            self.reader_repository, self.settings, self.outbox
        )
        self.scanning_repository = scanning_repository or InMemoryScanningRepository()
        self.billable_event_repository = (
            billable_event_repository or InMemoryBillableEventRepository()
        )
        self.billing_verification = BillingVerificationService(
            self.billable_event_repository, self.billing_repository
        )
        self.scan_transactions = ScanTransactionService(
            self.scanning_repository,
            self.identity_service,
            self.linen_service,
            self.billing_verification,
            self.outbox,
        )
        self.scan_sessions = ScanSessionService(
            self.scanning_repository,
            self.identity_service,
            self.scan_transactions,
            self.settings,
            self.outbox,
        )
        self.dashboards = DashboardService(
            self.identity_repository,
            self.linen_repository,
            self.scanning_repository,
            self.reader_repository,
            self.tag_health,
        )
        self.reconciliation = ReconciliationService(
            self.linen_repository,
            self.billing_repository,
            self.outbox,
            self.reconciliation_store,
        )


def _build_runtime() -> Runtime:
    settings = get_settings()
    if settings.persistence == "mongo":
        central = get_database(DatabaseKind.CENTRAL_SYSTEM)
        laundry = get_database(DatabaseKind.LAUNDRY_INTERNAL)
        linen = get_database(DatabaseKind.LINEN_TRACKING)
        return Runtime(
            outbox=MongoOutbox(central),
            processed=MongoProcessedStore(central),
            audit_store=MongoAuditStore(central),
            notification_store=MongoNotificationStore(central),
            notification_hub=NotificationHub(),
            linen_repository=MongoLinenProfileRepository(linen),
            billing_repository=MongoBillingRepository(laundry),
            policies=MongoMissingPolicyStore(central),
            reconciliation_store=MongoReconciliationStore(central),
            platform_service=PlatformAdminService(
                central, laundry, linen, MongoAuditStore(central)
            ),
            identity_repository=MongoIdentityRepository(linen, central),
            reader_repository=MongoReaderRepository(central),
            scanning_repository=MongoScanningRepository(linen),
            billable_event_repository=MongoBillableEventRepository(laundry),
            settings=settings,
            central_database=central,
            laundry_database=laundry,
            linen_database=linen,
        )

    central = InMemoryDatabase()
    laundry = InMemoryDatabase()
    linen = InMemoryDatabase()
    audit_store = InMemoryAuditStore()
    return Runtime(
        outbox=InMemoryOutbox(),
        processed=InMemoryProcessedStore(),
        audit_store=audit_store,
        notification_store=InMemoryNotificationStore(),
        notification_hub=NotificationHub(),
        linen_repository=InMemoryLinenProfileRepository(),
        billing_repository=InMemoryBillingRepository(),
        policies=InMemoryMissingPolicyStore(),
        reconciliation_store=InMemoryReconciliationStore(),
        platform_service=PlatformAdminService(central, laundry, linen, audit_store),
        settings=get_settings(),
        central_database=central,
        laundry_database=laundry,
        linen_database=linen,
    )


_runtime: Runtime | None = None


def get_runtime() -> Runtime:
    global _runtime
    if _runtime is None:
        _runtime = _build_runtime()
    return _runtime


def set_runtime(runtime: Runtime | None) -> None:
    global _runtime
    _runtime = runtime


def reset_runtime() -> None:
    set_runtime(None)
