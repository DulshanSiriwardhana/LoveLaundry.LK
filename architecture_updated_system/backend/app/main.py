"""Application factory for the recreated LoveLaundry backend.

Assembles the health + auth modules into one FastAPI app and wires the auth
repository + the security user-lookup. Production selects the Mongo adapter;
``APP_ENV=test`` (or an explicit override) selects the in-memory adapter.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .core.config import get_settings
from .core.errors import install_error_handlers
from .core.security import set_user_lookup
from .modules.auth.repository import InMemoryUserRepository
from .modules.auth.router import router as auth_router
from .modules.bill.router import router as bill_router
from .modules.health.router import router as health_router
from .modules.insights.repository import InMemoryInsightsRepository
from .modules.insights.router import router as insights_router
from .modules.laundry.repository import InMemoryLaundryRepository
from .modules.laundry.router import router as laundry_router
from .modules.quotation.chat import router as chat_router
from .modules.quotation.chat_repository import InMemoryChatRepository
from .modules.quotation.repository import InMemoryQuotationRepository
from .modules.quotation.router import router as quotation_router
from .modules.worker.repository import InMemoryWorkerRepository
from .modules.worker.router import router as worker_router
from .sync.router import router as admin_database_router


def _is_test(settings) -> bool:
    return settings.app_env == "test"


def _build_user_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryUserRepository()
    # Production: use the MAIN role database.
    from .db import ROLE_MAIN, get_database
    from .modules.auth.repository import MongoUserRepository

    return MongoUserRepository(get_database(ROLE_MAIN))


def _build_worker_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryWorkerRepository()
    from .db import ROLE_MAIN, get_database
    from .modules.worker.repository import MongoWorkerRepository

    return MongoWorkerRepository(get_database(ROLE_MAIN))


def _build_quotation_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryQuotationRepository()
    from .db import ROLE_MAIN, get_database
    from .modules.quotation.repository import MongoQuotationRepository

    return MongoQuotationRepository(get_database(ROLE_MAIN))


def _build_chat_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryChatRepository()
    from .db import ROLE_MAIN, get_database
    from .modules.quotation.chat_repository import MongoChatRepository

    return MongoChatRepository(get_database(ROLE_MAIN))


def _build_insights_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryInsightsRepository()
    from .db import ROLE_MAIN, get_database
    from .modules.insights.repository import MongoInsightsRepository

    return MongoInsightsRepository(get_database(ROLE_MAIN))


def _build_laundry_repo(app: FastAPI):
    settings = get_settings()
    if _is_test(settings):
        return InMemoryLaundryRepository()
    from .db import ROLE_MAIN, get_database
    from .modules.laundry.repository import MongoLaundryRepository

    return MongoLaundryRepository(get_database(ROLE_MAIN))


def _init_bill_db(app: FastAPI):
    """In test mode, bind the bill module's collection proxies to an in-process
    mongomock database so no network/Mongo is required. Production leaves them
    unbound, so every proxy lazily resolves its real MAIN/SECONDARY/LOCAL role."""
    settings = get_settings()
    if not _is_test(settings):
        return
    from mongomock_motor import AsyncMongoMockClient

    from .modules.bill import database as bill_db

    mock = AsyncMongoMockClient()
    bill_db.bind_role(bill_db.ROLE_MAIN, mock["bill_main"])
    bill_db.bind_role(bill_db.ROLE_SECONDARY, mock["bill_main_secondary"])
    bill_db.bind_role(bill_db.ROLE_LOCAL, mock["bill_main_local"])
    app.state.bill_mock_client = mock


def _build_sync_service(app: FastAPI):
    from .db import ROLE_LOCAL, ROLE_MAIN, ROLE_SECONDARY, get_database
    from .sync.service import MongoSyncService

    return MongoSyncService(
        get_database(ROLE_MAIN),
        get_database(ROLE_SECONDARY),
        get_database(ROLE_LOCAL),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    from .db import close_all

    close_all()


def create_app(user_repo=None) -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="LoveLaundry Backend (recreated)",
        version=__version__,
        description="Isolated recreation of the LoveLaundry.LK backend.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_error_handlers(app)

    _init_bill_db(app)

    repo = user_repo or _build_user_repo(app)
    app.state.user_repo = repo
    set_user_lookup(repo.get_by_auth_id)

    app.state.worker_repo = _build_worker_repo(app)
    app.state.quotation_repo = _build_quotation_repo(app)
    app.state.chat_repo = _build_chat_repo(app)
    app.state.insights_repo = _build_insights_repo(app)
    app.state.laundry_repo = _build_laundry_repo(app)
    app.state.sync_service = _build_sync_service(app)

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(worker_router)
    app.include_router(quotation_router)
    app.include_router(chat_router)
    app.include_router(insights_router)
    app.include_router(laundry_router)
    app.include_router(bill_router)
    app.include_router(admin_database_router)

    return app


app = create_app()
