#!/usr/bin/env python3
"""Cross-service tenancy contract smoke test.

Every resource service ships its own copy of ``tenancy.py`` (they cannot share
a package), so the isolation contract can silently drift. This script loads
each copy by file path and asserts they behave identically for two tenants —
including the transitional rule that pre-tenancy documents without
``laundry_id`` read as ``lovelaundry``.

It also mints two HS256 session JWTs (one per tenant) with the platform secret
and feeds the decoded claims through every service's ``resolve_laundry_id``,
proving each service resolves the same tenant from the same token.

Usage (from the monorepo)::

    python system-manegment/scripts/tenant_contract_smoke.py
    JWT_SECRET=... python system-manegment/scripts/tenant_contract_smoke.py

Exit code is 0 when every service agrees, 1 otherwise.
"""
from __future__ import annotations

import importlib.util
import inspect
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Tuple

BASE = Path(__file__).resolve().parents[1]
TENANTS = {"acme": "acme-laundry-co", "other": "other-laundry-co"}
LEGACY = "lovelaundry"

SERVICES: Dict[str, Path] = {
    "bill-service": BASE / "bill-service/src/bill_service/tenancy.py",
    "quotation-service": BASE / "quotation-service/src/quotation_service/tenancy.py",
    "worker-service": BASE / "worker-service/src/worker_service/tenancy.py",
    "laundry-management": BASE / "laundry-management/src/tenancy.py",
    "love-ai": BASE / "love-ai/src/tenancy.py",
}

EXPORTED = (
    "LOVE_LAUNDRY_ID",
    "resolve_laundry_id",
    "laundry_match",
    "scoped_query",
    "assert_same_laundry",
    "owned_filter",
    "match_stage",
    "stamp_missing_laundry_ids",
)

_failures: List[str] = []


