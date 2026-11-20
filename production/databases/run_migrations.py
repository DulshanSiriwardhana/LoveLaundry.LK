import asyncio
import importlib.util
from pathlib import Path

_ROOT = Path(__file__).resolve().parent

_MIGRATIONS = (
    "central-system/migrations/0001_initial.py",
    "laundry-internal/migrations/0001_initial.py",
    "linen-tracking/migrations/0001_initial.py",
)


def _load(path: Path):
    name = f"ll_migration_{path.parent.parent.name}"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def run_all() -> None:
    for relative in _MIGRATIONS:
        module = _load(_ROOT / relative)
        await module.apply()


def main() -> None:
    asyncio.run(run_all())


if __name__ == "__main__":
    main()
