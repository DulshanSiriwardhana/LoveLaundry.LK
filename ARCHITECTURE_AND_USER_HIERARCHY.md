# LoveLaundry.LK — Software Architecture & User Hierarchy

Reference document for the multi-tenant platform. It merges:
- the isolation/tenancy model (`architecture_updated_system/ARCHITECTURE.md`),
- the identity model (`user-service/src/user_service/tenancy.py`),
- the role/capability model (`laundry-management/src/auth_helper.py`),
- the web (super-admin) surface (`quotations-ui/src/...`).

---

## 1. What the system is

LoveLaundry is a **multi-tenant laundry-management platform**. Each independent
laundry business ("tenant") is an isolated operational environment. One shared
set of services and databases serves all tenants, with **hard tenant scoping in
every tenant query**. A platform administrator can provision laundries and
support-enter any of them; each laundry's staff see only their own data.

Isolation model (chosen): **shared application + shared databases, hard tenant
scoping.** Every tenant-owned document carries an immutable `laundry_id`. Every
tenant API resolves the tenant from the **signed JWT** (never from request data)
and filters by it. Compound indexes `(laundry_id, …)` back every hot query.

Rejected alternatives (cost/ops): one DB per laundry, one process per laundry,
schema-per-tenant — none justified on MongoDB Atlas + Vercel serverless.

---

## 2. Project structure (monorepo)

```
LoveLaundry.LK/                        # git root
├── user-service/                       # identity, auth, laundry registry, memberships (FastAPI)
├── laundry-management/                 # core business/finance/HR (FastAPI)
├── bill-service/                       # gate passes, deliveries, bills, payments (FastAPI)
├── quotation-service/                  # quotations, garment tags, chat (FastAPI)
├── worker-service/                     # background jobs/sync (FastAPI, sync pymongo)
├── love-ai/                            # AI insights (FastAPI)
├── love-bot/, skaner/                  # auxiliary services
├── quotations-ui/                      # React + Vite web app (manager/super-admin UI)
├── public.lovelaundry.lk/              # public storefront
├── client-pub/                         # client publication
├── architecture_updated_system/        # ADRs, audits, migration plan, scanner, docs
│   └── ARCHITECTURE.md                 # tenancy isolation decision record
├── system-manegment/                   # historical checkout (duplicate services + docs)
└── system-managment/                   # historical checkout (typo'd twin)
```

Key file map (canonical):
- `user-service/src/user_service/main.py` — all auth + laundries + users HTTP routes.
- `user-service/src/user_service/tenancy.py` — laundry registry, memberships, `build_tenant_claims`, `active_membership`, `ensure_lovelaundry`, `is_platform_admin_token`.
- `user-service/src/user_service/auth_helper.py` — JWT create/verify, `get_current_user`, `require_role` (PLATFORM_ADMIN ⊇ ADMIN).
- `user-service/src/user_service/schemas.py` — request/response pydantic models.
- `laundry-management/src/auth_helper.py` — `ROLE_CAPABILITIES` + `require_capability`.
- Each resource service has its own `tenancy.py` (`bill-service/`, `quotation-service/`, `worker-service/`, `laundry-management/`, `love-ai/`) implementing `resolve_laundry_id`, `laundry_match`, `scoped_query`, `owned_filter`, `assert_same_laundry`, `match_stage`, `stamp_missing_laundry_ids`.
- `quotations-ui/src/` — feature folders (`features/platform`, `features/quotations`, …), `context/AuthContext.tsx`, `components/layout/*-route.tsx`, `api/auth-api.ts`, `features/ai/api/ai-api.ts`.

---

## 3. Services and responsibilities

| Service | Domain | Notes |
|---|---|---|
| user-service | Login, JWT, users CRUD, laundry registry, memberships, support-entry, switch-laundry, bootstrap | Source of truth for tenant identity; live per-request role reload |
| laundry-management | Transactions, payments, customers, items, expenses, employees, salary, holidays, attendance, reports | Encrypted CRUD engine + dashboards/reports |
| bill-service | Gate passes, deliveries, bills, payments, loyalty, shop bills, monthly matrix | `balance_engine` is the DB-free single source for delivered/outstanding/billable numbers |
| quotation-service | Quotations, garment tags, chat | Guest/public tracking + admin takeover |
| worker-service | Background jobs, sync drain | Uses synchronous pymongo |
| love-ai | AI insights (dashboard, revenue, expenses, salary, payroll risk) | HMAC-signed requests + `data_hash` envelope; also requires the JWT |
| quotations-ui | The web app | Vite + React + TS; guards by role; Dexie offline cache |

Database roles: **MAIN / SECONDARY / LOCAL** per service; replication via
transport-agnostic `MongoSyncService` (MAIN→SECONDARY via `sync_queue` drain;
MAIN→LOCAL via per-collection `updated_at` watermark).

---

## 4. Tenant identity

