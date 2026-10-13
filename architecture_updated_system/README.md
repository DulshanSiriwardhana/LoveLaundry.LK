# LoveLaundry.LK — Recreated System

> Complete, **isolated** recreation of the LoveLaundry.LK platform plus a live
> architecture-intelligence dashboard. **Nothing outside this directory is
> modified.** See `docs/initial_system_audit.md` for the read-only analysis of the
> original system.

## Layout

```
architecture_updated_system/
├── backend/            Recreated backend (FastAPI modular monolith) + tests
├── frontend/           Recreated operational UI (Vite + React + TS foundation)
├── system_info/
│   ├── backend/        Bounded, read-only architecture scanner API + tests
│   └── frontend/       Architecture-intelligence dashboard (Vite + React + TS)
├── deployment/         Docker Compose, Dockerfiles, load-test scaffolding
├── scripts/            Offline inventory / parity-matrix generator
└── docs/               Audit, decisions, parity matrix, checkpoint, more
```

## Quick start (local, no Docker)

```bash
# 1. Python env + install both backends
python3 -m venv .venv
.venv/bin/pip install -e "./backend[dev]" -e "./system_info/backend[dev]"

# 2. Run the recreated backend
APP_ENV=test .venv/bin/python -m uvicorn app.main:app --app-dir backend --port 8100

# 3. Run the architecture scanner (points at the legacy tree)
SCAN_SOURCE_ROOT=../system-manegment \
  .venv/bin/python -m uvicorn app.main:app --app-dir system_info/backend --port 8810
```

Frontends:

```bash
(cd frontend && npm install && npm run dev)          # http://127.0.0.1:8101
(cd system_info/frontend && npm install && npm run dev)  # http://127.0.0.1:8820
```

Docker Compose: see `deployment/README.md`.

## Tests

```bash
(cd backend && ../.venv/bin/python -m pytest)
(cd system_info/backend && ../../.venv/bin/python -m pytest)
```

Current status: **32 passing** (18 backend + 14 system_info). See
`docs/current_checkpoint.md`.

## Status

This is a staged recreation. The shared platform, auth/users slice, the full
architecture scanner, both frontends' builds, and deployment scaffolding are done.
Remaining domain module parity is tracked in `docs/functional_parity_matrix.md`
and `docs/current_checkpoint.md`. **No performance claims are made** — the load
test has not been executed.
