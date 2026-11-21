import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-bytes-long!!")
os.environ.setdefault("MASTER_KEY", "test-master-key-at-least-32-bytes-long!!")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("AUTH_REQUIRED", "false")
os.environ.setdefault("PERSISTENCE", "memory")
os.environ.setdefault("QR_BASE_URL", "https://tags.example.test")
os.environ.setdefault("RFID_EPC_PREFIX_HEX", "3039")
os.environ.setdefault("RFID_MODE", "test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.authentication import hash_password, set_user_finder
from app.core.config import get_settings  # noqa: E402
from app.main import create_app  # noqa: E402


@pytest.fixture(autouse=True)
def reset_security_settings():
    os.environ["AUTH_REQUIRED"] = "false"
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def reset_service_singletons():
    from app.api import adjustments as adjustments_api
    from app.api import bills as bills_api
    from app.api import linen as linen_api

    bills_api._service_instance = None
    linen_api._service_instance = None
    adjustments_api._service_instance = None
    from app.runtime import reset_runtime

    reset_runtime()
    yield
    reset_runtime()


@pytest.fixture()
def app():
    return create_app()


@pytest.fixture()
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_finder():
    async def async_find(user_name: str):
        if user_name == "admin":
            return {
                "auth_id": "auth-admin",
                "user_name": "admin",
                "status": "active",
                "role_ids": ["ADMIN"],
                "permissions": ["view_bills"],
                "password_hash": hash_password("admin-pass"),
            }
        return None

    set_user_finder(async_find)
    return async_find