- Canonical id: `laundry_id` — lowercase slug, immutable, unique (validated `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`).
- LoveLaundry's permanent id is **`lovelaundry`** (`LOVE_LAUNDRY_ID`).
- Registry home: **user-service** only (`laundries` + `memberships` collections). No other service invents laundries.
- Laundry statuses: `ACTIVE` / `SUSPENDED` / `ARCHIVED`. Suspended/archived fail closed on tenant operations (403).
- Membership: `{auth_id, laundry_id, role, status}` with `status ∈ {active, suspended}`; unique `(auth_id, laundry_id)`. One user may hold different roles in different laundries.

Transitional rule (deploy-order safety): documents predating tenancy carry **no**
`laundry_id` and can only belong to `lovelaundry`. So `lovelaundry` sessions match
unstamped docs alongside stamped ones; every other laundry matches only its own
stamped docs. New writes always stamp. The migration (`scripts/stamp_tenancy.py`
in bill-service/laundry-management) stamps the rest.

---

## 5. Authentication & tenant context (JWT)

- HS256 signed with `JWT_SECRET` (same value across all services; missing ⇒ services refuse to start).
- Token claims: `user_id`, `auth_id`, `user_name`, `role`, `status`, `laundry_id` (active tenant), `laundries` (snapshot `[{id, role, status}]`), and for platform sessions `platform_admin` / `support_entry`.
- `build_tenant_claims` resolves memberships live at login/switch: only memberships with `status == active` **and** whose laundry `status == ACTIVE` are operable. `laundry_id` is set to the single operable laundry if exactly one, else `null`.
- user-service reloads the user row on every request (`get_current_user`): deleted ⇒ 401, disabled status ⇒ 403, live role/status surfaced — so disable/delete/demotion bite immediately even with a 24h token.
- Resource services trust the **token snapshot** for membership + status (kills cross-tenant access via ID manipulation). Residual risk (documented): a suspended laundry's pre-existing tokens remain valid on resource services until expiry. Mitigation path: shorten lifetime + refresh, or a registry-status cache.

Endpoints that mint tokens:
- `POST /auth/login` — tenant or platform token.
- `POST /auth/bootstrap` — creates the first PLATFORM_ADMIN (once only).
- `POST /auth/laundry` — switch active laundry (tenant only; revalidates membership, mints new token).
- `POST /laundries/{id}/enter` — support entry (platform only; 1-hour token, `support_entry: true`).

---

## 6. User hierarchy (roles)

### 6.1 Roles (canonical, from `tenancy.py`)

```
PLATFORM_ADMIN          # platform level — registry + all laundries, via audited support-entry
   └── (superset of ADMIN everywhere; never the reverse)

Within one laundry (TENANT_ROLES):
   ADMIN (TENANT_ADMIN) # full control of exactly one laundry; manages its members
   MANAGER              # operations + payroll/HR/expenses/reports
   STAFF                # counter/cashier; day operations only
```

- `TENANT_ROLES = ("ADMIN", "MANAGER", "STAFF")`.
- `PLATFORM_ADMIN` is a strict superset of `ADMIN`: anywhere `ADMIN` is accepted, `PLATFORM_ADMIN` passes (`auth_helper.py:105`). The reverse is never true.
- `PLATFORM_ADMIN` is never a tenant member of a laundry; it enters a laundry only via `POST /laundries/{id}/enter` (audited).

### 6.2 Capabilities (fine-grained, from `laundry-management/src/auth_helper.py`)

`ROLE_CAPABILITIES` maps each role to capabilities checked by `require_capability`:

| Role | Capabilities |
|---|---|
| ADMIN | management r/w, customer r/w, item r/w, transaction r/w, expense r/w, employee r/w, salary r/w, payment r/w, report r/w, dashboard read, import write |
| MANAGER | identical to ADMIN |
| STAFF | management read, customer r/w, item read, transaction r/w, payment read, dashboard read (no payroll/HR/expenses/reports write) |
| PLATFORM_ADMIN | = full ADMIN set (`ROLE_CAPABILITIES["PLATFORM_ADMIN"] = list(ADMIN)`) |

Frontend route guards mirror this: `AdminRoute` (ADMIN|PLATFORM_ADMIN),
`ManagerRoute` (ADMIN|MANAGER|PLATFORM_ADMIN), `PlatformAdminRoute` (PLATFORM_ADMIN only).

### 6.3 Support entry

- `POST /laundries/{laundry_id}/enter` (platform only) → 1-hour token with `platform_admin: true`, `support_entry: true`, `laundry_id` = entered laundry, refreshed `laundries` snapshot. Audited (`SUPPORT_ENTRY`, `SUPPORT_ENTRY_GRANT` log lines).
- Downstream services treat `platform_admin` OR `support_entry` as platform context: `resolve_laundry_id` returns the token's `laundry_id` without the membership/ACTIVE membership check.
- Frontend keeps the support session **in memory only** (never in localStorage), so a reload returns to the platform session.

### 6.4 Legacy/transitional path

Accounts enrolled in **zero** memberships (pre-tenancy admins) keep legacy
behavior in specific contexts (documented, e.g. `main.py:_has_any_membership`) to
avoid mass lockout on first laundry registration. New accounts always enroll at
creation, so this class shrinks to nothing.

---

## 7. Enforcement contract (every tenant route)

