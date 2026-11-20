import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-at-least-32-bytes-long!!")
os.environ.setdefault("MASTER_KEY", "test-master-key-at-least-32-bytes-long!!")
os.environ.setdefault("APP_ENV", "test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.authentication import hash_password, set_user_finder
from app.main import create_app  # noqa: E402


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
