"""Worker domain logic.

Kept free of FastAPI/DB so it is unit-testable. The router owns HTTP concerns
and the repository owns persistence; everything conditional (group-work
normalisation, quick-count syncing, summaries) lives here.
"""
from __future__ import annotations

from typing import Any, Optional

from .schemas import ATTENDANCE_STATUSES, SHIFTS, TASK_TYPES, TASK_UNITS


class ValidationError(ValueError):
    """Raised for 422-class problems; message is the ``detail``."""


# ─── Validation ───────────────────────────────────────────────────────────────
def validate_shift(shift: str) -> str:
    if shift.upper() not in SHIFTS:
        raise ValidationError(f"Shift must be one of {SHIFTS}")
    return shift.upper()


def validate_attendance(status: str) -> str:
    if status.upper() not in ATTENDANCE_STATUSES:
        raise ValidationError(f"Attendance status must be one of {ATTENDANCE_STATUSES}")
    return status.upper()


def validate_tasks(tasks: list) -> None:
    for t in tasks:
        ttype = t.get("task_type") if isinstance(t, dict) else getattr(t, "task_type", None)
        tunit = t.get("unit") if isinstance(t, dict) else getattr(t, "unit", None)
        if ttype is None or str(ttype).upper() not in TASK_TYPES:
            raise ValidationError(
                f"Task type '{ttype}' must be one of {TASK_TYPES}"
            )
        if tunit is None or str(tunit).upper() not in TASK_UNITS:
            raise ValidationError(f"Task unit '{tunit}' must be one of {TASK_UNITS}")


def task_dicts(tasks: list) -> list[dict]:
    return [t.model_dump() if hasattr(t, "model_dump") else dict(t) for t in tasks]


# ─── Task-count synchronisation ───────────────────────────────────────────────
def sync_task_counts(log_data: dict) -> None:
    """Populate quick counts from detailed task entries when not set manually."""
    counts = {"WASHING": 0, "PRESSING": 0, "FOLDING": 0, "PACKING": 0, "OTHER": 0}
    for t in log_data.get("tasks", []):
        t_type = str(t.get("task_type", "")).upper()
        qty = float(t.get("quantity") or 0)
        if t_type in ("DRY_CLEANING", "STAIN_TREATMENT"):
            counts["WASHING"] += qty
        elif t_type == "SORTING_TAGGING":
            counts["OTHER"] += qty
        elif t_type in counts:
            counts[t_type] += qty
        else:
            counts["OTHER"] += qty

    field_by_type = {
        "WASHING": "washed_count",
        "PRESSING": "pressed_count",
        "FOLDING": "folded_count",
        "PACKING": "packed_count",
        "OTHER": "other_count",
    }
    for ttype, field in field_by_type.items():
        if not log_data.get(field):
            log_data[field] = int(counts[ttype])


# ─── Group work normalisation ─────────────────────────────────────────────────
def normalize_create(log_data: dict) -> dict:
    if log_data.get("is_group_work"):
        team = [m for m in (log_data.get("team_members") or []) if m]
        if len(team) < 2:
            raise ValidationError("Group work requires at least 2 team members")
        log_data["is_group_work"] = True
        log_data["team_members"] = team
        log_data["worker_name"] = " + ".join(team)
    else:
        log_data["is_group_work"] = False
        log_data["team_members"] = []
    return log_data


def normalize_update(update_data: dict, current: dict) -> dict:
    """Recompute the worker_name label whenever the group definition is touched.

    Handles flipping ``is_group_work`` and editing ``team_members`` independently
    so a team edit alone never leaves a stale label.
    """
    if "is_group_work" not in update_data and "team_members" not in update_data:
        return update_data

    effective_group = (
        update_data["is_group_work"]
        if "is_group_work" in update_data
        else bool(current.get("is_group_work"))
    )
    if "team_members" in update_data:
        team = [m for m in (update_data["team_members"] or []) if m]
    else:
        team = [m for m in (current.get("team_members") or []) if m]

    if effective_group:
        if "team_members" in update_data and len(team) < 2:
            raise ValidationError("Group work requires at least 2 team members")
        if not team:
            raise ValidationError("Group work requires at least 2 team members")
        update_data["worker_name"] = " + ".join(team)
    else:
        if not update_data.get("worker_name"):
            update_data.pop("worker_name", None)
        update_data["team_members"] = []
    return update_data


