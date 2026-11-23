from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


def test_login_response_does_not_expose_password_hash(client, user_finder) -> None:
    response = client.post(
        "/auth/login", json={"user_name": "admin", "password": "admin-pass"}
    )
    assert response.status_code == 200
    assert "password_hash" not in response.json()["user"]


def test_validation_error_does_not_reflect_input(client) -> None:
    sentinel = "not-a-period-SENSITIVE"
    response = client.get("/operations/monthly", params={"period": sentinel})
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
    assert sentinel not in response.text


def test_movement_rejects_unknown_direction(client) -> None:
    response = client.post(
        "/linen/movements",
        json={
            "movement_id": "m-1",
            "linen_id": "l-1",
            "direction": "sideways",
            "quantity": 1,
            "reason": "test",
            "period": "2026-11",
        },
    )
    assert response.status_code == 422


def test_fernet_helper_round_trip() -> None:
    from app.core.crypto import decrypt, encrypt, new_fernet

    fernet = new_fernet()
    assert decrypt(fernet, encrypt(fernet, "secret")) == "secret"


def test_business_endpoints_require_authentication(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()
    try:
        with TestClient(create_app()) as client:
            assert client.get("/operations/monthly").status_code == 401
            assert client.get("/linen/operations").status_code == 401
            assert client.get("/adjustments").status_code == 401
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
