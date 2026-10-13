"""Shared fixtures: a small synthetic service tree, fully isolated from the
real legacy repository."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def fake_tree(tmp_path: Path) -> Path:
    root = tmp_path / "legacy"

    # Python FastAPI service
    svc = root / "svc-a"
    (svc / "src" / "svc_a").mkdir(parents=True)
    (svc / "requirements.txt").write_text("fastapi>=0.110\nuvicorn==0.29.0\n# comment\n")
    (svc / ".env.example").write_text("JWT_SECRET=example\nMASTER_KEY=example\nTZ=Asia/Colombo\n")
    (svc / ".env").write_text("JWT_SECRET=REAL_SECRET_VALUE_DO_NOT_LEAK\n")
    (svc / "src" / "svc_a" / "main.py").write_text(
        'from fastapi import APIRouter, FastAPI\n'
        'app = FastAPI()\n'
        'router = APIRouter(prefix="/widgets")\n'
        '@app.get("/")\n'
        'async def root():\n    return {}\n'
        '@router.get("/{widget_id}")\n'
        'async def get_widget(widget_id: str):\n    return {}\n'
        '@router.post("")\n'
        'async def make_widget():\n    return {}\n'
        'app.include_router(router)\n'
    )

    # JS frontend service
    web = root / "web-app"
    web.mkdir()
    (web / "package.json").write_text('{"name":"web-app"}\n')
    (web / "vercel.json").write_text("{}\n")
    (web / "src").mkdir()
    (web / "src" / "index.ts").write_text("export const x = 1;\n")

    # Symlink escaping the root must be ignored.
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "leak.py").write_text("@app.get('/leak')\n")
    try:
        (svc / "escape").symlink_to(outside, target_is_directory=True)
    except OSError:
        pass  # symlinks may be unavailable on some filesystems

    return root


@pytest.fixture()
def scan_env(monkeypatch, fake_tree):
    monkeypatch.setenv("SCAN_SOURCE_ROOT", str(fake_tree))
    monkeypatch.setenv("SCAN_BIND_HOST", "127.0.0.1")
    monkeypatch.setenv("SCAN_API_KEY", "")
    from app.config import get_scan_settings
    import app.main as main

    get_scan_settings.cache_clear()
    main._cache = None
    yield fake_tree
    get_scan_settings.cache_clear()
    main._cache = None