# ─── Summaries (pure) ─────────────────────────────────────────────────────────
def empty_summary(date_value: str) -> dict:
    return {
        "date": date_value,
        "workers_logged": 0,
        "present": 0,
        "absent": 0,
        "on_leave": 0,
        "half_day": 0,
        "total_washed": 0,
        "total_pressed": 0,
        "total_folded": 0,
        "total_packed": 0,
        "total_other": 0,
        "total_weight_kg": 0.0,
        "total_overtime_hours": 0.0,
        "total_rewash": 0,
        "total_damaged": 0,
        "total_complaints": 0,
    }


def daily_summary(logs: list[dict], date_value: str) -> dict:
    s = empty_summary(date_value)
    for log in logs:
        if log.get("is_group_work"):
            s["workers_logged"] += max(1, len(log.get("team_members") or []))
        else:
            s["workers_logged"] += 1
        attendance = str(log.get("attendance_status", "")).upper()
        if attendance == "PRESENT":
            s["present"] += 1
        elif attendance == "ABSENT":
            s["absent"] += 1
        elif attendance == "ON_LEAVE":
            s["on_leave"] += 1
        elif attendance == "HALF_DAY":
            s["half_day"] += 1
            s["present"] += 1
        s["total_washed"] += int(log.get("washed_count") or 0)
        s["total_pressed"] += int(log.get("pressed_count") or 0)
        s["total_folded"] += int(log.get("folded_count") or 0)
        s["total_packed"] += int(log.get("packed_count") or 0)
        s["total_other"] += int(log.get("other_count") or 0)
        s["total_weight_kg"] += float(log.get("total_weight_kg") or 0)
        s["total_overtime_hours"] += float(log.get("overtime_hours") or 0)
        s["total_rewash"] += int(log.get("rewash_count") or 0)
        s["total_damaged"] += int(log.get("damaged_items") or 0)
        s["total_complaints"] += int(log.get("complaints") or 0)
    s["total_weight_kg"] = round(s["total_weight_kg"], 2)
    s["total_overtime_hours"] = round(s["total_overtime_hours"], 2)
    return s


def range_summary(
    logs: list[dict], date_from: str, date_to: str, generated_at: str
) -> dict:
    per_worker: dict[str, dict] = {}
    for log in logs:
        if log.get("is_group_work"):
            credited = [m for m in (log.get("team_members") or []) if m]
        else:
            credited = [log.get("worker_name")]
        for name in credited:
            if not name:
                continue
            entry = per_worker.setdefault(
                name,
                {
                    "worker_name": name,
                    "days_logged": 0,
                    "present_days": 0,
                    "total_washed": 0,
                    "total_pressed": 0,
                    "total_folded": 0,
                    "total_packed": 0,
                    "total_other": 0,
                    "total_pieces": 0,
                    "total_weight_kg": 0.0,
                    "total_overtime_hours": 0.0,
                    "total_rewash": 0,
                    "total_damaged": 0,
                    "_ratings": [],
                },
            )
            entry["days_logged"] += 1
            if str(log.get("attendance_status", "")).upper() in ("PRESENT", "HALF_DAY"):
                entry["present_days"] += 1
            washed = int(log.get("washed_count") or 0)
            pressed = int(log.get("pressed_count") or 0)
            folded = int(log.get("folded_count") or 0)
            packed = int(log.get("packed_count") or 0)
            other = int(log.get("other_count") or 0)
            entry["total_washed"] += washed
            entry["total_pressed"] += pressed
            entry["total_folded"] += folded
            entry["total_packed"] += packed
            entry["total_other"] += other
            entry["total_pieces"] += washed + pressed + folded + packed + other
            entry["total_weight_kg"] += float(log.get("total_weight_kg") or 0)
            entry["total_overtime_hours"] += float(log.get("overtime_hours") or 0)
            entry["total_rewash"] += int(log.get("rewash_count") or 0)
            entry["total_damaged"] += int(log.get("damaged_items") or 0)
            rating = log.get("performance_rating")
            if rating:
                entry["_ratings"].append(float(rating))

    results = []
    for entry in per_worker.values():
        ratings = entry.pop("_ratings")
        entry["total_weight_kg"] = round(entry["total_weight_kg"], 2)
        entry["total_overtime_hours"] = round(entry["total_overtime_hours"], 2)
        entry["avg_performance_rating"] = (
            round(sum(ratings) / len(ratings), 2) if ratings else None
        )
        results.append(entry)

    results.sort(key=lambda e: e["total_pieces"], reverse=True)
    return {
        "date_from": date_from,
        "date_to": date_to,
        "generated_at": generated_at,
        "workers": results,
    }
