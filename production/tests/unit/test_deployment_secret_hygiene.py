"""Regression tests: deployment/migration scripts must not embed credentials."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SKIP_PARTS = {
    "node_modules",
    ".git",
    ".venv",
    "dist",
    "build",
    "__pycache__",
    "node-compile-cache",
}
# Matches a credential-bearing Atlas URI, as opposed to documentation
# placeholders such as mongodb+srv://USER:PASSWORD@CLUSTER...
ATLAS_CREDENTIAL = re.compile(r"mongodb\+srv://[A-Za-z0-9._%+-]+:[^@\s<>]+@")


def _deployment_python_files() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*.py")
        if not SKIP_PARTS.intersection(path.parts)
        and ("deploy" in path.parts or "migration" in path.parts)
    ]


def test_no_hardcoded_atlas_credentials_in_deployment_scripts() -> None:
    offenders: list[str] = []
    for path in _deployment_python_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        if ATLAS_CREDENTIAL.search(text):
            offenders.append(str(path.relative_to(ROOT)))
    assert not offenders, "hardcoded Atlas credentials in: " + ", ".join(offenders)


def test_multi_tenant_migration_reads_connection_from_environment() -> None:
    migration = (
        ROOT
        / "system-manegment/release/deploy/migrations/001_multi_tenant_backfill.py"
    ).read_text(encoding="utf-8")
    assert 'os.getenv("MONGODB_MAIN_URI")' in migration
    assert 'os.getenv("DATABASE_URL")' in migration
    assert not ATLAS_CREDENTIAL.search(migration)
