# Current Checkpoint

> Living status document. Updated at each stage. A stage is "done" only when its
> artefacts exist **and** its tests pass. Nothing here is aspirational.

Date of last update: 2026-10-12.

## Test totals (actually executed)

| Suite | Command | Result |
| --- | --- | --- |
| Backend | `cd backend && ../.venv/bin/python -m pytest` | **143 passed** |
| system_info backend | `cd system_info/backend && ../../.venv/bin/python -m pytest` | **14 passed** |
| Frontend build (app) | `cd frontend && npm run build` | ✅ built |
| Frontend build (system_info) | `cd system_info/frontend && npm run build` | ✅ built |

**Total automated tests: 157 passing.**

## What is complete

### Stage 1 — Discovery ✅
- `docs/initial_system_audit.md` (verified vs inferred marked throughout).
- `docs/service_inventory.json` — 9 services, **420 routes**, env var names (no values).
- `docs/dependency_graph.json`.
- `docs/functional_parity_matrix.md` (regenerable).
- Offline generator: `scripts/generate_inventory.py` (read-only).

### Stage 2 — Decisions ✅
- `docs/architecture_decisions.md` (ADR-000..012, incl. ADR-010 legacy error
  shape, ADR-011 modular monolith / domain modules, ADR-012 transport-agnostic
  database synchronization).

### Stage 3 — Foundation ✅
- Isolated tree with `backend/`, `frontend/`, `system_info/`, `deployment/`, `docs/`, `scripts/`.
- `.gitignore`, `.env.example`s, READMEs.

### Stage 4 — Backend (partial, in progress)
Done:
- Shared core: `config` (env-anchored to `backend/.env`), `crypto`
  (legacy-compatible envelope/HMAC/canonical JSON), `security` (HS256 + live
  revocation + roles), `clock` (Sri-Lankan business time), `errors` (legacy
  `{"detail": ...}` shape, ADR-010), `capabilities` (fine-grained capability auth).
- DB role model `MAIN/SECONDARY/LOCAL` + memory adapter.
- **auth/users module** (login, status, users CRUD, password/profile/status),
  repository (memory + Mongo).
- **worker module** (collections `workers`/`daily_task_logs`; `/meta`, `/workers`,
  `/daily-logs`, `/summary/daily`, `/summary/range`; group-work label recompute,
  task-count sync) — 12 tests.
- **quotation module** (lifecycle transitions, tags, public guest/tracking/tag
  endpoints; collections `quotations`/`garment_tags`) — 12 tests.
- **insights (love-ai) module** (prefix `/api/ai`; signed-request auth + data_hash;
  dashboard/revenue/expenses/salary/payroll-risk + `POST /insights/query`) — 9 tests.
- **laundry-management module** — generic encrypted CRUD engine over 18 resources
  (`customers`, `items`, `item_categories`, `expenses`/`expense_categories`/
  `expense_templates`, `employees`, `transactions`, `payments`, `advances`/
  `salary_advances`, `holidays`, `attendance`, `extra_work_*`, `salary_packages`/
  `salary_slips`, `saved_reports`, `customer_rates`) plus custom endpoints
  (`/dashboard`, `/customers/summary`, `/expenses/summary`, `/holidays/check/{date}`,
  employee derived lists + `/activate`, `/company-settings`, `/attendance/bulk`,
  customer rates) and derived/report/bulk/import endpoints (`/employees/{id}/advances/
  summary`, `/employees/{id}/salaries` GET+POST+PUT, `/employees/{id}/attendance`,
  salary-slip `/finalize|cancel|pay`, `/transactions/bulk`, `/attendance/bulk-day`,
  `/attendance/summary`, `/reports/{profit-loss,daily,range,monthly,master,hotel-wise,
  item-wise,outstanding,health,data-quality}`, `/import/{template,preview,execute,
  history}`). Capability-gated per resource. **124 operations** vs the legacy 123 —
  18 tests across `test_laundry.py` + `test_laundry_reports.py`.

  Divergences (documented, not silent): report salary expense is derived from stored
  `salary_slips` (FINALIZED/PAID) rather than the full legacy payroll accrual engine;
  import is CSV-native and XLSX only with the optional `openpyxl` extra.

