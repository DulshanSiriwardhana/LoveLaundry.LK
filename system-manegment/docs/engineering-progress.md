# LoveLaundry.LK — Engineering Progress Ledger

Autonomous principal-engineer hardening pass.
Working dir: `/home/dulshan/Desktop/LoveLaundry.LK/system-manegment`
Each service under `system-manegment/` is an independent git submodule.

## Environment / baseline

- Python: `/home/dulshan/Desktop/LoveLaundry.LK/system-manegment/.venv` (3.12.7)
  - has: fastapi, pydantic v2, SQLAlchemy, pymongo, pytest, cryptography, PyJWT, bcrypt.
  - NOTE: `requirements.txt` list `motor` (async mongo) but the venv has `pymongo`.
    Code uses `pymongo`/`mongomock` style; verify no runtime motor import.
- Local MongoDB is running on `127.0.0.1:27017` (safe for isolated tests).
- Service `.env` files point at MongoDB Atlas PRODUCTION. Do NOT run destructive
  fixtures against them. Tests mock the DB.
- Original source state: every service is clean at its git HEAD (recoverable
  checkpoint via `git checkout -- .` / `git reset --hard <sha>`).

### Test baseline (before changes)

| service | tests |
|---|---|
| bill-service | 208 passed |
| laundry-management | 5 passed |
| user-service | 4 passed |
| quotation-service | no tests |
| worker-service | no tests |
| love-ai | no tests |
| love-bot | no tests |
| skaner (Flutter) | 5 test files present |

**Post-fix test totals so far:** bill-service 217, laundry 7, user-service 7,
quotation-service 5, worker-service 3, love-ai 4.

## Fixes applied

### user-service (auth / accounts)

- [x] **C2** `mongodb_repository.py` `update()`: popped `_id` before `$set`
  (MongoDB rejects `_id` inside `$set`), removed the blanket `except: return
  None` that masked the failure as a 404. Regression test
  `tests/test_user_update.py`.
- [x] **H6 token revocation** `auth_helper.py`: `get_current_user` now reloads
  the user from the DB on every request and rejects deleted/disabled accounts
  (403 "account deactivated") while reflecting live `role`/`status` in the JWT
  payload → demoted/disabled users lose access immediately, not at token expiry.
- [x] `main.py` now imports `DISABLED_STATUSES` from `auth_helper` (single
  source of truth) instead of redefining it locally.
- Tests after fix: **7 passed** (4 original + test_user_update + test_token_revocation).

### quotation-service

- [x] **A1 sync worker never starts for MongoDB**: the worker
  `synchronization_service.start_worker()` was `return`-guarded inside the
  SQL-only `_migrate_quotation_schema()`, so the Mongo production setup never
  ran replication. Moved into `startup_event` (still skipped under `ON_VERCEL`).
- [x] **A5 `int(quotation_id)` → 500**: `_norm_qid()` now raises a clean 404 for
  non-numeric ids on SQL backends; all five `int()`/`str()` coercion sites
  (`get/update/delete`, `advance_quotation_status`, `track_quotation`) use it.
- [x] **A4 chat conversation IDOR** `routers/chat.py`:
  - `get_guest_conversation` now **requires** `guest_id` and returns 403 for
    non-participants (unknown conversations still return an empty shape, no
    existence oracle).
  - `post_guest_message` returns 403 if the caller isn't a participant of an
    existing thread (first message still creates the conversation).
  - `add_participant` requires an `inviter_guest_id` who is already a
    participant before adding a new member.
  - Regression suite `tests/test_chat_idor.py` (**5 passed**).

### laundry-management

- [x] **C1** `reports.py` hotel-wise/item-wise returned nonexistent
  `payload["hotel_summary"]`/`["item_summary"]` keys → KeyError/500. Added
  `_summaries_from_transactions` + `_report_transactions`; both reports now work.
- [x] **H1** `_dec_expenses` silently dropped undecryptable expenses (understated
  spend / overstated profit). Falls back to raw fields instead. Regression tests
  `tests/test_reports.py`.
- Tests after fix: **7 passed** (5 original + 2 restored).

### worker-service

- [x] SQLite `_migrate_schema` used `ADD COLUMN IF NOT EXISTS` (invalid on
  SQLite, silently failing the whole migration). Now checks `PRAGMA
  table_info` first and only alters missing columns.
- [x] `update_daily_log` recomputes the group `worker_name` label whenever
  `team_members` **or** `is_group_work` changes (a team-only edit previously
  left a stale "A + B"). Regression suite `tests/test_group_label.py`
  (**3 passed**; worker-service previously had no tests).

### bill-service (core business service)

- [x] **L10** `GET /shop-bills/health`, `/schema`, `/info` exposed bill counts,
  status enums, and API info without any auth. All three now require
  `bill:read` capability (consistent with every nearby endpoint).

