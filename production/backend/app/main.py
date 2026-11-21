import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import (
    adjustments_router,
    bills_router,
    billing_router,
    dashboards_router,
    events_router,
    health_router,
    identity_router,
    integration_router,
    linen_lifecycle_router,
    linen_router,
    notifications_router,
    platform_router,
    rfid_router,
    scanning_router,
)
from .authentication.router import router as auth_router
from .core.config import get_settings
from .core.errors import install_error_handlers
from .core.metrics import record_request
from .runtime import get_runtime


async def _event_worker(stop: asyncio.Event) -> None:
    settings = get_settings()
    interval = settings.event_worker_interval_seconds
    while not stop.is_set():
        try:
            await get_runtime().consumer.run_once(limit=100)
        except Exception:
            # The next pass retries every unconsumed event; failures must never
            # terminate the worker or silently drop the batch.
            pass
        await asyncio.sleep(interval)


async def _reconciliation_worker(stop: asyncio.Event) -> None:
    settings = get_settings()
    interval = settings.reconciliation_interval_seconds
    while not stop.is_set():
        await asyncio.sleep(interval)
        if stop.is_set():
            break
        try:
            await get_runtime().reconciliation.run(None, {"platform_admin": True})
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.persistence == "mongo":
        from .db.migrations import run_migrations

        await run_migrations()

    stop = asyncio.Event()
    tasks: list[asyncio.Task] = []
    if settings.event_worker_enabled:
        tasks.append(asyncio.create_task(_event_worker(stop)))
        tasks.append(asyncio.create_task(_reconciliation_worker(stop)))
    try:
        yield
    finally:
        stop.set()
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        from .db import close_all

        close_all()


def create_app(user_lookup=None) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="LoveLaundry Production Backend",
        version=__version__,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def metrics_middleware(request, call_next):
        response = await call_next(request)
        record_request(request.method, response.status_code)
        return response

    install_error_handlers(app)
    for router in (
        health_router,
        auth_router,
        bills_router,
        linen_router,
        integration_router,
        adjustments_router,
        linen_lifecycle_router,
        billing_router,
        events_router,
        notifications_router,
        platform_router,
        identity_router,
        rfid_router,
        scanning_router,
        dashboards_router,
    ):
        app.include_router(router)

    if user_lookup is not None:
        from .authentication.router import set_user_finder
        from .core.security import set_user_lookup

        set_user_lookup(user_lookup)
        set_user_finder(user_lookup)
    return app


app = create_app()
