# Bill-Service Port Plan

> Working plan for the largest remaining module. bill-service is **22,812 LOC**
> and **225 routes** across 18 routers; it cannot be ported in one sitting. This
> document is the resumable checklist: the collection map, the router inventory
> (with route counts), and the ordered slices, each ticked only when its tests
> pass.

Legacy source: `system-manegment/bill-service/src/bill_service/`.
Target module: `architecture_updated_system/backend/app/modules/bill/`.

## Guiding decisions

- **Pure core first.** `services/balance_engine.py` is database-free and is the
  single source of every delivered / outstanding / billable number. It is ported
  **verbatim** and locked with the legacy unit tests (eligibility: no I/O).
- **Encrypted docs.** Sensitive fields (`client_name`, `items`, `notes`, …) use
  the shared `core.crypto` envelope helpers; the store keeps
  `encryption_metadata` and strips `_search` on read (same contract as the
  laundry module).
- **Capability auth.** Legacy bill-service uses `require_capability` with
  `gatepass/delivery/dispatch/loyalty/bill/payment/dashboard/report/linen`
  capabilities and a narrow STAFF role. The capability map is ported into the
  bill module's auth (`bill/capabilities.py`) rather than reusing laundry's
  (different capability names).
- **Journal + sync.** The append-only `linen_events` journal and the
  MAIN→SECONDARY `sync_queue` are backed by the shared `app/sync` engine where
  possible; per-entity entries wrap the shared `enqueue()`.

## Collection map (MAIN)

| entity | collection(s) | router(s) |
| --- | --- | --- |
| gate passes | `gatepasses` | gatepasses, monthly, dashboard |
| deliveries | `deliveries` | deliveries, monthly, dashboard |
| returns | `returns` | returns |
| adjustments | `adjustments` | adjustments |
| dispatch jobs | `dispatch_jobs` | dispatch |
| bills | `bills` | bills, monthly |
| shop bills | `shop_bills` | shop_bills |
| legacy invoices | `legacy_invoices` | shop_bills |
| bill templates | `bill_templates` | shop_bills |
| payments | `payments` | bills, shop_bills |
| loyalty | `loyalty_accounts` | loyalty |
| linen | `linens`, `linen_events` | linens |
| rewash | `rewashes` | monthly |
| journal | `linen_events` | all write paths |
| audit | `audit_log` | all write paths |
| refs | `manual_references` | manual_references service |
| idempotency | `idempotency_keys` | idempotency service |
| sync status | `sync_status`, `sync_queue` | verification + synchronization |

## Router inventory (route counts, legacy)

| router | routes | LOC | slice |
| --- | ---: | ---: | --- |
| events | 1 | 64 | A |
| day_money | 1 | 77 | A |
| reconciliation | 1 | 107 | A |
| notifications | 2 | 127 | A |
| day_close | 2 | 116 | A |
| loyalty | 3 | 99 | A |
| admin_database | 4 | 107 | A |
| adjustments | 4 | 337 | A |
| operational_reports | 4 | 773 | B |
| monthly | 4 | 1143 | B |
| dispatch | 6 | 310 | A |
| returns | 7 | 467 | A |
| bills | 9 | 1443 | C |
| deliveries | 10 | 1189 | C |
| linens | 12 | 571 | A |
| gatepasses | 13 | 999 | C |
| dashboard | 19 | 1946 | B |
| shop_bills | 122 | 2806 | D |
| **total** | **225** | **12681** | |

## Slices (ordered)

### Slice 0 — Pure core ✅ (this session)
- [x] `services/balance_engine.py` ported verbatim (1030 LOC).
- [x] `models.py` ported (965 LOC) — Pydantic request/response shapes.
- [x] `core/clock.py` extended with the bill helpers (`wall_clock`, `day_query`,
      `day_query_end`, `lkt_year`, `lkt_month_number`, `lkt_day_of_week`,
      `month_start_shift`).
- [x] Regression tests ported: `tests/test_bill_balance_engine.py`,
      `tests/test_bill_billable_delivered.py`,
      `tests/test_bill_status_recompute.py` — **44 tests pass**.

### Slice A — Routers wired + shared persistence ✅
- [x] `database/_proxy.py` — `CollectionProxy` + `bind_role`/`reset`; the legacy
      routers (`from ..database.main_db import X`) resolve real motor collections in
      production and an in-memory mongomock in tests (`create_app` binds when
      `APP_ENV=test`).
- [x] `auth_helper.py` (bill `ROLE_CAPABILITIES` + `require_capability`/`require_role`,
      live revocation via `app.core.security`), `crypto_helper.py` (SearchTokens),
      `app_time.py`/`config.py` shims.
- [x] Ported `services/{idempotency,transaction_events,manual_references,
      verification_service,operations_context,gate_pass_records,bill_sync,
      synchronization_service,local_sync_service}.py` and `repositories/*`.
- [x] Routers (18): events, day_money, reconciliation, notifications, day_close,
      loyalty, admin_database (ported; **not** registered — `/admin/database/*` is
      owned by `app.sync.router`), adjustments, dispatch, returns, linens, gatepasses,
      deliveries, bills, shop_bills, monthly, operational_reports, dashboard.
- [x] `router.py` aggregator + `app/main.py` wiring; **306 unique OpenAPI paths /
      403 operations** register cleanly.
- [x] Integration tests (`tests/test_bill_routers.py`, 12 tests): gate-pass lifecycle
      + journal + uniqueness, balance, loyalty tiers, notifications, day-money/
      day-close, reconciliation, capability denial, full
      receive→deliver→bill→issue→payment, shop-bill create/stats, dashboard read.

### Slice B — Reporting + monthly + dashboard (behaviour matrix next)
- [x] `operations_context.py` (loaders → canonical balances) ported & import-verified.
- [x] monthly matrix read + day-quantities writeback exercised
      (`/monthly/{kind}/{client}/{year}/{month}`, `.../day/{day}/quantities`).
- [x] operational reports partial: `/reports/linen-categories`,
      `/reports/monthly-operations`.
- [ ] Remaining operational_reports, monthly (confirm/persist/cancel), dashboard
      (19) — per-router suites.

### Slice C — Core documents (partial)
- [x] gatepasses create/list/balance/uniqueness + journal; deliveries create +
      over-delivery rejection; bills create/issue/payment; returns create + balance
      recompute; adjustments create/list.
- [ ] gatepasses catch-up/reopen/status transitions; deliveries activate/cancel;
      bills correction/cancel and billing invariants.

### Slice D — Shop bills (122 routes)
- [x] shop-bill create + `/stats/overview`.
- [ ] Full shop_bills + legacy invoices + templates matrix (largest single file).

## Non-claims

- Until each slice's tests pass, the parity-matrix rows stay unticked.
- No end-to-end replication against production databases.