def _load(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(f"_contract_{name.replace('-', '_')}", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _check(label: str, condition: bool, detail: str = "") -> None:
    if not condition:
        _failures.append(f"{label}: {detail}" if detail else label)
        print(f"  FAIL {label}{(' — ' + detail) if detail else ''}")


def _http_status(fn, *args) -> Tuple[bool, Any]:
    try:
        return True, fn(*args)
    except Exception as exc:  # HTTPException carries .status_code
        return False, getattr(exc, "status_code", repr(exc))


def _session(laundry_id: str, *, status: str = "ACTIVE", with_membership: bool = True) -> dict:
    claims = {"auth_id": "u1", "user_id": "u1", "role": "ADMIN", "laundry_id": laundry_id}
    if with_membership:
        claims["laundries"] = [{"id": laundry_id, "role": "ADMIN", "status": status}]
    return claims


def _fake_collection() -> Any:
    class _Result:
        modified_count = 7

        def __await__(self):
            if False:
                yield
            return self

    class _Collection:
        def __init__(self) -> None:
            self.calls = []

        def update_many(self, filt, update):
            self.calls.append((filt, update))
            return _Result()

    return _Collection()


def _run_stamp(module: Any, collection: Any, laundry_id: str):
    coro = module.stamp_missing_laundry_ids({"c": collection}, laundry_id)
    if inspect.isawaitable(coro):
        import asyncio

        return asyncio.run(coro)
    return coro


def _check_service(name: str, module: Any) -> Dict[str, Any]:
    """Return a dict of behaviour fingerprints used to compare services."""
    print(f"\n== {name} ==")
    fp: Dict[str, Any] = {}

    for attr in EXPORTED:
        _check(f"{name}.{attr} present", hasattr(module, attr))

    _check(f"{name}.LOVE_LAUNDRY_ID", getattr(module, "LOVE_LAUNDRY_ID", None) == LEGACY)

    # resolve_laundry_id across the two tenants + fail-closed cases.
    ok, val = _http_status(module.resolve_laundry_id, None)
    _check(f"{name}.resolve(None) -> 401", (not ok) and val == 401, f"got {val}")
    ok, val = _http_status(module.resolve_laundry_id, {})
    _check(f"{name}.resolve(no laundry) -> 400", (not ok) and val == 400, f"got {val}")
    fp["resolve_acme"] = module.resolve_laundry_id(_session(TENANTS["acme"]))
    fp["resolve_other"] = module.resolve_laundry_id(_session(TENANTS["other"]))
    _check(f"{name}.resolve(acme) == acme", fp["resolve_acme"] == TENANTS["acme"])
    _check(f"{name}.resolve(other) == other", fp["resolve_other"] == TENANTS["other"])
    ok, val = _http_status(
        module.resolve_laundry_id, _session(TENANTS["acme"], with_membership=False)
    )
    _check(f"{name}.resolve(non-member) -> 403", (not ok) and val == 403, f"got {val}")
    ok, val = _http_status(
        module.resolve_laundry_id, _session(TENANTS["acme"], status="SUSPENDED")
    )
    _check(f"{name}.resolve(suspended) -> 403", (not ok) and val == 403, f"got {val}")
    platform = {"role": "PLATFORM_ADMIN", "platform_admin": True, "laundry_id": TENANTS["acme"]}
    fp["resolve_platform"] = module.resolve_laundry_id(platform)
    _check(f"{name}.resolve(platform) == acme", fp["resolve_platform"] == TENANTS["acme"])

    # laundry_match: strict for named tenants, legacy-aware for lovelaundry.
    fp["match_acme"] = module.laundry_match(TENANTS["acme"])
    fp["match_other"] = module.laundry_match(TENANTS["other"])
    _check(f"{name}.match(acme) strict", fp["match_acme"] == {"laundry_id": TENANTS["acme"]})
    _check(f"{name}.match(other) strict", fp["match_other"] == {"laundry_id": TENANTS["other"]})
    legacy = module.laundry_match(LEGACY)
    _check(f"{name}.match(legacy) is $or", isinstance(legacy, dict) and "$or" in legacy)
    if isinstance(legacy, dict) and "$or" in legacy:
        clauses = legacy["$or"]
        _check(f"{name}.match(legacy) has 3 clauses", len(clauses) == 3, f"got {len(clauses)}")
        _check(
            f"{name}.match(legacy) covers missing/null",
            {"laundry_id": {"$exists": False}} in clauses and {"laundry_id": None} in clauses,
        )
    fp["match_legacy"] = legacy

    # scoped_query: merge for strict tenants, $and for legacy, identity for None.
    fp["scoped_acme"] = module.scoped_query({"x": 1}, TENANTS["acme"])
    _check(
        f"{name}.scoped({{x:1}}, acme)",
        fp["scoped_acme"] == {"x": 1, "laundry_id": TENANTS["acme"]},
        f"got {fp['scoped_acme']}",
    )
    fp["scoped_empty_acme"] = module.scoped_query(None, TENANTS["acme"])
    _check(
        f"{name}.scoped(None, acme)",
        fp["scoped_empty_acme"] == {"laundry_id": TENANTS["acme"]},
        f"got {fp['scoped_empty_acme']}",
    )
    fp["scoped_legacy"] = module.scoped_query({"x": 1}, LEGACY)
    _check(
        f"{name}.scoped({{x:1}}, legacy) is $and",
        isinstance(fp["scoped_legacy"], dict) and "$and" in fp["scoped_legacy"],
    )

    # assert_same_laundry: legacy doc readable by legacy, foreign/missing -> 404.
    ok, _ = _http_status(module.assert_same_laundry, {"laundry_id": TENANTS["acme"]}, TENANTS["acme"])
    _check(f"{name}.assert(own) ok", ok)
    ok, val = _http_status(
        module.assert_same_laundry, {"laundry_id": TENANTS["acme"]}, TENANTS["other"]
    )
    _check(f"{name}.assert(foreign) -> 404", (not ok) and val == 404, f"got {val}")
    ok, val = _http_status(module.assert_same_laundry, None, TENANTS["acme"])
    _check(f"{name}.assert(missing) -> 404", (not ok) and val == 404, f"got {val}")
    ok, _ = _http_status(module.assert_same_laundry, {"n": 1}, LEGACY)
    _check(f"{name}.assert(unstamped) ok for legacy", ok)

    # owned_filter binds _id to the tenant.
    oid = "64b000000000000000000000"
    fp["owned_acme"] = module.owned_filter(oid, TENANTS["acme"])
    _check(
        f"{name}.owned(acme)",
        fp["owned_acme"] == {"_id": oid, "laundry_id": TENANTS["acme"]},
        f"got {fp['owned_acme']}",
    )

    # match_stage.
    _check(
        f"{name}.match_stage(acme)",
        module.match_stage(TENANTS["acme"]) == {"$match": {"laundry_id": TENANTS["acme"]}},
    )

    # stamp: only missing/null, always writes the target tenant.
    collection = _fake_collection()
    try:
        result = _run_stamp(module, collection, LEGACY)
        _check(f"{name}.stamp returns counts", result == {"c": 7}, f"got {result}")
        _check(f"{name}.stamp touched 1 collection", len(collection.calls) == 1)
        if collection.calls:
            filt, update = collection.calls[0]
            _check(
                f"{name}.stamp filter targets missing",
                {"$or": [{"laundry_id": {"$exists": False}}, {"laundry_id": None}]} == filt,
                f"got {filt}",
            )
            _check(
                f"{name}.stamp sets tenant",
                update == {"$set": {"laundry_id": LEGACY}},
                f"got {update}",
            )
    except Exception:
        _check(f"{name}.stamp runs", False, traceback.format_exc(limit=1).strip())

    return fp


def _jwt_claims() -> Dict[str, dict]:
    """Mint two HS256 session JWTs and return their decoded payloads."""
    import jwt  # PyJWT, already a platform dependency

    secret = os.environ.get("JWT_SECRET") or "test-only-contract-secret-0123456789abcdef"
    payloads: Dict[str, dict] = {}
    for tenant, laundry_id in TENANTS.items():
        token = jwt.encode(
            {
                "auth_id": f"{tenant}-user",
                "user_id": f"{tenant}-user",
                "role": "ADMIN",
                "laundry_id": laundry_id,
                "laundries": [{"id": laundry_id, "role": "ADMIN", "status": "ACTIVE"}],
            },
            secret,
            algorithm="HS256",
        )
        payloads[tenant] = jwt.decode(token, secret, algorithms=["HS256"])
    return payloads


def main() -> int:
    missing = [name for name, path in SERVICES.items() if not path.exists()]
    if missing:
        print(f"missing tenancy modules: {', '.join(missing)}", file=sys.stderr)
        return 1

    modules = {name: _load(name, path) for name, path in SERVICES.items()}
    fingerprints = {name: _check_service(name, mod) for name, mod in modules.items()}

    # Cross-service agreement: every service must produce the same fingerprint.
    print("\n== cross-service agreement ==")
    reference_name, reference = next(iter(fingerprints.items()))
    for key in sorted(reference):
        for name, fp in fingerprints.items():
            _check(f"{name} agrees on {key}", fp.get(key) == reference.get(key))

    # Two-tenant JWT smoke.
    print("\n== two-tenant JWT smoke ==")
    try:
        claims = _jwt_claims()
    except Exception as exc:
        print(f"  SKIP JWT smoke (PyJWT unavailable: {exc})")
    else:
        for tenant, laundry_id in TENANTS.items():
            for name, module in modules.items():
                resolved = module.resolve_laundry_id(claims[tenant])
                _check(
                    f"{name}.resolve(JWT {tenant}) == {laundry_id}",
                    resolved == laundry_id,
                    f"got {resolved}",
                )

    print("\n" + "=" * 52)
    if _failures:
        print(f"CONTRACT FAILURES ({len(_failures)}):")
        for failure in _failures:
            print(f"  - {failure}")
        return 1
    print("All five services honour the same tenancy contract.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