1. Authenticate (JWT verify + live reload).
2. Resolve `laundry_id` from **token claims only** (never request data).
3. Verify laundry `ACTIVE` (snapshot; login/switch verify live).
4. Verify membership + capability/role.
5. Scope the query to the authorized tenant (transitional rule above).
6. Validate ownership of every referenced id (e.g. bill → gate pass → delivery chain must be same laundry).
7. Mutations only after 1–6; audit security events; safe error messages (404 oracle — cross-tenant reads return 404, never another tenant's record).

No endpoint may silently fall back to an unscoped global query. Frontend
filtering is presentation only.

---

## 8. Data classification

- **Tenant-owned (gets `laundry_id`)**: memberships, hotels/clients, quotations + tags + chat, gate passes, deliveries, bills, payments, shop bills, expenses, payroll/HR, inventory/linen, notifications, files, reports/exports, settings, imports, per-tenant audit events.
- **Platform/shared (no `laundry_id`)**: laundry registry itself, sync infra (`sync_*`, `idempotency_keys`), global linen taxonomy until a tenant diverges.

---

## 9. Migration (LoveLaundry first)

1. Operator backs up all databases + files.
2. `POST /auth/bootstrap` creates the platform owner; seed creates `lovelaundry` + membership.
3. Per-service stamp scripts set `laundry_id='lovelaundry'` where missing and report counts (idempotent, never overwrite existing values). Scripts: `bill-service/scripts/stamp_tenancy.py`, `laundry-management/scripts/stamp_tenancy.py`.
4. Compound indexes applied; reconciliation (counts before/after, spot-check balances). Rollback = restore backup.
5. App switches only after verification. No prices, balances, invoice numbers or history rewritten — only `laundry_id` is added.

Cross-service contract check: `system-manegment/scripts/tenant_contract_smoke.py`
path-loads all five downstream `tenancy.py` modules and asserts they agree for two
tenants (plus the legacy `lovelaundry` case), and that two minted JWTs resolve
identically in every service.

---

## 10. Caches, events, jobs

- Tenant cache keys prefixed `laundry:{id}:` (UI query keys gain the active-laundry segment; per-user IndexedDB scope retained). Switching laundry clears the query cache and the previous user's cached DB.
- Background/sync jobs carry `laundry_id`; replication infra stays platform-level (same auth gates on replica reads).
- Financial writes keep existing idempotency keys; uniqueness constraints become tenant-compound (e.g. bill numbers per laundry).
- love-ai responses carry `data_hash`; clients verify integrity locally.

---

## 11. Super-admin web surface (`quotations-ui`)

| Route | Guard | Purpose |
|---|---|---|
| `/laundries` | `PlatformAdminRoute` | Laundry registry: create/edit laundry, set status, add/remove members, enter support session |
| `/users` | `AdminRoute` | User accounts; platform mode adds PLATFORM_ADMIN role + "Enroll in laundry" + per-user membership map |

Super-admin capabilities in the UI:
- Register a laundry (`POST /laundries`), edit details, set `ACTIVE`/`SUSPENDED`/`ARCHIVED` (`POST /laundries/{id}/status`).
- Manage memberships (`GET/POST/DELETE /laundries/{id}/members`) — cannot remove self or the last ADMIN.
- Enter support (`POST /laundries/{id}/enter`) → in-memory support session.
- Provision users (`POST /users`) with optional `laundry_id` enrollment into an ACTIVE laundry (tenant roles only); create PLATFORM_ADMIN accounts (platform only).
- Multi-laundry tenant users see the `LaundrySwitcher` and use `POST /auth/laundry` to switch active laundry (platform admins do not; they enter instead).

Session storage: `ll_token` / `ll_user` in localStorage; support token memory-only.
All API clients attach `Authorization: Bearer <token>` (`authApi`, `aiApi`).

---

## 12. Deployment & configuration

- Frontend env: `VITE_API_URL`, `VITE_BILLS_API_URL`, `VITE_USER_API_URL`, `VITE_WORKERS_API_URL`, `VITE_MGMT_API_URL` (+ optional AI keys).
- Every backend needs the **same `JWT_SECRET`** and **same `MASTER_KEY`** (services refuse to start without them). love-ai requires `JWT_SECRET` to equal user-service's (fail-closed without it).
- `ALLOWED_ORIGINS` must include the app URL. Host ports bind loopback only.
- Health: `GET /health` returns `{"status":"ok"}` on each service.

---

## 13. Testing

- Each Python service runs its own suite with the shared venv
  (`system-manegment/.venv/bin/python -m pytest tests/ -q` from each service root).
- Tenancy is exercised by per-service `test_tenant_isolation.py` (two tenants, 404 oracle, legacy unloved docs) and the cross-service `tenant_contract_smoke.py`.

---

## 14. Deferred / known limitations (owned, not silent)

- Remaining routers/services enforcement beyond the money paths done in this phase.
- Token-lifetime hardening (refresh rotation), MFA/Argon2 migration, account lockout.
- laundry-management payroll-engine + electricity-meter operations still in backlog.
- `system_info` dashboard build, load testing, independent pen-test.
- Suspended-laundry pre-existing tokens valid until expiry on resource services (mitigation specified in §5).
