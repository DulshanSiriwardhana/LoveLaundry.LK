"""Authoritative linen lifecycle state machine.

The production path uses one canonical stage model shared by central tracking,
both scanners, and the laundry workflow. Events never invent status strings:
they name an action, and this module resolves the resulting stage.
"""

from __future__ import annotations

REGISTERED = "registered"
ASSIGNED = "assigned_to_organization"
AVAILABLE = "available_in_inventory"
COLLECTED = "collected_for_laundry"
DISPATCHED_FROM_CLIENT = "dispatched_from_client"
RECEIVED_AT_LAUNDRY = "received_at_laundry"
SORTED = "sorted_and_classified"
WASHING = "washing_in_progress"
DRYING = "drying_in_progress"
IRONING = "ironing_and_folding"
INSPECTED = "quality_inspection"
READY = "ready_for_dispatch"
DISPATCHED_FROM_LAUNDRY = "dispatched_from_laundry"
RECEIVED_AT_CLIENT = "received_at_client"
RETURNED = "returned_to_circulation"

EXCEPTION_STAGES = {
    "missing",
    "overdue",
    "damaged",
    "rejected",
    "quarantined",
    "under_investigation",
    "retired",
    "transferred",
    "unknown",
}

STAGES = (
    REGISTERED,
    ASSIGNED,
    AVAILABLE,
    COLLECTED,
    DISPATCHED_FROM_CLIENT,
    RECEIVED_AT_LAUNDRY,
    SORTED,
    WASHING,
    DRYING,
    IRONING,
    INSPECTED,
    READY,
    DISPATCHED_FROM_LAUNDRY,
    RECEIVED_AT_CLIENT,
    RETURNED,
) + tuple(sorted(EXCEPTION_STAGES))

# Hotel/shop side actions (first four custody hands) and laundry-side actions.
ACTION_STAGE = {
    "register": REGISTERED,
    "assign": ASSIGNED,
    "make_available": AVAILABLE,
    "collect": COLLECTED,
    "dispatch_from_client": DISPATCHED_FROM_CLIENT,
    "receive_at_laundry": RECEIVED_AT_LAUNDRY,
    "sort": SORTED,
    "start_washing": WASHING,
    "start_drying": DRYING,
    "iron_fold": IRONING,
    "inspect": INSPECTED,
    "mark_ready": READY,
    "dispatch_from_laundry": DISPATCHED_FROM_LAUNDRY,
    "receive_at_client": RECEIVED_AT_CLIENT,
    "return_to_circulation": RETURNED,
    "report_missing": "missing",
    "flag_overdue": "overdue",
    "report_damaged": "damaged",
    "reject": "rejected",
    "quarantine": "quarantined",
    "investigate": "under_investigation",
    "retire": "retired",
    "transfer": "transferred",
    "mark_unknown": "unknown",
}

# Valid forward moves. Recovery scans may return an exception state to the
# last operational stage recorded in the item's history.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    REGISTERED: {ASSIGNED, AVAILABLE, "quarantined", "retired"},
    ASSIGNED: {AVAILABLE, COLLECTED, "transferred", "quarantined"},
    AVAILABLE: {COLLECTED, "transferred", "missing", "damaged", "quarantined"},
    COLLECTED: {DISPATCHED_FROM_CLIENT, AVAILABLE, "missing", "damaged"},
    DISPATCHED_FROM_CLIENT: {RECEIVED_AT_LAUNDRY, "missing", "overdue", "under_investigation"},
    RECEIVED_AT_LAUNDRY: {SORTED, "quarantined", "rejected", "damaged"},
    SORTED: {WASHING, "rejected", "damaged", "quarantined"},
    WASHING: {DRYING, "rejected", "damaged", "quarantined"},
    DRYING: {IRONING, "rejected", "damaged", "quarantined"},
    IRONING: {INSPECTED, "rejected", "damaged"},
    INSPECTED: {READY, WASHING, "rejected", "damaged"},
    READY: {DISPATCHED_FROM_LAUNDRY, "quarantined", "damaged"},
    DISPATCHED_FROM_LAUNDRY: {RECEIVED_AT_CLIENT, "missing", "overdue", "under_investigation"},
    RECEIVED_AT_CLIENT: {AVAILABLE, RETURNED, "damaged", "missing"},
    RETURNED: {AVAILABLE, COLLECTED, "transferred"},
    "missing": {AVAILABLE, "under_investigation", "retired"},
    "overdue": {AVAILABLE, "under_investigation", "missing", "retired"},
    "damaged": {"quarantined", "under_investigation", "retired"},
    "rejected": {WASHING, "quarantined", "retired"},
    "quarantined": {"under_investigation", "retired", "damaged"},
    "under_investigation": {AVAILABLE, "missing", "damaged", "retired"},
    "retired": set(),
    "transferred": {AVAILABLE, ASSIGNED},
    "unknown": {"under_investigation", AVAILABLE, "retired"},
}


def resolve_stage(action: str) -> str:
    key = str(action or "").strip().lower()
    if key not in ACTION_STAGE:
        raise ValueError(f"Unknown linen action: {action}")
    return ACTION_STAGE[key]


def can_transition(current: str, next_stage: str) -> bool:
    return next_stage in ALLOWED_TRANSITIONS.get(str(current), set())


def is_exception_stage(stage: str) -> bool:
    return str(stage) in EXCEPTION_STAGES


def is_in_progress_stage(stage: str) -> bool:
    return str(stage) in {
        COLLECTED,
        DISPATCHED_FROM_CLIENT,
        RECEIVED_AT_LAUNDRY,
        SORTED,
        WASHING,
        DRYING,
        IRONING,
        INSPECTED,
        READY,
        DISPATCHED_FROM_LAUNDRY,
    }
