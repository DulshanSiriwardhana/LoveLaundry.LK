"""Worker module tests — mirror the legacy worker-service behaviour, especially
the group-work label handling and the task-count synchronisation.
"""
from __future__ import annotations


def test_meta_lists_enums(client, staff_headers):
    resp = client.get("/meta", headers=staff_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "WASHING" in body["task_types"]
    assert "PIECES" in body["task_units"]
    assert "GENERAL" in body["departments"]


def test_worker_crud(client, manager_headers):
    payload = {"worker_name": "Nimal", "department": "washing", "phone": "077"}
    created = client.post("/workers", json=payload, headers=manager_headers)
    assert created.status_code == 201, created.text
    worker = created.json()
    assert worker["department"] == "WASHING"
    wid = worker["id"]

    listing = client.get("/workers", headers=manager_headers)
    assert listing.status_code == 200
    assert any(w["id"] == wid for w in listing.json())

    got = client.get(f"/workers/{wid}", headers=manager_headers)
    assert got.status_code == 200
    assert got.json()["worker_name"] == "Nimal"

    updated = client.put(
        f"/workers/{wid}", json={"department": "packing"}, headers=manager_headers
    )
    assert updated.status_code == 200
    assert updated.json()["department"] == "PACKING"

    deleted = client.delete(f"/workers/{wid}", headers=manager_headers)
    assert deleted.status_code == 200
    assert client.get(f"/workers/{wid}", headers=manager_headers).status_code == 404


def test_worker_invalid_department(client, manager_headers):
    resp = client.post(
        "/workers",
        json={"worker_name": "X", "department": "NOPE"},
        headers=manager_headers,
    )
    assert resp.status_code == 422


def test_worker_requires_write_role(client, staff_headers):
    resp = client.post(
        "/workers", json={"worker_name": "X"}, headers=staff_headers
    )
    assert resp.status_code == 403


def test_create_log_syncs_counts_from_tasks(client, staff_headers):
    payload = {
        "work_date": "2026-10-12",
        "worker_name": "Nimal",
        "tasks": [
            {"task_type": "WASHING", "quantity": 10},
            {"task_type": "PRESSING", "quantity": 4},
            {"task_type": "STAIN_TREATMENT", "quantity": 2},
        ],
    }
    resp = client.post("/daily-logs", json=payload, headers=staff_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["washed_count"] == 12
    assert body["pressed_count"] == 4
    assert body["work_date"] == "2026-10-12"


def test_create_log_rejects_bad_shift(client, staff_headers):
    resp = client.post(
        "/daily-logs",
        json={"work_date": "2026-10-12", "worker_name": "A", "shift": "DAWN"},
        headers=staff_headers,
    )
    assert resp.status_code == 422


def test_group_work_requires_two_members(client, staff_headers):
    resp = client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-12",
            "worker_name": "ignored",
            "is_group_work": True,
            "team_members": ["A"],
        },
        headers=staff_headers,
    )
    assert resp.status_code == 422


def test_group_work_builds_label(client, staff_headers):
    resp = client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-12",
            "worker_name": "ignored",
            "is_group_work": True,
            "team_members": ["Asha", "Bala"],
            "washed_count": 5,
        },
        headers=staff_headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["worker_name"] == "Asha + Bala"
    assert body["is_group_work"] is True


def test_update_group_label_recomputed_on_team_edit(client, staff_headers):
    created = client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-12",
            "worker_name": "A",
            "is_group_work": True,
            "team_members": ["A", "B"],
        },
        headers=staff_headers,
    ).json()
    log_id = created["id"]

    updated = client.put(
        f"/daily-logs/{log_id}",
        json={"team_members": ["A", "B", "C"]},
        headers=staff_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["worker_name"] == "A + B + C"


def test_toggle_off_group_clears_team(client, staff_headers):
    created = client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-12",
            "worker_name": "A",
            "is_group_work": True,
            "team_members": ["A", "B"],
        },
        headers=staff_headers,
    ).json()
    updated = client.put(
        f"/daily-logs/{created['id']}",
        json={"is_group_work": False, "worker_name": "Asha"},
        headers=staff_headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["is_group_work"] is False
    assert body["team_members"] == []
    assert body["worker_name"] == "Asha"


def test_daily_and_range_summary(client, staff_headers):
    client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-11",
            "worker_name": "Asha",
            "attendance_status": "PRESENT",
            "washed_count": 10,
            "pressed_count": 2,
            "performance_rating": 4,
        },
        headers=staff_headers,
    )
    client.post(
        "/daily-logs",
        json={
            "work_date": "2026-10-11",
            "worker_name": "ignored",
            "is_group_work": True,
            "team_members": ["Asha", "Bala"],
            "attendance_status": "HALF_DAY",
            "washed_count": 6,
            "performance_rating": 5,
        },
        headers=staff_headers,
    )

    daily = client.get("/summary/daily?date=2026-10-11", headers=staff_headers)
    assert daily.status_code == 200
    d = daily.json()
    assert d["total_washed"] == 16
    assert d["half_day"] == 1
    assert d["workers_logged"] == 3

    rng = client.get(
        "/summary/range?date_from=2026-10-01&date_to=2026-10-31", headers=staff_headers
    )
    assert rng.status_code == 200
    workers = {w["worker_name"]: w for w in rng.json()["workers"]}
    assert workers["Asha"]["total_washed"] == 16
    assert workers["Bala"]["total_washed"] == 6
    assert workers["Asha"]["avg_performance_rating"] == 4.5


def test_worker_requires_auth(client):
    assert client.get("/workers").status_code in (401, 403)
