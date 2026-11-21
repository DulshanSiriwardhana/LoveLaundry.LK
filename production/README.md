# LoveLaundry Edition v2 — Production System

This folder contains the **productionized LoveLaundry system** imported from
`LoveLaundry.LK/production`. It is a self-contained, single-stack edition that
sits alongside the legacy multi-service `edition-v1/` tree in this release
repository. Nothing in `edition-v1/`, the submodule pointers, `deploy/`, or
`docs/` was modified.

## What changed vs. Edition v1

| | Edition v1 | Edition v2 (this folder) |
|---|---|---|
| Architecture | ~10 independently deployed services | One FastAPI backend + 6 web apps |
| Backend | Separate `bill-service`, `user-service`, `laundry-management`, … | `backend/app` with feature modules |
| Identity | Service-local auth/tenancy helpers | Centralised principals, capabilities, RBAC |
| Reliability | Per-service storage | Event outbox + consumer, reconciliation, audit |
| Data | Service databases | Three versioned databases with migration runner |
| Admin UI | `quotations-ui` overlay | Dedicated `platform-admin` app |

## Included features

- **RBAC & platform administration** — `backend/app/core/principal.py`,
  `backend/app/core/capabilities.py`, `backend/app/permissions/`,
  `backend/app/platform/`, and `apps/platform-admin/`.
- **Event-driven reliability** — transactional outbox/consumer
  (`backend/app/events/`) plus reconciliation (`backend/app/reconciliation/`)
  and audit logging (`backend/app/audit/`).
- **Billing** — repositories, services, verification and payment APIs
  (`backend/app/billing/`, `backend/app/api/billing.py`,
  `backend/app/api/bills.py`).
- **Linen lifecycle** — tracking, missing-item handling and lifecycle APIs
  (`backend/app/linen/`, `backend/app/api/linen*.py`).
- **Scanners & RFID** — `backend/app/scanning/`, `backend/app/rfid/`, and the
  `hotel-scanner`, `laundry-scanner`, `laundry-internal`, `linen-tracking` apps.
- **Notifications & analytics** — `backend/app/notifications/`,
  `backend/app/analytics/`, and the corresponding API routers.
- **Databases** — schema + idempotent migrations for `central_system`,
  `laundry_internal`, `linen_tracking` (`databases/`).
- **Public website** — customer-facing marketing site with hotel linen, public
  drop-off and partner-collection information, one responsive navbar, a
  no-API-key embedded map (Google/OpenStreetMap) and lightweight scroll reveals
  (`apps/public-site/`).
- **Deployment** — Docker Compose, reverse-proxy config, monitoring, and
  Vercel serverless handlers (`infrastructure/`, `backend/api/index.py`,
  per-app `vercel.json`).

## Layout

```
edition-v2/
├── apps/                  # hotel-scanner, laundry-internal, laundry-scanner,
│                          # linen-tracking, platform-admin, public-site
│                          # (Vite + React)
├── backend/               # FastAPI application, API routers, tests
├── databases/             # schemas, versioned migrations, migration runner
├── infrastructure/        # deployment, monitoring, reverse proxy
├── shared/                # frontend-components, types, utilities
├── tests/                 # cross-cutting unit/integration/e2e tests
├── pytest.ini
└── .gitignore
```

Node modules, build output (`dist/`, `build/`), Python caches and `.env` files
were intentionally **not** copied — install dependencies locally before
building or running the apps.

## Quick start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env          # then fill in real values
uvicorn app.main:app --reload
```

### Databases

```bash
# set MONGODB_CENTRAL_URI / MONGODB_CENTRAL_DB, MONGODB_LAUNDRY_*, MONGODB_LINEN_*
python databases/run_migrations.py
```

### Web apps

```bash
cd apps/<app-name>
npm install
cp .env.example .env.local    # then fill in real values
npm run dev
```

`apps/public-site` is a standalone Vite app and does not require the backend or
environment variables to build.

### Tests

```bash
pytest                        # from the edition-v2 root (see pytest.ini)
```

### Docker Compose

```bash
cd infrastructure/deployment
cp .env.example .env          # and deploy.env.example -> deploy.env
docker compose up --build
```

## Relationship to the rest of this repository

- `edition-v1/` — the original, still-current service-based release. Kept intact.
- `edition-v2/` — this productionized monolithic stack.
- `deploy/`, `docs/`, submodules — unchanged by this import.

Only pick **one** architecture for a given set of databases; running edition-v1
services and edition-v2 against the same data can cause schema conflicts.
