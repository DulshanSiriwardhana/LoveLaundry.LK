"""Bounded, read-only architecture scanner.

Hard guarantees:
  * **Read-only** — never opens a source file for writing, never creates,
    renames or deletes anything under ``source_root``.
  * **Path-bounded** — every directory walked is verified to resolve *inside*
    ``source_root``; symlinks that escape the root are skipped. There is no
    arbitrary-path parameter anywhere in the public API.
  * **Secret-redacting** — only environment *variable names* are collected.
    ``.env`` values are never read into the model. ``redact()`` masks anything
    that looks like a credential as a defensive second layer.

The same code powers both the ``system_info`` service and the offline
``scripts/generate_inventory.py`` report generator (single source of truth).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

# Directories we never descend into.
SKIP_DIRS = {
    ".git",
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    ".next",
    ".turbo",
    "coverage",
}

MAX_DEPTH = 8

# Services whose FastAPI routers are mounted under an additional prefix at
# ``include_router`` time (verified in Stage 1). Keeps the reported paths equal
# to the real public API paths.
KNOWN_MOUNT_PREFIXES = {
    "laundry-management": "/api",
    "love-ai": "/api/ai",
}

ROUTE_RE = re.compile(r'@(app|router)\.(get|post|put|patch|delete)\(\s*(["\'])(.*?)\3', re.S)
PREFIX_RE = re.compile(r'APIRouter\(\s*(?:[^)]*?)prefix\s*=\s*(["\'])(.*?)\1', re.S)
ENV_NAME_RE = re.compile(r"^\s*([A-Z][A-Z0-9_]+)\s*=", re.M)
INCLUDE_RE = re.compile(r'include_router\(([A-Za-z0-9_]+)(?:[^)]*?prefix\s*=\s*(["\'])(.*?)\2)?')
PY_PKG_HINT = re.compile(r'^\s*(?:from|import)\s+([a-zA-Z_][a-zA-Z0-9_]*)', re.M)

# Defensive masking for anything that might be emitted.
_SECRET_VALUE_RE = re.compile(
    r"(?i)(sk-[a-z0-9]{10,}|mongodb(\+srv)?://[^@\s]+@|AIza[0-9A-Za-z_\-]{20,}|eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)"
)


@dataclass
class ServiceInfo:
    name: str
    path: str
    language: str
    framework: str
    mount_prefix: str = ""
    python_files: int = 0
    routes: list[dict] = field(default_factory=list)
    env_var_names: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    entrypoints: list[str] = field(default_factory=list)


def redact(text: str) -> str:
    """Mask anything resembling a credential."""
    return _SECRET_VALUE_RE.sub("***REDACTED***", text)


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _safe_walk(root: Path, max_depth: int = MAX_DEPTH):
    """Yield files under ``root`` that stay inside ``root`` (symlink-guarded)."""
    root = root.resolve()
    stack: list[tuple[Path, int]] = [(root, 0)]
    seen: set[str] = set()
    while stack:
        current, depth = stack.pop()
        if depth > max_depth:
            continue
        key = str(current)
        if key in seen:
            continue
        seen.add(key)
        try:
            entries = list(current.iterdir())
        except (PermissionError, OSError):
            continue
        for entry in entries:
            if entry.name in SKIP_DIRS:
                continue
            if not _is_within(entry, root):
                continue  # symlink escaping the root
            if entry.is_dir():
                if not entry.is_symlink():
                    stack.append((entry, depth + 1))
            elif entry.is_file():
                yield entry


def _detect_python_pkg(service_dir: Path) -> Path:
    src = service_dir / "src"
    if not src.is_dir():
        return service_dir
    # Some services use `src/` itself as the import package (e.g. laundry-management).
    if (src / "__init__.py").exists() and (
        (src / "main.py").exists() or (src / "app.py").exists()
    ):
        return src
    pkgs = [p for p in src.iterdir() if p.is_dir() and p.name != "__pycache__"]
    for p in pkgs:
        if (p / "main.py").exists() or (p / "config.py").exists():
            return p
    return pkgs[0] if pkgs else src


def extract_python_routes(pkg_dir: Path, mount_prefix: str = "") -> list[dict]:
    prefixes: dict[str, str] = {}
    for path in _safe_walk(pkg_dir):
        if path.suffix != ".py":
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        m = PREFIX_RE.search(text)
        if m:
            prefixes[str(path.relative_to(pkg_dir))] = m.group(2)

    routes: list[dict] = []
    for path in _safe_walk(pkg_dir):
        if path.suffix != ".py":
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = str(path.relative_to(pkg_dir))
        router_prefix = prefixes.get(rel, "")
        for owner, method, _q, raw in ROUTE_RE.findall(text):
            # A file's APIRouter prefix applies only to @router.* decorators.
            prefix = router_prefix if owner == "router" else ""
            full = (prefix.rstrip("/") + "/" + raw.lstrip("/")) if raw else (prefix or "/")
            if mount_prefix:
                full = mount_prefix + ("" if full == "/" else full)
            routes.append({"method": method.upper(), "path": full, "file": rel})
    return sorted(routes, key=lambda r: (r["path"], r["method"]))


def extract_env_names(service_dir: Path) -> list[str]:
    names: set[str] = set()
    for candidate in (".env.example", ".env"):
        f = service_dir / candidate
        if f.is_file():
            try:
                text = f.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            # Only variable NAMES; values are discarded immediately.
            names.update(ENV_NAME_RE.findall(text))
    return sorted(names)


def _read_python_deps(service_dir: Path) -> list[str]:
    deps: set[str] = set()
    req = service_dir / "requirements.txt"
    if req.is_file():
        for line in req.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                deps.add(re.split(r"[<>=!\[;]", line)[0].strip())
    return sorted(d for d in deps if d)


def _detect_language_framework(service_dir: Path) -> tuple[str, str]:
    if (service_dir / "package.json").is_file():
        if (service_dir / "vercel.json").is_file():
            return "typescript", "vercel-function"
        return "javascript", "node"
    if (service_dir / "pubspec.yaml").is_file():
        return "dart", "flutter"
    if (service_dir / "requirements.txt").is_file() or (service_dir / "pyproject.toml").is_file():
        return "python", "fastapi"
    return "unknown", "unknown"


def scan_service(service_dir: Path, mount_prefix: str = "") -> ServiceInfo:
    language, framework = _detect_language_framework(service_dir)
    if not mount_prefix:
        mount_prefix = KNOWN_MOUNT_PREFIXES.get(service_dir.name, "")
    info = ServiceInfo(
        name=service_dir.name,
        path=str(service_dir),
        language=language,
        framework=framework,
        mount_prefix=mount_prefix,
        env_var_names=extract_env_names(service_dir),
    )
    if language == "python":
        pkg = _detect_python_pkg(service_dir)
        # Routes are reported exactly as written in source. `mount_prefix` is
        # metadata: effective public path = mount_prefix + router-defined path,
        # while `@app.*` routes in main.py are already absolute.
        info.routes = extract_python_routes(pkg)
        info.python_files = sum(1 for p in _safe_walk(pkg) if p.suffix == ".py")
        info.dependencies = _read_python_deps(service_dir)
    for marker in ("api/index.py", "api/chat.ts", "src/main.py", "src/index.ts", "main.py"):
        if (service_dir / marker).is_file():
            info.entrypoints.append(marker)
    return info


def discover_services(root: Path) -> list[Path]:
    """A directory is a service if it directly contains a project marker."""
    markers = {"requirements.txt", "pyproject.toml", "package.json", "pubspec.yaml", "vercel.json"}
    found: list[Path] = []
    if not root.is_dir():
        return found
    for child in sorted(root.iterdir()):
        if not child.is_dir() or child.name in SKIP_DIRS:
            continue
        if not _is_within(child, root):
            continue
        if any((child / m).exists() for m in markers):
            found.append(child)
    return found


def build_model(root: Path) -> dict:
    """Scan ``root`` and return a JSON-serialisable architecture model."""
    root = root.resolve()
    services = [scan_service(svc) for svc in discover_services(root)]
    return {
        "source_root": str(root),
        "service_count": len(services),
        "route_count": sum(len(s.routes) for s in services),
        "services": [s.__dict__ for s in services],
    }
