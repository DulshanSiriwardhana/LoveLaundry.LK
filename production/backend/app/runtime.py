"""Application composition root.

All production services share one runtime instance so event publication,
consumption, notification delivery, reconciliation, and API reads observe the
same stores. Tests can replace the runtime atomically with `set_runtime`.
"""

from __future__ import annotations

from collections import defaultdict

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
from .platform.service import PlatformAdminService
from .reconciliation.service import (
    InMemoryReconciliationStore,
    MongoReconciliationStore,
    ReconciliationService,
)


class _InMemoryCollection:
    def __init__(self) -> None:
        self.documents: list[dict] = []

    async def find(self, query: dict | None = None):
        query = query or {}

        def matches(document: dict) -> bool:
            for key, expected in query.items():
                value = document.get(key)
                if isinstance(expected, dict) and "$exists" in expected:
                    exists = key in document
                    if exists != bool(expected["$exists"]):
                        return False
                    continue
                if value != expected:
                    return False
            return True

        return _InMemoryCursor([dict(row) for row in self.documents if matches(row)])

    async def count_documents(self, query: dict | None = None) -> int:
        cursor = await self.find(query)
        return len(await cursor.to_list(length=None))

    async def replace_one(self, query: dict, document: dict, upsert: bool = False) -> None:
        for index, row in enumerate(self.documents):
            if all(row.get(key) == value for key, value in query.items()):
                self.documents[index] = dict(document)
                return
        if upsert:
            self.documents.append(dict(document))


class _InMemoryCursor:
    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows

    def limit(self, count: int):
        self.rows = self.rows[:count]
        return self

    def sort(self, key: str, direction: int = 1):
        self.rows.sort(key=lambda row: str(row.get(key) or ""), reverse=direction < 0)
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        return self.rows if length is None else self.rows[:length]


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
    ) -> None:
        self.settings = settings or get_settings()
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
