"""Bill-service router aggregator.

Registers the ported legacy routers in their original order. The legacy
``admin_database`` router is intentionally **not** included: the recreated
backend already exposes ``/admin/database/{status,sync-local,sync-secondary,
sync-logs}`` from :mod:`app.sync.router` (tested), and registering both would
duplicate those paths.
"""
from __future__ import annotations

from fastapi import APIRouter

from .routers.adjustments import router as adjustments_router
from .routers.bills import router as bills_router
from .routers.dashboard import router as dashboard_router
from .routers.day_close import router as day_close_router
from .routers.day_money import router as day_money_router
from .routers.deliveries import router as deliveries_router
from .routers.dispatch import router as dispatch_router
from .routers.events import router as events_router
from .routers.gatepasses import router as gatepasses_router
from .routers.linens import router as linens_router
from .routers.loyalty import router as loyalty_router
from .routers.monthly import router as monthly_router
from .routers.notifications import router as notifications_router
from .routers.operational_reports import router as operational_reports_router
from .routers.reconciliation import router as reconciliation_router
from .routers.returns import router as returns_router
from .routers.shop_bills import router as shop_bills_router

router = APIRouter(tags=["bill"])

for _r in (
    bills_router,
    gatepasses_router,
    adjustments_router,
    deliveries_router,
    events_router,
    dispatch_router,
    loyalty_router,
    dashboard_router,
    day_close_router,
    day_money_router,
    linens_router,
    monthly_router,
    returns_router,
    reconciliation_router,
    notifications_router,
    operational_reports_router,
    shop_bills_router,
):
    router.include_router(_r)
