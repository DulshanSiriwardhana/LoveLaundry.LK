"""End-to-end coverage for the hybrid QR + UHF RFID identity extension."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.config import Settings
from app.core.principal import normalize_principal
from app.identity.models import generate_epc
from app.runtime import get_runtime


def _platform() -> dict:
    return normalize_principal(
        {
            "auth_id": "platform",
            "user_name": "platform",
            "role": "PLATFORM_ADMIN",
            "status": "active",
        }
    )


def _manager(organization_id: str) -> dict:
    return normalize_principal(
        {
            "auth_id": "manager",
            "user_name": "manager",
            "role": "MANAGER",
            "status": "active",
            "laundry_id": organization_id,
        }
    )


async def _create_item(organization_id: str, **overrides) -> dict:
    payload = {
        "organization_id": organization_id,
        "item_type": "bedsheet",
        "category": "bed",
    }
    payload.update(overrides)
    return await get_runtime().identity_service.create_item(payload, _platform())


async def _register_profile(item: dict, organization_id: str) -> dict:
    return await get_runtime().linen_service.register(
        {
            "organization_id": organization_id,
            "linen_id": item["linen_id"],
            "code": item["linen_id"],
            "category": item.get("category", ""),
            "item_type": item.get("item_type", ""),
        },
        _platform(),
    )


@pytest.mark.asyncio
async def test_qr_and_epc_resolve_to_one_item_and_tag_sheet_is_real_svg() -> None:
    runtime = get_runtime()
    item = await _create_item("hotel-a", epc=generate_epc(501, "3039"))

    by_qr = await runtime.identity_service.resolve_qr(item["qr_url"], _platform())
    by_epc = await runtime.identity_service.resolve_epc(item["epc"].lower(), _platform())

    assert by_qr["linen_id"] == item["linen_id"]
    assert by_epc["linen_id"] == item["linen_id"]
    assert set(by_qr) == {"linen_id", "item_type", "category", "status"}
    assert "organization_id" not in by_qr
    assert "epc" not in by_qr

    sheet = await runtime.identity_service.generate_tag_sheet(
        [item["linen_id"]], _platform()
    )
    assert sheet.startswith("<svg")
    assert "<path" in sheet
    assert item["linen_id"] in sheet
    assert item["epc"] in sheet


@pytest.mark.asyncio
async def test_tag_replacement_preserves_history_and_keeps_linen_id() -> None:
    runtime = get_runtime()
    item = await _create_item("hotel-a", epc=generate_epc(601, "3039"))
    old_epc = item["epc"]
    old_qr = item["qr_id"]

    result = await runtime.identity_service.replace_tag(
        item["linen_id"],
        {
            "reason": "RFID failure after physical inspection",
            "new_epc": generate_epc(602, "3039"),
            "new_tag_serial": "TAG-NEW-000002",
        },
        _platform(),
    )

    assert result["item"]["linen_id"] == item["linen_id"]
    assert result["item"]["epc"] != old_epc
    with pytest.raises(HTTPException):
        await runtime.identity_service.resolve_epc(old_epc, _platform())
    # The printed QR label can remain valid when only the RFID tag is replaced.
    assert (await runtime.identity_service.resolve_qr(old_qr, _platform()))[
        "linen_id"
    ] == item["linen_id"]

    history = await runtime.identity_service.tag_history(item["linen_id"], _platform())
    assert [row["old_epc"] for row in history["replacements"]] == [old_epc]
    assert history["replacements"][0]["new_epc"] == result["item"]["epc"]
    assert {row["action"] for row in history["assignments"]} == {
        "ASSIGNED",
        "DEACTIVATED",
    }


@pytest.mark.asyncio
async def test_wash_cycle_requires_validated_completion_and_workflow_reference() -> None:
    runtime = get_runtime()
    item = await _create_item("hotel-a", epc=generate_epc(701, "3039"))
    await _register_profile(item, "hotel-a")
    principal = _manager("hotel-a")

    for index, action in enumerate(
        (
            "assign",
            "make_available",
            "collect",
            "dispatch_from_client",
            "receive_at_laundry",
            "sort",
            "start_washing",
        )
    ):
        moved = await runtime.linen_service.record_scan(
            {
                "organization_id": "hotel-a",
                "scan_id": f"wash-prep-{index}",
                "code": item["linen_id"],
                "action": action,
            },
            principal,
        )
        assert moved["result"] == "accepted", (action, moved)

    ordinary = await runtime.scan_transactions.submit(
        {
            "method": "epc",
            "scan_id": "wash-scan-2",
            "identifier": item["epc"],
            "action": "iron_fold",
            "organization_id": "hotel-a",
        },
        principal,
    )
    # A stage alias can move the item but must not count as a wash cycle.
    assert ordinary["result"] == "invalid_transition"

    with pytest.raises(HTTPException) as missing_reference:
        await runtime.scan_transactions.submit(
            {
                "method": "qr",
                "scan_id": "wash-scan-3",
                "identifier": item["qr_id"],
                "action": "complete_washing",
                "organization_id": "hotel-a",
            },
            principal,
        )
    assert missing_reference.value.status_code == 400

    completed = await runtime.scan_transactions.submit(
        {
            "method": "rfid",
            "scan_id": "wash-scan-4",
            "identifier": item["epc"],
            "action": "complete_washing",
            "organization_id": "hotel-a",
            "workflow_reference": "load-2026-11-21-a",
        },
        principal,
    )
    assert completed["result"] == "accepted"
    assert completed["wash_count"] == 1
    profile = await runtime.linen_repository.get(item["linen_id"])
    assert profile["wash_count"] == 1
    cycles = await runtime.scanning_repository.list_wash_cycles(item["linen_id"])
    assert [cycle["wash_count"] for cycle in cycles] == [1]
    assert cycles[0]["workflow_reference"] == "load-2026-11-21-a"


@pytest.mark.asyncio
async def test_duplicate_scans_do_not_create_billing_twice() -> None:
    runtime = get_runtime()
    item = await _create_item("hotel-a", epc=generate_epc(801, "3039"))
    await _register_profile(item, "hotel-a")
    principal = _manager("hotel-a")

    payload = {
        "method": "rfid",
        "scan_id": "bill-scan-1",
        "identifier": item["epc"],
        "action": "receive_at_laundry",
        "organization_id": "hotel-a",
    }
    # Move from registered through the hotel hand-off so the billing action is valid.
    await runtime.linen_service.record_scan(
        {
            "organization_id": "hotel-a",
            "scan_id": "prep-1",
            "code": item["linen_id"],
            "action": "assign",
        },
        principal,
    )
    await runtime.linen_service.record_scan(
        {
            "organization_id": "hotel-a",
            "scan_id": "prep-2",
            "code": item["linen_id"],
            "action": "make_available",
        },
        principal,
    )
    await runtime.linen_service.record_scan(
        {
            "organization_id": "hotel-a",
            "scan_id": "prep-3",
            "code": item["linen_id"],
            "action": "collect",
        },
        principal,
    )
    await runtime.linen_service.record_scan(
        {
            "organization_id": "hotel-a",
            "scan_id": "prep-4",
            "code": item["linen_id"],
            "action": "dispatch_from_client",
        },
        principal,
    )

    first = await runtime.scan_transactions.submit(payload, principal)
    duplicate = await runtime.scan_transactions.submit(payload, principal)
    assert first["result"] == "accepted"
    assert duplicate["duplicate"] is True

    events = await runtime.billable_event_repository.list("hotel-a")
    assert [event["verification_id"] for event in events] == ["VE-bill-scan-1"]
    transactions = await runtime.billing_repository.list_all_transactions("hotel-a")
    assert [row["transaction_id"] for row in transactions] == ["VE-bill-scan-1"]


@pytest.mark.asyncio
async def test_bulk_session_filters_duplicates_unknown_and_wrong_hotel_epcs() -> None:
    runtime = get_runtime()
    first = await _create_item("hotel-a", epc=generate_epc(901, "3039"))
    second = await _create_item("hotel-a", epc=generate_epc(902, "3039"))
    foreign = await _create_item("hotel-b", epc=generate_epc(903, "3039"))
    for item in (first, second):
        await _register_profile(item, "hotel-a")

    registered = await runtime.reader_service.register(
        {
            "reader_id": "reader-a",
            "organization_id": "hotel-a",
            "name": "Dock reader",
            "adapter": "development",
            "metadata": {
                "simulated_epcs": [first["epc"], second["epc"]],
            },
        },
        _platform(),
    )
    reader = await runtime.reader_service.authenticate(
        "reader-a", registered["api_key"]
    )
    session = await runtime.scan_sessions.start(
        {
            "session_id": "session-a",
            "organization_id": "hotel-a",
            "action": "assign",
            "reader_id": "reader-a",
            "expected_linen_ids": [first["linen_id"], second["linen_id"]],
        },
        _manager("hotel-a"),
    )
    assert session["status"] == "ACTIVE"

    result = await runtime.scan_sessions.submit_reads(
        "session-a",
        [
            {"epc": first["epc"]},
            {"epc": first["epc"].lower(), "read_count": 3},
            {"epc": second["epc"]},
            {"epc": generate_epc(904, "3039")},
            {"epc": foreign["epc"]},
        ],
        {"actor_id": "reader-a"},
        reader,
    )

    assert result["unknown"] == 1
    assert result["wrong_hotel"] == 1
    assert [row["result"] for row in result["results"]] == [
        "accepted",
        "duplicate",
        "accepted",
        "unknown",
        "wrong_hotel",
    ]
    assert result["summary"]["duplicate_reads"] == 1
    assert result["summary"]["detected_items"] == 4
    assert result["summary"]["missing_items"] == 0
    assert result["summary"]["unexpected_items"] == 0

    completed = await runtime.scan_sessions.complete(
        "session-a", _manager("hotel-a")
    )
    assert completed["session"]["status"] == "COMPLETED"
    assert completed["summary"]["duplicate_reads"] == 1


@pytest.mark.asyncio
async def test_reader_credentials_are_revoked_immediately() -> None:
    runtime = get_runtime()
    registered = await runtime.reader_service.register(
        {
            "reader_id": "reader-b",
            "organization_id": "hotel-a",
            "name": "Handheld",
            "adapter": "development",
            "metadata": {"simulated_epcs": [generate_epc(951, "3039")]},
        },
        _platform(),
    )
    await runtime.reader_service.authenticate("reader-b", registered["api_key"])
    await runtime.reader_service.revoke("reader-b", _platform())

    with pytest.raises(HTTPException) as revoked:
        await runtime.reader_service.authenticate("reader-b", registered["api_key"])
    assert revoked.value.status_code == 401


@pytest.mark.asyncio
async def test_foreign_reader_cannot_submit_to_another_organization_session() -> None:
    runtime = get_runtime()
    item = await _create_item("hotel-a", epc=generate_epc(961, "3039"))
    await _register_profile(item, "hotel-a")
    registered = await runtime.reader_service.register(
        {
            "reader_id": "reader-foreign",
            "organization_id": "hotel-b",
            "name": "Foreign reader",
            "adapter": "development",
            "metadata": {"simulated_epcs": [generate_epc(962, "3039")]},
        },
        _platform(),
    )
    reader = await runtime.reader_service.authenticate(
        "reader-foreign", registered["api_key"]
    )
    await runtime.scan_sessions.start(
        {
            "session_id": "session-foreign",
            "organization_id": "hotel-a",
            "action": "assign",
            "reader_id": "reader-a",
        },
        _manager("hotel-a"),
    )

    with pytest.raises(HTTPException) as denied:
        await runtime.scan_sessions.submit_reads(
            "session-foreign", [{"epc": item["epc"]}], {"actor_id": "reader-foreign"}, reader
        )
    assert denied.value.status_code == 403


def test_tag_creation_uses_structured_id_with_configured_start_number(client) -> None:
    first = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-a",
            "item_type": "bedsheet",
            "category": "BEDSHEET",
            "owner_code": "G",
            "start_number": 41,
        },
    )
    assert first.status_code == 200
    assert first.json()["linen_id"] == "BSG-A0041YN"

    second = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-a",
            "item_type": "bedsheet",
            "category": "BEDSHEET",
            "owner_code": "G",
            "start_number": 1,
        },
    )
    assert second.status_code == 200
    assert second.json()["linen_id"] == "BSG-A0042YV"


def test_hotel_record_code_overrides_any_client_supplied_code(client) -> None:
    get_runtime().identity_repository.organizations["hotel-record"] = "G"
    created = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-record",
            "item_type": "bedsheet",
            "category": "BEDSHEET",
            "owner_code": "ZZ",
        },
    )
    assert created.status_code == 200
    assert created.json()["linen_id"] == "BSG-A0001XL"
    assert created.json()["owner_code"] == "G"


def test_public_qr_endpoint_exposes_only_safe_fields(client) -> None:
    created = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-a",
            "item_type": "bedsheet",
            "category": "bed",
        },
    )
    assert created.status_code == 200
    linen_id = created.json()["linen_id"]

    resolved = client.get(f"/i/{linen_id}")
    assert resolved.status_code == 200
    assert set(resolved.json()) == {"linen_id", "item_type", "category", "status"}

    sheet = client.get(f"/tags/{linen_id}/sheet")
    assert sheet.status_code == 200
    assert sheet.headers["content-type"].startswith("image/svg+xml")
    assert "<path" in sheet.text


def test_public_qr_rejects_legacy_and_bad_checksum_codes(client) -> None:
    for code in ("LL-7K4P92", "BSG-00001", "BSG-A0001XY"):
        response = client.get(f"/i/{code}")
        assert response.status_code == 400
        assert response.json()["detail"] == "Unsupported tag code format"

    # A caller cannot register a label with an unscannable identifier either.
    created = client.post(
        "/tags/items",
        json={
            "organization_id": "hotel-a",
            "item_type": "bedsheet",
            "category": "BEDSHEET",
            "qr_id": "LL-7K4P92",
        },
    )
    assert created.status_code == 400


def test_readers_and_dashboards_routes_are_registered(client) -> None:
    matrix = client.get("/rfid/compatibility")
    assert matrix.status_code == 200
    assert {row["adapter"] for row in matrix.json()} == {
        "chainway",
        "development",
        "generic_uhf",
        "zebra",
    }

    dashboard = client.get("/dashboards/platform")
    assert dashboard.status_code == 200
    assert "total_linen_items" in dashboard.json()


def test_production_config_rejects_simulated_rfid(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    monkeypatch.setenv("JWT_SECRET", " production-jwt-secret-at-least-32-bytes-long ")
    monkeypatch.setenv("MASTER_KEY", " production-master-key-at-least-32-bytes-long ")
    monkeypatch.setenv("QR_BASE_URL", "https://tags.example.test")
    monkeypatch.setenv("RFID_EPC_PREFIX_HEX", "3039")
    monkeypatch.setenv("RFID_MODE", "production")
    monkeypatch.setenv("RFID_ALLOW_SIMULATED_READS", "true")

    with pytest.raises(ValidationError):
        Settings()