- **quotation `chat` module** — public guest conversations + admin takeover, with
  per-request participant access control (IDOR-safe) and a participant-only group
  invite, envelope-encrypted at rest. 6 tests.
- **database synchronization** (`app/sync/`) — `MongoSyncService` (MAIN→LOCAL
  incremental watermark copy, MAIN→SECONDARY `sync_queue` drain with exponential
  retry/backoff) + `/admin/database/{status,sync-local,sync-secondary,sync-logs}`
  gated to `ADMIN`. Tested against mongomock (real copy/drain, not stubbed). 5 tests.
  **Non-claim:** the interval polling worker and end-to-end replication against the
  production databases have **not** been run.
- **bill-service module — Slice 0 (pure core)** ✅: `app/modules/bill/` created.
  - `services/balance_engine.py` ported **verbatim** (1030 LOC) — the DB-free,
    single-source engine for every delivered/outstanding/billable number.
  - `models.py` ported (965 LOC) — Pydantic request/response shapes.
  - `core/clock.py` extended with the bill helpers (`wall_clock`, `day_query`,
    `day_query_end`, `lkt_year/lkt_month_number/lkt_day_of_week`, `month_start_shift`).
  - 44 regression tests ported and passing (`test_bill_balance_engine.py`,
    `test_bill_billable_delivered.py`, `test_bill_status_recompute.py`).
- **bill-service module — Slice A (routers wired)** ✅:
  - Full legacy package copied under `app/modules/bill/`: 18 routers +
    `repositories/`, `database/`, `services/` (`bill_sync`, `gate_pass_records`,
    `idempotency`, `manual_references`, `operations_context`, `transaction_events`,
    `verification_service`, …) and boundary shims (`crypto_helper`, `auth_helper`,
    `app_time`, `config`, `error_responses`, `router_utils`).
  - **CollectionProxy** (`database/_proxy.py`) lets the verbatim legacy routers
    (`from ..database.main_db import X`) resolve real motor collections in prod and
    an in-memory mongomock in tests; `create_app()` binds the mock when
    `APP_ENV=test`.
  - `router.py` aggregates all routers except `admin_database` (its `/admin/database/*`
    paths are owned by `app.sync.router`). `app/main.py` includes `bill_router` and
    calls `_init_bill_db(app)`.
  - Registered route surface: **306 unique OpenAPI paths / 403 operations**
    (was 112 paths); all 18 routers import and register cleanly.
  - 12 end-to-end router tests (`test_bill_routers.py`): gate-pass create/list/
    journal/uniqueness, balance derivation, loyalty adjust+tiers, pending
    notifications, day-money/day-close, reconciliation, capability denial, and the
    full **receive → deliver → bill → issue → payment** flow plus shop-bill create
    and dashboard endpoints.
  - 6 flow tests (`test_bill_flows.py`): returns (records + balance recompute +
    over-delivery rejection), dispatch CRUD + optimize + delete, adjustment
    request create/list (incl. `_id` leak fix — mongomock `insert_one` mutates the
    doc in place, raw `ObjectId` leaked into the response; normalized to string like
    the returns router), monthly matrix read/quantities writeback, operational
    reports + linen-categories. Remaining bill slices (large router behaviour
    matrices) tracked in `docs/bill_service_port_plan.md`.

Not yet ported (backlog):
- laundry-management last 13 operations: the **payroll engine**
  (`/salary/calculate`, `/salary/calculate-period`, `/salary/slip`,
  `/salary/payroll-preview`, `/salary/payroll-run` — 7 method+path pairs) and the
  **electricity-meter** endpoints (readings GET/POST/PUT, usage, analytics,
  projection — 6).

