from app.authentication import hash_password
from app.main import create_app


def test_health(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login_rejects_unknown_user(client, user_finder) -> None:
    response = client.post("/auth/login", json={"user_name": "ghost", "password": "x"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_issues_token_for_known_user(client, user_finder) -> None:
    response = client.post("/auth/login", json={"user_name": "admin", "password": "admin-pass"})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["user_name"] == "admin"
