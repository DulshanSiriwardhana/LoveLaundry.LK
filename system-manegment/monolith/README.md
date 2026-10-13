# LoveLaundry Monolith

Single FastAPI process that serves every Python microservice route.
Originals are **never modified** — `src/monolith/loader.py` imports them
read-only and `src/monolith/main.py` merges their `APIRoute`s into one app.

## Covered subsystems

| key | source (read-only) | routes |
|---|---|---|
| bill | `../bill-service/src/bill_service` | `/bills`, `/gatepasses`, `/deliveries`, `/monthly`, `/reports`, ... |
| mgmt | `../laundry-management/src` | `/api/*` (customers, items, transactions, reports, salary, ...) |
| users | `../user-service/src/user_service` | `/auth/*`, `/users/*` |
| quotations | `../quotation-service/src/quotation_service` | `/quotations/*`, `/chat/*`, `/tags/*` |
| workers | `../worker-service/src/worker_service` | `/workers/*`, `/daily-logs/*`, `/summary/*`, `/meta` |
| ai | `../love-ai/src` | `/api/ai/*` |

`love-bot` (Node/Express) intentionally stays separate.

## Collision policy

- Infra paths (`/`, `/health`, `/api/health`, docs) skipped; monolith owns unified `/health`.
- `/admin/database` kept canonical for bill; users remapped to `/users/admin/database`, quotations to `/quotations/admin/database`.
- love-ai contributes only `/api/ai/*`.
- Audit at `GET /monolith/routes`.

## Run

```bash
cd monolith
cp .env.example .env   # then set real JWT_SECRET + MASTER_KEY (shared by all subsystems)
./run.sh               # or: PORT=8000 ./run.sh
# dev alternative reusing the shared venv:
PYTHONPATH=src python3 -m uvicorn monolith.main:app --port 8000
```

Vercel: `vercel.json` routes everything to `api/index.py` (same pattern as
the microservices). `Dockerfile` serves `monolith.main:app` on port 8000.

## Test (parity loop)

```bash
PYTHONPATH=src python -m pytest -q
```

`tests/test_parity.py` asserts every microservice business route exists in the
monolith with identical path+methods, auth is still enforced, and the merged
OpenAPI builds. Iterate until green — that is the "meets current version" gate.

## Verified state

- Monolith parity suite: **7/7 passed**.
- Merged routes: bill 231, mgmt 123, users 18, quotations 23, workers 13,
  ai 7 → 331 OpenAPI paths.
- Bill-service suite still **218 passed** (originals untouched).
