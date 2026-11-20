import importlib.util
import os
from pathlib import Path


def _default_root() -> Path:
    return Path(__file__).resolve().parents[3] / "databases"


def _load_runner(path: Path):
    spec = importlib.util.spec_from_file_location("ll_database_migrations", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def run_migrations() -> None:
    root = Path(os.getenv("DATABASE_MIGRATIONS_DIR", str(_default_root())))
    runner_path = root / "run_migrations.py"
    if not runner_path.exists():
        return
    runner = _load_runner(runner_path)
    await runner.run_all()
