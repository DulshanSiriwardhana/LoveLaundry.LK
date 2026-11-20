def _create(client, payload: dict):
    return client.post("/adjustments", json=payload)


def _approve(client, adjustment_id: str, approver_id: str) -> object:
    return client.post(
        f"/adjustments/{adjustment_id}/approve",
        json={"auth_id": approver_id, "user_name": approver_id},
    )


def _reject(client, adjustment_id: str, actor_id: str) -> object:
    return client.post(
        f"/adjustments/{adjustment_id}/reject",
        json={"auth_id": actor_id, "user_name": actor_id},
    )


def test_create_adjustment_requires_reason(client) -> None:
    response = _create(
        client,
        {
            "adjustment_id": "adj-1",
            "gate_pass_id": "gp-1",
            "item_name": "Shirt",
            "original_qty": 10,
            "corrected_qty": 8,
            "reason": "   ",
            "actor_id": "u1",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A reason is required to request an adjustment"


def test_adjustment_lifecycle(client) -> None:
    created = _create(
        client,
        {
            "adjustment_id": "adj-1",
            "gate_pass_id": "gp-1",
            "item_name": "Shirt",
            "original_qty": 10,
            "corrected_qty": 8,
            "reason": "Damaged during wash",
            "actor_id": "requester-1",
        },
    )
    assert created.status_code == 200
    assert created.json()["status"] == "REQUESTED"

    listed = client.get("/adjustments", params={"status": "REQUESTED"}).json()
    assert len(listed) == 1
    assert listed[0]["item_name"] == "Shirt"

    approved = _approve(client, "adj-1", "approver-1")
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"

    conflict = _approve(client, "adj-1", "approver-2")
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Adjustment is already APPROVED."


def test_adjustment_reject_flow(client) -> None:
    created = _create(
        client,
        {
            "adjustment_id": "adj-2",
            "gate_pass_id": "gp-2",
            "item_name": "Bed sheet",
            "original_qty": 5,
            "corrected_qty": 4,
            "reason": "Wrong size sent",
            "actor_id": "requester-2",
        },
    )
    assert created.status_code == 200

    rejected = _reject(client, "adj-2", "approver-2")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"

    conflict = _reject(client, "adj-2", "approver-2")
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Adjustment is already REJECTED."


def test_adjustment_cannot_approve_own_request(client) -> None:
    _create(
        client,
        {
            "adjustment_id": "adj-3",
            "gate_pass_id": "gp-3",
            "item_name": "Pillow",
            "original_qty": 3,
            "corrected_qty": 2,
            "reason": "Lost",
            "actor_id": "same-user",
        },
    )
    denied = _approve(client, "adj-3", "same-user")
    assert denied.status_code == 400
    assert denied.json()["detail"] == "Adjustments must be approved by a different user than the requester."


def test_approve_updates_bills_and_monthly_operations_together(client) -> None:
    import asyncio

    from app.api.bills import _service as bills_service_factory

    bills_service = bills_service_factory()

    async def seed_bill() -> None:
        await bills_service.bill_repository.save(
            {
                "bill_id": "bill-9",
                "gate_pass_id": "gp-9",
                "status": "outstanding",
                "amount": 100.0,
                "period": "2026-12",
            }
        )

    asyncio.run(seed_bill())

    created = _create(
        client,
        {
            "adjustment_id": "adj-9",
            "gate_pass_id": "gp-9",
            "item_name": "Shirt",
            "original_qty": 10,
            "corrected_qty": 7,
            "reason": "Damaged during wash",
            "actor_id": "requester-9",
        },
    )
    assert created.status_code == 200

    approved = _approve(client, "adj-9", "approver-9")
    assert approved.status_code == 200
    body = approved.json()
    assert body["status"] == "APPROVED"
    assert body["monthly_operations"] is not None
    assert body["monthly_operations"]["period"] == "2026-12"

    operations = client.get("/operations/monthly", params={"period": "2026-12"}).json()
    assert operations["outstanding"] == 7.0
