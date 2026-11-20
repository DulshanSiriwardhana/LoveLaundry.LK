from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import adjustments_router, bills_router, health_router, integration_router, linen_router
from .authentication.router import router as auth_router
from .core.config import get_settings
from .core.errors import install_error_handlers
from .core.metrics import record_request


@asynccontextmanager
async def lifespan(app: FastAPI):
    if get_settings().persistence == "mongo":
        from .db.migrations import run_migrations

        await run_migrations()
    yield
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
    app.include_router(health_router)
    app.include_router(bills_router)
    app.include_router(linen_router)
    app.include_router(integration_router)
    app.include_router(adjustments_router)
    app.include_router(auth_router)
    if user_lookup is not None:
        from .authentication.router import set_user_finder
        from .core.security import set_user_lookup

        set_user_lookup(user_lookup)
        set_user_finder(user_lookup)
    return app


app = create_app()
