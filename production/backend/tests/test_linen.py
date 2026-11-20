def test_linen_operations_requires_reason_for_movement(client) -> None:
    response = client.post(
        "/linen/movements",
        json={
            "movement_id": "mov-1",
            "linen_id": "lin-1",
            "direction": "in",
            "quantity": 5,
            "from_org": "laundry",
            "to_org": "hotel",
            "reason": "   ",
            "period": "2026-11",
            "actor_id": "u1",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A reason is required to record a movement"


def test_linen_operations_compute_totals(client) -> None:
    response = client.get("/linen/operations", params={"period": "2026-11"})
    assert response.status_code == 200
    body = response.json()
    assert body["period"] == "2026-11"
    assert body["received"] == 0
    assert body["delivered"] == 0
    assert body["net"] == 0


def test_linen_operations_compute_after_movement(client) -> None:
    client.post(
        "/linen/movements",
        json={
            "movement_id": "mov-1",
            "linen_id": "lin-1",
            "direction": "in",
            "quantity": 5,
            "from_org": "laundry",
            "to_org": "hotel",
            "reason": "Hotel intake",
            "period": "2026-11",
            "actor_id": "u1",
        },
    )
    client.post(
        "/linen/movements",
        json={
            "movement_id": "mov-2",
            "linen_id": "lin-1",
            "direction": "out",
            "quantity": 2,
            "from_org": "hotel",
            "to_org": "laundry",
            "reason": "Hotel return",
            "period": "2026-11",
            "actor_id": "u1",
        },
    )

    response = client.get("/linen/operations", params={"period": "2026-11"})
    assert response.status_code == 200
    body = response.json()
    assert body["received"] == 5
    assert body["delivered"] == 2
    assert body["net"] == 3