- [x] **CRITICAL** `routers/bills.py:267,269` called nonexistent
  `be.as_qty` and `be.compute_billable_delivered_by_name` → every non-manual
  bill edit with items raised AttributeError/500. Implemented both in
  `services/balance_engine.py` (delivered-basis billable ceiling) and
  re-added the delivered-basis regression test suite (it had been reverted at
  commit 8868f9c instead of the code being fixed).
- [x] `compute_available` and `compute_gate_pass_balance` now clamp outstanding
  availability to the received quantity (a bogus duplicated return can no
  longer inflate deliverable stock above what the hotel handed over).
- [x] **CRITICAL** `routers/linens.py` used `get_search_token` without import →
  every linen create/bulk-create raised NameError/500. Added
  `from ..crypto_helper import get_search_token`.

Tests after fix: **217 passed** (208 original + 9 restored).

## Verified defect backlog (from parallel audits; not all fixed yet)

### bill-service
- H1 returns money `bill_adjustment` is persisted but never applied to any bill.
- H2 `activate_delivery` validates only doc-level gate pass, mishandles
  multi-source drafts.
- M1/M2 dashboard client-wise / gate-pass-wise reports double count.
- M3 cross-client returns inflate pending.
- M4 adjustments truncate fractional qty via `int()`.
- M5 monthly availability undercounts (uses doc-level gate pass only).
- M7 `bill_sync` leaves stale `payment_status`.
- M10 `PATCH /bills/{id}/status` can set PAID while outstanding > 0.
- L10 `GET /shop-bills/health`, `/schema`, `/info` have no auth dependency.
  **FIXED** — all three now require `bill:read` capability.

### laundry-management
- [x] C1 `reports.py` hotel-wise/item-wise return nonexistent keys → 500.
- [x] H1 `_dec_expenses` silently drops undecryptable expenses.
- H2 per-employee `salary_basis_days` override dead (model lacks field).
- H3 `mark_salary_paid` does not finalize/validate.
- H5 advance auto-deduction race (check-then-act).
- H6 duplicate route `GET /employees/{id}/salaries` (employees.py dead one).

### worker-service
- SQLite `ADD COLUMN IF NOT EXISTS` invalid; group label stale on update.
  **FIXED** — see Fixes applied (SQLite PRAGMA-guarded migration + label
  recompute; regression suite `tests/test_group_label.py`, 3 passed).

### user-service
- [x] C2 `PUT /users/{id}` sends `_id` in `$set` → update fails, masked as 404.
- [x] H6 disabled/role-changed users keep access for token lifetime (no reload).

### quotation-service
- [x] A1 sync worker never starts for MongoDB (indented inside SQL migration fn).
- [x] A4 chat conversation IDOR (client-supplied conversation_id, no ownership).
- [x] A5 `int(quotation_id)` → 500 on non-numeric id.
- [ ] A2 live secrets committed in git history (`.env`) — needs rotation (user).

### love-ai / skaner
- [x] C1 mobile `data_hash` JSON serialization mismatch → **FIXED**. The Python
  signer used `json.dumps` defaults (`, ` / `: ` separators + ASCII escaping)
  while both clients (quotations-ui TS and skaner Dart) emit compact JSON with
  UTF-8 preserved. Added `canonical_json()` (compact, `sort_keys`, non-ASCII
  preserved) in `love-ai/src/crypto_helper.py` and used it for `_hash_payload`.
  Regression suite `love-ai/tests/test_canonical_json.py` (**4 passed**) pins
  the exact bytes and cross-checks a TS-equivalent serializer.
- [ ] C2 hardcoded `dev-key-change-me` AI key shipped in APK (needs build-time
  config; flagged for the app owner).

### frontends (repo root: `client-pub/`, `public.lovelaundry.lk/`)
- [x] client-pub: `src/constants/actions.ts` imports `react-icons` (via `App.tsx`)
  but it was **not declared** in `package.json`. It only "worked" locally because
  of a stray `/home/dulshan/node_modules/react-icons`; CI/Vercel would fail.
  Added `"react-icons": "^5.7.0"` to dependencies and regenerated the yarn v1
  lockfile with a correct entry (`yarn install`). `npm run build` passes.
- [x] public.lovelaundry.lk: the reported leaflet breakage was a **partial
  `node_modules`** (lockfile already declared `leaflet`/`react-leaflet`/
  `@types/leaflet`, but the packages weren't installed). `npm install` + build
  now emits the leaflet chunk; no repo change needed (lockfile reverted to avoid
  npm-9 `libc` noise).
- [ ] Remaining (not fixed — out of the build-breakage scope): client-pub
  navigation wiring, and production env base URLs in quotations-ui
  (`http://localhost:8001` mgmt API / `http://localhost:8009` AI fallbacks).

## Next concrete tasks

1. Fix laundry-management H2/H3/H5/H6 (payroll dead overrides, salary finalize, advance race).
2. Fix bill-service backlog (H1 bill_adjustment apply, H2 activate_delivery, M1-M5, M7, M10).
3. Fix quotations-ui production env base URLs (mgmt API / AI localhost fallbacks).
4. Update this ledger after each stage.