### Stage 6 — system_info ✅ (backend) / dashboard ✅
- Bounded, read-only, secret-redacting scanner (symlink-guarded, path-bounded).
- API: `/health`, `/api/summary`, `/api/services`, `/api/services/{name}`,
  `/api/routes`, `/api/dependencies`, `/api/scan`; optional `SCAN_API_KEY`.
- 14 tests (bounding, redaction, extraction, API key enforcement, endpoints).
- Live smoke test against the real legacy tree: 9 services / 420 routes / no leak.
- React dashboard builds (`system_info/frontend`) and consumes the API.

### Stage 5 — App frontend (foundation only)
- Vite + React + TS shell with the legacy route registry, login flow wired to the
  backend, layout, and foundation/backlog page markers. Builds.
- **Not** recreated: the ~235 source files of `quotations-ui` (full workflows,
  print templates, offline Dexie cache, reports). Explicit backlog.

### Stage 8 — Deployment (partial)
- Dockerfiles for backend, scanner, both frontends; `deployment/docker-compose.yml`
  with new loopback ports.
- Load-test **scaffolding only** — k6 not installed; **not run**.

## Explicit non-claims

- ❌ No concurrent-user figure. The k6 scenario exists but has **not been run**.
- ❌ No claim that any backlog module behaves identically; parity matrix rows are
  unticked until ported **and** tested.

## Next steps (ordered)

1. Extend `bill-service` router coverage (Slices B–D behaviour matrices) — routers
   are ported and the core flow is tested; add per-router suites for
   `operational_reports`, `monthly`, `dashboard`, `gatepasses`, `deliveries`,
   `bills`, and `shop_bills` per `docs/bill_service_port_plan.md`.
2. Finish the laundry-management payroll engine (7 ops) and electricity-meter
   endpoints (6 ops).
3. Add the sync *polling worker* process that calls `sync_secondary` on an interval,
   and call `SyncService.enqueue` from quotation/laundry write paths.
4. Port love-bot (Node).
5. Recreate `quotations-ui` pages starting from the route registry.
6. Install k6, run the load test, commit results, then record measured numbers.

## How to resume

```bash
cd architecture_updated_system
.venv/bin/pip install -e "./backend[dev]" -e "./system_info/backend[dev]"
(cd backend && ../.venv/bin/python -m pytest)
(cd system_info/backend && ../../.venv/bin/python -m pytest)
.venv/bin/python scripts/generate_inventory.py   # refresh parity matrix
```

## Local run (verified 2026-10-13)

All four services ran against a **local mongod** (`127.0.0.1:27017`), plus a
seeded admin login. Env is `backend/.env` (gitignored) pointing the three roles at
`lovelaundry`, `lovelaundry_secondary`, `lovelaundry_local`.

| Service | URL | Command |
| --- | --- | --- |
| Backend (306 paths) | http://127.0.0.1:8100 | `(cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100)` |
| App frontend | http://127.0.0.1:8101 | `(cd frontend && npm run dev)` |
| system_info API | http://127.0.0.1:8810 | `./.venv/bin/python -m uvicorn app.main:app --app-dir system_info/backend --host 127.0.0.1 --port 8810` |
| system_info UI | http://127.0.0.1:8820 | `(cd system_info/frontend && npm run dev)` |

- Login: `admin` / `admin123` (role `ADMIN`), seeded into `lovelaundry.users`.
- Verified live: login + JWT + live user-lookup; gate-pass create persisted to
  `lovelaundry.gatepasses`/`linen_events`/`sync_queue`/`audit_logs`; module reads
  (`/users`, `/quotations`, `/workers`, `/customers`, `/expenses`, `/bills`,
  `/shop-bills`, `/returns`, `/dispatch`, `/dashboard/summary`) all 200.
- **Bug fixed:** `Settings.cors_origins` crashed startup when `ALLOWED_ORIGINS`
  was a comma-separated string (`pydantic-settings` JSON-decodes complex fields
  before validators). Now `Annotated[list[str], NoDecode, BeforeValidator(...)]`
  accepts JSON arrays, comma-separated strings, and `*` — so the documented
  `.env.example` copy flow works. Tests still green (143 backend / 14 system_info).

