from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import bills_router, health_router, linen_router
from .authentication.router import router as auth_router
from .core.config import get_settings
from .core.errors import install_error_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    install_error_handlers(app)
    app.include_router(health_router)
    app.include_router(bills_router)
    app.include_router(linen_router)
    app.include_router(auth_router)
    if user_lookup is not None:
        from .core.security import set_user_lookup

        set_user_lookup(user_lookup)
    return app


app = create_app()
