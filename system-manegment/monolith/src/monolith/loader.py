"""Read-only vendor loader.

Imports each microservice's FastAPI app WITHOUT modifying the original
services. Originals live in ../<service>/src and are only ever read.

Collision problem: laundry-management/src and love-ai/src are both top-level
``src`` packages (``src.main``, ``src.config`` ...). Adding both to sys.path
would collide. Solution: register each service dir as a DISTINCT top-level
package name (mono_bill, mono_mgmt, ...) via ModuleType.__path__. Relative
imports (``from .config import ...``) then resolve to distinct modules
(``mono_bill.config`` vs ``mono_mgmt.config``) with zero filesystem changes.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

HERE = Path(__file__).resolve()
# .../system-manegment/monolith/src/monolith/loader.py -> system-manegment/
ROOT = HERE.parents[3]

SERVICE_DIRS: dict[str, Path] = {
    # distinct package name -> source directory (read-only)
    "mono_bill": ROOT / "bill-service" / "src" / "bill_service",
    "mono_users": ROOT / "user-service" / "src" / "user_service",
    "mono_quotations": ROOT / "quotation-service" / "src" / "quotation_service",
    "mono_workers": ROOT / "worker-service" / "src" / "worker_service",
    "mono_mgmt": ROOT / "laundry-management" / "src",
    "mono_ai": ROOT / "love-ai" / "src",
}

_loaded: dict[str, types.ModuleType] = {}


def register_vendor_packages() -> dict[str, Path]:
    """Register vendor packages in sys.modules. Idempotent. Read-only."""
    for pkg_name, src_dir in SERVICE_DIRS.items():
        if pkg_name in sys.modules:
            continue
        if not src_dir.is_dir():
            raise RuntimeError(f"vendor source missing (read-only): {src_dir}")
        pkg = types.ModuleType(pkg_name)
        # Mark as package so `import mono_bill.main` searches src_dir/
        pkg.__path__ = [str(src_dir)]  # type: ignore[attr-defined]
        sys.modules[pkg_name] = pkg
        _loaded[pkg_name] = pkg
    return SERVICE_DIRS


def load_apps():
    """Import and return each microservice's FastAPI app (read-only import)."""
    register_vendor_packages()
    from mono_bill.main import app as bill_app
    from mono_users.main import app as users_app
    from mono_quotations.main import app as quotations_app
    from mono_workers.main import app as workers_app
    from mono_mgmt.main import app as mgmt_app
    from mono_ai.main import app as ai_app

    return {
        "bill": bill_app,
        "users": users_app,
        "quotations": quotations_app,
        "workers": workers_app,
        "mgmt": mgmt_app,
        "ai": ai_app,
    }
