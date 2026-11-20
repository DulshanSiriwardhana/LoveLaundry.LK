def test_operations_snapshot_joins_financial_and_linen(client) -> None:
    response = client.get("/operations/snapshot", params={"period": "2026-11"})
    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "2026-11"
    assert "financial" in body
    assert "linen" in body
    assert set(body["financial"].keys()) >= {"delivered", "outstanding", "billable", "received"}
    assert set(body["linen"].keys()) >= {"received", "delivered", "net"}
