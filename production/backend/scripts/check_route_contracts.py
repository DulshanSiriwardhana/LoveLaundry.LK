#!/usr/bin/env python3
"""Static frontend→backend route contract inventory (stdlib only).

FastAPI/pytest are not required: this script parses route decorators with ``ast``
and reads the frontend call sites with a small regex. It fails when a URL the
shipped clients use is absent from the backend's effective route table,
including the ``/api`` reverse-proxy strip and the ``/bills`` namespace aliases.

Run from ``production/backend``:
    python3 scripts/check_route_contracts.py
"""

from __future__ import annotations

import argparse
import ast
import re
import sys
from pathlib import Path

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
API_ROOTS = {
    "auth",
    "billing",
    "bill",
    "bills",
    "client",
    "client-portal",
    "dashboards",
    "day-close",
    "events",
    "health",
    "i",
    "integration",
    "linen",
    "linens",
    "metrics",
    "notifications",
    "operations",
    "platform",
    "ready",
    "rfid",
    "scan",
    "shop-bills",
    "tags",
    "user",
    "ws",
}


def normalize_path(value: str) -> str:
    value = str(value or "").strip()
    value = value.split("?", 1)[0].split("#", 1)[0]
    value = re.sub(r"\$\{[^}]*\}", "{}", value)
    value = re.sub(r"\{[^{}]+\}", "{}", value)
    # A template such as `/dashboards/hotel${query}` appends a query string,
    # not a path parameter: do not turn it into a trailing `{}` segment.
    value = re.sub(r"(?<=[^/])\{\}$", "", value)
    value = re.sub(r"/{2,}", "/", value)
    if not value.startswith("/"):
        value = "/" + value
    return value.rstrip("/") or "/"


def join_path(*parts: str) -> str:
    cleaned = [str(part or "").strip("/") for part in parts if str(part or "").strip("/")]
    return "/" + "/".join(cleaned) if cleaned else "/"


def _constant_string(node) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _router_prefix(tree: ast.Module) -> str:
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        if not any(isinstance(target, ast.Name) and target.id == "router" for target in node.targets):
            continue
        value = node.value
        if not isinstance(value, ast.Call):
            continue
        func = value.func
        is_router = (isinstance(func, ast.Name) and func.id == "APIRouter") or (
            isinstance(func, ast.Attribute) and func.attr == "APIRouter"
        )
        if not is_router:
            continue
        for keyword in value.keywords:
            if keyword.arg == "prefix":
                return _constant_string(keyword.value) or ""
    return ""


def _routes_in_module(path: Path) -> list[tuple[str, set[str]]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    prefix = _router_prefix(tree)
    routes: list[tuple[str, set[str]]] = []
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call) or not decorator.args:
                continue
            func = decorator.func
            if not isinstance(func, ast.Attribute) or func.attr not in HTTP_METHODS | {"websocket"}:
                continue
            if not isinstance(func.value, ast.Name) or func.value.id != "router":
                continue
            route = _constant_string(decorator.args[0])
            if route is None:
                continue
            routes.append((normalize_path(join_path(prefix, route)), {func.attr}))
    return routes


def _module_for_alias(alias: str, backend: Path) -> Path | None:
    if alias == "auth_router":
        return backend / "app" / "authentication" / "router.py"
    if not alias.endswith("_router"):
        return None
    stem = alias[: -len("_router")]
    candidates = [backend / "app" / "api" / f"{stem}.py"]
    for path in candidates:
        if path.exists():
            return path
    return None


