def test_backend_health_contract() -> None:
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    assert client.get("/health").status_code == 200