def backend_inventory(backend: Path) -> dict[str, set[str]]:
    main_tree = ast.parse(
        (backend / "app" / "main.py").read_text(encoding="utf-8"), filename="main.py"
    )
    loop_routers: dict[str, list[str]] = {}
    for node in ast.walk(main_tree):
        if not isinstance(node, ast.For) or not isinstance(node.target, ast.Name):
            continue
        if node.target.id != "router":
            continue
        loop_routers[node.target.id] = [
            item.id for item in node.iter.elts if isinstance(item, ast.Name)
        ] if isinstance(node.iter, (ast.Tuple, ast.List)) else []

    includes: list[tuple[str, str]] = []
    for node in ast.walk(main_tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        if node.func.attr != "include_router" or not node.args:
            continue
        target = node.args[0]
        if not isinstance(target, ast.Name):
            continue
        mount = ""
        for keyword in node.keywords:
            if keyword.arg == "prefix":
                mount = _constant_string(keyword.value) or ""
        aliases = loop_routers.get(target.id, [target.id])
        includes.extend((alias, mount) for alias in aliases)

    inventory: dict[str, set[str]] = {}
    for alias, mount in includes:
        module = _module_for_alias(alias, backend)
        if module is None:
            continue
        for route, methods in _routes_in_module(module):
            full = normalize_path(join_path(mount, route))
            inventory.setdefault(full, set()).update(methods)
    return inventory


def _quoted_paths(text: str) -> list[str]:
    paths: list[str] = []
    for pattern in (
        r"`([^`]*)`",
        r'"([^"\\]*(?:\\.[^"\\]*)*)"',
        r"'([^'\\]*(?:\\.[^'\\]*)*)'",
    ):
        for match in re.finditer(pattern, text):
            value = match.group(1).strip()
            if not value.startswith("/"):
                continue
            candidate = normalize_path(value)
            if candidate.split("/")[1] in API_ROOTS:
                paths.append(candidate)
    return paths


def frontend_expectations(root: Path) -> dict[str, set[str]]:
    apps = root / "production" / "apps"
    expected: dict[str, set[str]] = {}

    for app, auth_prefix, data_prefix in (
        ("hotel-app", "/user", "/bills"),
        ("shop-app", "/user", "/bills"),
        ("linen-room-app", "/user", "/bills"),
    ):
        config = apps / app / "src" / "config" / "app.ts"
        text = config.read_text(encoding="utf-8") if config.exists() else ""
        paths: set[str] = set()
        for key in ("loginPath", "statusPath"):
            match = re.search(rf"{key}:\s*['\"]([^'\"]+)['\"]", text)
            if match:
                paths.add(normalize_path(join_path(auth_prefix, match.group(1))))
        for match in re.finditer(
            r"endpoint:\s*['\"](?:GET|POST|PUT|PATCH|DELETE)?\s*(/[^'\"]+)['\"]",
            text,
            re.IGNORECASE,
        ):
            paths.add(normalize_path(join_path(data_prefix, match.group(1))))
        expected[app] = paths

    scanner = apps / "hotel-scanner" / "src"
    scanner_paths: set[str] = set()
    for path in sorted(scanner.glob("*.ts*")):
        scanner_paths.update(_quoted_paths(path.read_text(encoding="utf-8")))
    expected["hotel-scanner"] = scanner_paths

    platform = apps / "platform-admin" / "src" / "api.ts"
    platform_paths: set[str] = set()
    if platform.exists():
        text = platform.read_text(encoding="utf-8")
        for path in _quoted_paths(text):
            platform_paths.add(path)
            if path.startswith("/hotels"):
                platform_paths.add(normalize_path(join_path("/user", path)))
    expected["platform-admin"] = platform_paths

    # Explicit critical contracts: even if a frontend refactor stops embedding a
    # literal for one of these, the backend must keep the published surface.
    expected["hotel-app"].update(
        {
            "/user/client/auth/login",
            "/user/client/auth/status",
            "/bills/client-portal/summary",
            "/bills/client-portal/gate-passes",
            "/bills/client-portal/deliveries",
            "/bills/client-portal/bills",
            "/bills/client-portal/bills/{}",
        }
    )
    expected["shop-app"].update(
        {
            "/user/auth/login",
            "/user/auth/status",
            "/bills/shop-bills/stats/overview",
            "/bills/shop-bills",
            "/bills/shop-bills/quick-bill",
            "/bills/day-close",
        }
    )
    expected["linen-room-app"].update(
        {
            "/user/auth/login",
            "/user/auth/status",
            "/bills/linens/{}/scan",
            "/bills/linens",
            "/bills/linens/stats/summary",
            "/bills/linens/generate-tags",
            "/bills/linens/transitions",
        }
    )
    expected["hotel-scanner"].update(
        {
            "/linen/operations",
            "/linen/movements",
            "/linen/items/{}",
            "/linens/transitions",
            "/scan/transactions",
            "/dashboards/hotel",
            "/linen/alerts",
            "/linen/alerts/{}/resolve",
            "/linen/items",
            "/scan/sessions",
            "/scan/sessions/{}",
            "/scan/sessions/{}/reconcile",
            "/scan/sessions/{}/reads",
            "/scan/sessions/{}/capture",
            "/ws/linen",
        }
    )
    expected["platform-admin"].update(
        {
            "/user/hotels",
            "/platform/summary",
            "/platform/organizations",
            "/platform/announcements",
            "/platform/themes",
            "/platform/audit",
            "/dashboards/platform",
            "/dashboards/hotel",
            "/dashboards/laundry",
            "/tags/items",
            "/tags/health/alerts",
            "/rfid/readers",
            "/rfid/readers/{}",
            "/rfid/compatibility",
            "/scan/sessions",
            "/scan/sessions/{}/reconcile",
        }
    )
    return {name: set(paths) for name, paths in expected.items()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
        help="Repository root (defaults to the parent of production/backend)",
    )
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    backend = args.root / "production" / "backend"
    inventory = backend_inventory(backend)
    expectations = frontend_expectations(args.root)

    missing: list[str] = []
    for app, paths in expectations.items():
        for path in sorted(paths):
            if path not in inventory:
                missing.append(f"{app}: {path}")
            elif args.verbose:
                print(f"OK   {app:16} {path} -> {','.join(sorted(inventory[path]))}")

    print(
        f"Route inventory: {len(inventory)} backend routes; "
        f"{sum(len(paths) for paths in expectations.values())} frontend contracts checked"
    )
    if missing:
        print("MISSING frontend contracts:", file=sys.stderr)
        for item in missing:
            print(f"  - {item}", file=sys.stderr)
        return 1
    print("All frontend route contracts are present in the backend.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
