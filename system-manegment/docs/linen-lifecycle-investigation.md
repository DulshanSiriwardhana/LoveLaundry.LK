# Linen Lifecycle — Phase 1 Investigation

**Scope:** real-time linen scanning, state management, handover (dispatch/receiving), verification and reconciliation across `bill-service`, `quotations-ui`, `skaner`.
**Method:** read-only investigation of the current repository. No behavioural change to production data was made. Every claim below is cited to a file and line that exists on disk as of 2026-11-02.

Companion document for the fix set already made (scanner robustness): `docs/engineering-progress.md`.

---

## 1. Current architecture

### 1.1 Processes

| Component | Path | Runtime role |
|---|---|---|
| `bill-service` | `bill-service/src/bill_service/` | FastAPI + Motor/MongoDB. **Owns the `linens` and `linen_events` collections**, gate passes, deliveries, bills, reconciliation. The only writer of linen state. |
| `quotations-ui` | `quotations-ui/` | React 19 + Vite + TanStack Query. Web operator app: `/linen/scan`, `/linen/bulk-scan`, inventory, gate passes, deliveries. Talks to bill-service via `/api/bills`. |
| `skaner` | `skaner/` | Flutter mobile scanner (`love_mobi`). Field/hotel-side scanning of the same tags. |
| `user-service` | `user-service/` | Auth, roles, capability grants; issues the JWT whose claims define tenancy. |
| `quotation-service`, `worker-service`, `laundry-management` | — | Quotations, workers, store management. Not on the linen state path. |
| `monolith` | `monolith/` | Read-only merge of the microservices for single-process deployment. Not the live topology. |
| `release/` | `release/` | Archived v1 copy. **Ignore.** |

Submodules are pinned individually; a change to `bill-service` must be committed inside that submodule and then re-pinned in the parent.

### 1.2 Data layer

- MongoDB Atlas replica set (connection string supplied through `DATABASE_URL`; the cluster host is deliberately not repeated here), three logical DBs managed in `bill-service/src/bill_service/database/` — MAIN (authoritative writes), SECONDARY, LOCAL, with a `sync_queue`. `connection_manager.py` holds the client.
- The deployment target is fixed by `MONGODB_MAIN_DB` (currently `deploy/backend.env` → `laundry_management`). See §7 — this is the single most consequential open item in this investigation.
- Transactions: the driver is a replica set, so multi-document sessions are *available*, but **no linen path opens a transaction** — every write is a standalone `update_one`/`insert_one`.

### 1.3 Tenancy and authorisation

- `tenancy.py`: `resolve_laundry_id(current_user)` (JWT `laundry_id` claim, with `laundries` snapshot), `scoped_query`, `owned_filter`, `assert_same_laundry` (raises 404 — deliberately indistinguishable from "does not exist", so ids cannot be probed), `laundry_match` (transitional rule that lets unstamped legacy docs resolve to the `lovelaundry` tenant), `stamp_missing_laundry_ids`.
- `auth_helper.py`: `require_capability(...)`. Role→capability lists; `linen:read`, `linen:scan` for STAFF, plus `linen:write` for MANAGER/ADMIN. HS256, `JWT_SECRET`.
- Linen IDs are **globally unique** (`database/main_db.py:120`, `create_index("linen_id", unique=True)`), so a code resolves to exactly one tenant's linen; isolation is then enforced by the tenancy guard, not by the query.

### 1.4 Frontend data layer

- Cache-first TanStack Query with an IndexedDB persister (`src/cache/`), offline axios adapter that queues mutations with deterministic SHA-256 idempotency keys, and a replay/sync engine (`src/api/interceptors.test.ts` covers the interceptor layer).
- Per-resource `staleTime` (`src/cache/cache-config.ts`): `linens: 600_000` — ten minutes. This is why a re-scan of an already-cached linen looked "frozen" before the current fix.
- Global retry policy (`src/App.tsx:32-58`): never retries 400/401/403/404; retries network failures up to 5×.

---

## 2. Existing scanning flow (web)

```
camera (jsQR frame loop) ─┐
                          ├─ parseLinenCode() → GET /linens/by-code/{code} → linens.find_one
keyboard-wedge input ─────┘                                                    (bill-service/routers/linens.py:282-300)
        │
        └─ result card renders → operator taps an action → POST /linens/{doc_id}/scan
```

Relevant code:
- `quotations-ui/src/features/linen/pages/linen-scanner.tsx` — camera loop, manual input, four mutually exclusive outcome cards.
- `quotations-ui/src/features/linen/lib/linen-code.ts` + `.test.ts` — tag normalisation (bare `LL-XXXXXX`, deep link, label text, control bytes). Ported in parity with `skaner/lib/features/linen/_linen_shared.dart` (`skaner/test/linen_code_test.dart`).
- `quotations-ui/src/features/linen/hooks/useLinen.ts` — `useLinenByCode`, stable query key `['linens','code',code]`; a repeat scan is answered by `refetch()`, not a new key (a nonce key would have leaked one persisted query per scan into IndexedDB).
- `quotations-ui/src/features/linen/pages/linen-bulk-scan.tsx` — paste/bulk path, now normalises each token and reports unreadable ones separately.

There is **no notion of a scanning session** anywhere in this flow: no session id, no server-side record of "these scans belong to one operational act". Each scan is a detached state write plus one journal row.

## 3. Existing state-transition flow

`POST /linens/{doc_id}/scan` (`routers/linens.py:369-441`):

```python
ACTION_STATUS_MAP = {           # :383-394, duplicated verbatim at :456-467 in /bulk-scan
    "collect": "COLLECTED", "receive": "AT_LAUNDRY", "start_wash": "WASHING",
    "complete_wash": "DRYING", "press": "PRESSING", "ready": "READY", "deliver": "DELIVERED",
    "mark_missing": "MISSING", "mark_damaged": "DAMAGED", "retire": "RETIRED",
}
from_status = doc.get("status", "IN_STOCK")           # :379 read
...
await linens_collection.update_one(owned_filter(oid, laundry_id), {"$set": update_fields})   # :415 write
await linen_events_collection.insert_one(event_doc)    # :429 — second, separate write
await _note_change(laundry_id, f"scan:{action}")       # :432 — third, separate write
```

Status universe (`models.py:460-464`): `IN_STOCK, AT_CLIENT, COLLECTED, AT_LAUNDRY, WASHING, DRYING, PRESSING, READY, DELIVERED, MISSING, DAMAGED, RETIRED` — 12 statuses, 10 actions.

Key properties, stated plainly because they contradict the brief's premises:

1. **There is no transition legality check.** Any action is accepted from any status. A `READY` linen can be "pressed" again; a `RETIRED` linen can be `collect`ed. The only validation is that the *action string* is known (`:396-398`).
2. **`AT_CLIENT` is unreachable** — no action maps to it. It exists only as a seed value/manual field.
3. **`IN_STOCK` has no producing action** — nothing can put a linen back into stock.
4. **No "Hotel Hands" / "Laundry Hands" partition exists** in the code, models, or UI. Custody is *implied* by status (`AT_CLIENT`/`COLLECTED` ⇒ hotel side; `AT_LAUNDRY`…`READY` ⇒ laundry side) but is never modelled, stored, or queried as such. The brief's "four + four = eight state cards" does not correspond to anything in the repository. See §9 Decision B.
5. **`PATCH /linens/{doc_id}` (`:306-333`) writes `status` verbatim.** `LinenUpdate.status` (`models.py:504`) is `Optional[str]` with no enumeration check, so any string accepted by the caller is persisted directly to the authoritative field, bypassing `ACTION_STATUS_MAP`, the event journal, and `last_scanned_date` entirely.
6. `related_order` (`models.py:514`, `:530`) exists on the scan body and the journal, and **no caller ever sets it** — the link between a linen state change and the shipment it belonged to was planned and never wired.

## 4. Existing dispatch / receiving / reconciliation flow

What exists is a **quantity-level** handover system, and it is genuinely good at its own job:

- **Hotel → Laundry receiving** = *gate pass* (`models.py:25-51`, `routers/gatepasses.py`, 1071 lines). Each line carries `client_qty` (what the hotel declared) and `received_qty` (what the laundry counted), plus `difference`, `mismatch_reason` (`MISSING|EXTRA|COUNTING_ERROR|DAMAGED|OTHER`), `mismatch_notes`, and `rewashed`. **This is sender-declares / receiver-confirms / system-diffs, at item-name granularity.**
- **Laundry → Hotel delivery** = *delivery* (`models.py:154-271`, `routers/deliveries.py`, 1203 lines). Each line carries `quantity` (laundry declares), `client_counted_qty` (hotel confirms, nullable), server-owned `discrepancy` (`:171`, recorded − counted; >0 short, <0 over), `mismatch_reason`. Line-level `gate_pass_id` (`:161`) gives per-line provenance back to the source pass; `source_gate_pass_ids` (`:260`) is indexed (`main_db.py:78`).
- **Corrections are already auditable**: `DeliveryCorrection` (`models.py:203-224`) copies original quantities into a `corrections` history *and* the immutable event journal before applying new values; `GatePassAdjustmentRequest` (`:117-125`) mandates a reason and stages rather than mutates inline; `GatePassModel.adjustments` (`:150`) preserves the original record.
- **`services/balance_engine.py`** computes per-client, per-item opening/received/delivered/adjustment balances — deterministic, reproducible from the records. `routers/reconciliation.py` exposes it.
- One shared append-only journal, `linen_events`, is used both for linen state changes and for gate-pass/delivery transaction events (distinguished by `entity_type`/`entity_id`/`gate_pass_id`; indexes at `main_db.py:137-138`; read API `routers/events.py:19-68`).

What does **not** exist:

- **No linen-level manifest.** `GatePassItem` and `DeliveryItem` have no `linen_id`. A gate pass says "42 bath towels, declared / 40 counted"; it cannot say *which* two towels are short.
- **No shipment entity, no dispatch entity, no receiving entity, no verification round entity.** There is no document that represents "this physical movement of these specific linens, from this hotel, to this laundry, declared by A at T1, confirmed by B at T2".
- **`routers/dispatch.py` is not linen dispatch.** `DispatchModel` (`models.py:303-323`) is pickup/delivery *job scheduling* for workers (`SCHEDULED|ASSIGNED|EN_ROUTE|COMPLETED|CANCELLED`, `assigned_to`, `scheduled_at`, and a haversine route optimiser at `:257-269`). Any design that reuses this name for linen handover will confuse maintainers permanently.
- **No hotel-side application.** The receiving half of Direction B ("the hotel independently scans what it physically receives") has no client. `skaner` is the only non-web operator surface and it talks to the deployed bill-service directly.

## 5. Identified defects

Grouped by the part of the system they break. All are verified by reading current code, not inferred.

**State machine / correctness**
- D1. No transition legality rules — every action valid from every status (`linens.py:369-441`).
- D2. PATCH back door writes arbitrary `status`, bypassing the journal (`linens.py:306-333`, `models.py:504`).
- D3. `ACTION_STATUS_MAP` duplicated in two endpoints (`:383-394`, `:456-467`) — they can diverge silently.
- D4. `AT_CLIENT` unreachable, `IN_STOCK` unproducible (§3 points 2-3).
- D5. No custody model, so "who is holding this linen right now" is not answerable as a query.
- D6. `related_order` never populated — a linen event cannot be tied to a movement.

**Atomicity / integrity**
- D7. Read-modify-write races: `from_status` read at `:379`, written at `:415`; `wash_count` computed in Python (`:405`) rather than `$inc`. Two operators scanning the same linen both read `wash_count = 7` and both write `8` — one wash is lost.
- D8. Three sequential, untransacted writes per scan (linen, event, live clock). Any failure between them leaves state advanced with no journal row, or journaled with a stale linen.
- D9. `services/idempotency.py` exists, is tested (`tests/test_idempotency.py`) and is **not wired into any linen endpoint**. Retrying a timed-out scan duplicates both the write and the event.
- D10. `linen_events` has no unique constraint preventing an identical duplicate event (`main_db.py:132-138`) — duplicates are free.
- D11. `bulk_scan_linens` (`:447-520`) iterates sequentially, each line committed immediately; a mid-list failure aborts the request with earlier writes already committed and **no live-clock bump at all** (`:516` only runs on the success path). See D31 for exactly which failure this is. One foreign tag can silently truncate another tenant's operator's batch.
- D31. **The per-line `Not found` branch in `bulk_scan_linens` is unreachable** (`:480-483`). The code looks the tag up unscoped and then calls `assert_same_laundry(doc, …)`, which raises 404 for a *missing* document too (`tenancy.py:100-111`: "Anything else foreign (or missing) is a 404"), so `if not doc: errors.append(...)` never runs. In the field this means one worn, torn or not-yet-registered barcode kills the entire batch with an opaque 404 after some lines are already written — the opposite of the continuous-scanning behaviour the brief requires. Pinned as current behaviour in `tests/test_linen_contract_baseline.py::test_bulk_scan_aborts_on_the_first_unknown_code`; Phase 2 turns it into a per-line result.
- D12. No TTL/retention on `linen_events` and no archival path; the journal grows without bound.

**Real-time**
- D13–D18 — see §6, points 1-6.

**Handover / reconciliation**
- D19. Quantity-only manifests; per-linen short/unexpected is not computable (§4).
- D20. `dispatch.py` name collision (§4).
- D21. No hotel-side client for Direction B confirmation scanning.
- D22. No "pending dispatches for me to receive" queue keyed on the receiving party — a laundry learns of a dispatch only if someone tells it.

**Verification / correction**
- D23. No verification-round entity; "VERIFY AGAIN" would have nowhere to store findings without mutating the original.
- D24. Human correction of a *linen* scan (as opposed to a quantity line) has no operation — today the only path is PATCH (D2), which destroys the original value.

**Read paths**
- D28. `GET /linens/by-code/{code}` (`linens.py:282-300`) is a **read that writes**: it updates `last_scanned_date` and `updated_at` on the linen and calls `_note_change(...)` (`"lookup"`). So merely looking a tag up mutates authoritative state, and every lookup advances the live clock, invalidating every other session's linen caches. A read-only surface must not be a write trigger; it also makes lookups unauditable ("was this linen scanned, or only displayed?").
- D29. `LinenStats` (`models.py:571+`) is computed by separate count queries, so header figures and list contents can disagree between two requests — acceptable for a dashboard, not acceptable as the basis for a handover summary, which must come from one consistent snapshot.
- D30. **Only three linen endpoints declare a `response_model`** (`GET /linens` at `:221`, `GET /{id}/events` at `:526`, `GET /stats/summary` at `:549`). `POST`, `GET /{doc_id}`, `GET /by-code/{code}`, `PATCH`, `POST /{doc_id}/scan` and `POST /bulk-scan` return `_serialize(doc)` — the stored document verbatim, including `laundry_id` and the `client_name_search` normalisation helper. Not a cross-tenant leak (it is always the caller's own id) but an accidental public contract the mobile client now parses, and the reason the same linen has two different field sets depending on which endpoint produced it. New shipment endpoints must be modelled from the start.

**Delivery / environment**
- D25. Two linen registries in active use (§7).
- D26. `skaner` defaults to `https://bill-service-puce.vercel.app` (`skaner/lib/config/api_config.dart`) while the deployed web bundle calls same-origin `/api/bills` — mobile and web disagree about the same tag.
- D27. CI (`.github/workflows/ci.yml:30-32`) runs only `python -m compileall src/`. The 20+ real pytest modules in `bill-service/tests/` are not executed in CI (`system-manegment/.venv` can run them locally); `quotations-ui` has one test file (`src/api/interceptors.test.ts`) plus the tag-parsing suite added with this pass, and `npm run lint` is broken on this host (oxlint native bindings vs Node v20.16 — pre-existing, unrelated to any change here).

## 6. Real-time synchronisation: the actual root cause

The symptom: *a linen scan changes state in one browser tab and other connected applications never update.* The chain below is why. **There is no server-push mechanism in this system at all** — the feature was never built; what exists is a polling counter that is crippled in three independent ways.

1. **Nothing is ever published.** `live_clock.py:21-32` does a stored `$inc` on a counter document in `live_clocks`. There is no socket, no SSE stream, no pub/sub, no queue consumer, no change-stream watcher anywhere in `bill-service`. Grepping the whole UI for a push client returns nothing. So the *event* exists only as an integer that someone must go and ask about.
2. **`BroadcastChannel` is same-tab-family only.** `quotations-ui/src/features/linen/live-channel.ts` broadcasts within one browser context on one origin. It never crosses machines, users, or apps.
3. **The poll is gated on tab visibility.** `useLiveLinenSync.ts:33-38`: when `document.visibilityState === 'hidden'` the tick reschedules itself and skips the request. A second browser, a minimized station, or a phone screen that is off never asks, and there is no catch-up on resume beyond a single next tick (`:56-58`).
4. **The poll is per-screen, not global.** It is mounted by a hook, so only the app that mounts it learns; `skaner` (Flutter) never polls the clock at all.
5. **The web tier would buffer a push stream even if one existed.** `quotations-ui/nginx/default.conf` has no `proxy_buffering off`, no `X-Accel-Buffering`, no `Upgrade`/`Connection` headers and no long-read timeout for an API location. An SSE or WebSocket path added to the backend without editing this file would appear to hang.The CSP `connect-src` list (same file) also pins which origins a client may open a stream to.
6. **Consequence of 1-5:** correctness today depends on `staleTime`, on manual refetch, and on the operator's browser being visible. Nothing in the system guarantees that two observers see the same state, and there is no event identity, no versioning and no replay, so even if events were emitted, clients could not deduplicate or detect gaps.

Root cause statement: **the write path ends at the database; there is no event plane.** Adding a faster poll or a shorter `staleTime` would be exactly the "polling mechanism to hide the problem" the brief forbids. The fix must introduce a durable, tenant-scoped, replayable event pipeline and retire the clock poll.

## 7. Environment / registry split — blocking decision

Snapshot taken 2026-11-02, read-only aggregation straight against the Atlas cluster (same `DATABASE_URL` in both `bill-service/.env` and `deploy/backend.env`, so this is one cluster with two candidate registries, not two clusters):

| | `laundry_management` | `bill_db` |
|---|---|---|
| Linens | 10 | 30 |
| Status distribution | 9 `IN_STOCK`, 1 `AT_LAUNDRY` | 25 `IN_STOCK`, 1 each `COLLECTED`, `WASHING`, `DRYING`, `DELIVERED`, `RETIRED` |
| `linen_events` | 49 | 304 |
| Gate passes / deliveries | 10 / 2 | 116 / 55 |
| Last real scan | 2026-10-23 | 2026-11-01 |
| Linens stamped with `laundry_id` | 10 / 10 (`lovelaundry`) | 20 / 30 — **10 carry `laundry_id: None`** |
| Written by | the running Docker stack (`deploy/backend.env` → `MONGODB_MAIN_DB=laundry_management`) | the deployed Vercel `bill-service`, which `skaner` and the released web bundle point at |

Three conclusions from the numbers:

1. **Tag code spaces are disjoint.** `bill_db` holds `LL-3G6NGK … LL-ZTFVB2`; `laundry_management` holds `LL-3HKF5U … LL-V8S9CN`. Not one code is shared. A physical tag printed from one registry can *never* resolve in the other — the deeper reason behind the original "QR identified but no linen found" report. The client-side normalisation bugs were real and are fixed, but a tag from the other registry is unfixable in code.
2. **`bill_db` is the operational registry; `laundry_management` is a partial copy.** `bill_db` has 6× the event volume, 11× the handover history, and the only activity on 2026-11-01. `laundry_management` has just one linen that has ever left `IN_STOCK`.
3. **Only one tenant exists in practice** (`lovelaundry`, in both DBs), so consolidation carries low migration risk — but `bill_db`'s 10 unstamped linen documents depend on the transitional `laundry_match` rule and must be stamped as part of any cutover (`tenancy.stamp_missing_laundry_ids`, already covered by `tests/test_stamp_tenancy_script.py`).

Any lifecycle redesign built on the wrong registry produces a system that is internally correct and operationally useless. **This must be decided before Phase 2.**

## 8. Proposed architecture

Principles: one engine, both directions; backend is the source of truth; the database stays authoritative; extend what exists instead of duplicating it; no new microservice; no new required infrastructure beyond what the Atlas replica set already gives us.

### 8.1 Domain model (logical entities, single service)

New collections in `bill-service`, all tenanted by `laundry_id` plus counterparty identity:

1. **`linen_events` extension** (not replacement — existing rows preserved): add `shipment_id`, `operation_id`, `event_version`, `idempotency_key`. Unique index on `(idempotency_key)` and `(shipment_id, linen_id, round, operation)` so a duplicate is rejected *by the database*, not by UI discipline.
2. **`linen_shipments`** — one physical movement. `shipment_no`, `direction` (`HOTEL_TO_LAUNDRY` | `LAUNDRY_TO_HOTEL`), `sender_hotel`, `receiver_laundry` (roles reverse for direction B; identical schema), `status` (`DRAFT → DECLARED → IN_TRANSIT → RECEIVING → RECONCILED → CLOSED` + `CANCELLED`), declared/received operator + timestamps. **Reuse** `DeliveryModel.source_gate_pass_ids`-style multi-source traceability and the existing numbering service (`manual_references_collection`). Rename the existing `dispatch` router to `delivery_jobs` in a compat-preserving way (keep `/dispatch` responding) to kill D20.
3. **`linen_manifest_lines`** — the sender's declaration, one row per linen id per shipment. `shipment_id`, `linen_id`, `linen_category`, `status_at_declaration`, `declared_by`, `declared_at`, `operation_id`. This is what "which two towels are short" is finally answerable against.
4. **`linen_receiving_lines`** — the receiver's confirmation, one row per linen id per shipment: `shipment_id`, `linen_id`, `received_by`, `received_at`, `round` (`primary` | verification round id), `result`. **Never** written by the declaration path; unexpected items land here and are reconciled, not silently merged into the manifest (brief §7 rule 4).
5. **`scanning_sessions`** — the operator's continuous batch. `session_id`, `selected_action`, `target_status`, `party_type` (`hotel` | `laundry`), `operator_id`, `started_at`, `ended_at`, counters derived from its own scan rows rather than trusted from the client. Session lifecycle ≠ shipment lifecycle (brief §10): a session can end with the shipment still open.
6. **`reconciliation_records`** — the deterministic, server-computed result per shipment: per-linen classification (`MATCHED`/`SHORT`/`UNEXPECTED`/`DUPLICATE`/`DISPUTED`/`PENDING`) plus the summary figures. Stored, so both parties read the *same* computed object instead of each recomputing.
7. **`correction_operations`** — append-only corrective records referencing `(shipment_id, operation_id, linen_id, previous_value, corrected_value, reason, operator_id, approved_by, linked_operation_id)`. Original rows are never mutated or deleted (brief §9). Mirrors the shape already proven in `DeliveryCorrection` / `GatePassAdjustmentRequest`.
8. **`event_outbox`** — transactional outbox (see 8.3).

Custody is derived, not invented: a `custody` projection (`HOTEL` | `LAUNDRY` | `IN_TRANSIT`) computed from status + open shipment membership, so the eight-card picker in brief §3 can be built from **real existing actions** without minting new states.

### 8.2 Transition authority

- One server-owned `TRANSITIONS` table: `(from_status, action) → to_status`, legal-only, defined once (kills D3), exposed read-only to clients so the UI renders from data (`GET /linens/transitions`) — no hardcoded state lists on either client.
- Atomic CAS write: `find_one_and_update({_id, status: from_status, laundry_id}, …)` with `wash_count` via `$inc` (kills D7). A lost race returns a typed `409 conflict` carrying the live status; clients never overwrite silently.
- Idempotency: wire the existing `services/idempotency.py` into scan/session/declare/receive/verify endpoints, keyed on a client-supplied deterministic key (the web client already generates SHA-256 offline keys — reuse the same convention; fix `skaner`'s random keys to match).
- `PATCH /linens/{doc_id}` stops accepting `status`. Status changes go through the scan/transition endpoints only; existing callers that pass `status` get a clear 400 with the replacement endpoint named. This is the one intentional API tightening and gets a compatibility window (brief §18: no breaking change without handling).
- Multi-step write sequence moves into a single MongoDB transaction per operation (available on the replica set): linen + manifest/receiving line + event + outbox commit together; live-clock bump becomes redundant and is deleted.

### 8.3 Event plane — recommended: Mongo Change Streams → SSE, no broker

Do not add Redis. Atlas already provides what we need and the brief forbids unnecessary infrastructure.

```
request → authz → validate → transaction { CAS update + lines + event + outbox row } → commit
                                                     └─ change-stream watcher (one per service process)
                                                          └─ SSE /linens/stream?… per connected client
```

- **Transactional outbox** guarantees no event is emitted for an uncommitted change (brief §11.3 point 6).
- A single `watch()` on the outbox collection fans out to in-memory subscribers; `last_event_id` (SSE) + `event_version` per linen give replay and dedup. Frontend handlers become idempotent by keying on `event_id`.
- **Tenant scoping is enforced server-side at subscription time:** the stream is opened only after `resolve_laundry_id`, and events are matched against both `laundry_id` *and* the counterparty identity in the shipment, so a hotel user receives only their own movements and a laundry only its own. Cross-tenant data cannot reach a socket because it is filtered before the socket exists (brief §13, §18).
- Sizing: one watcher per process + fan-out; the path to 1,000 concurrent connections is a separate process pool or, later, a Redis-backed fan-out *without* changing the client contract. Decision A below decides whether to start SSE now and add the broker only if the ceiling is hit.
- `nginx/default.conf` gains an unbuffered, long-timeout `location` for the stream path (`proxy_buffering off; X-Accel-Buffering: no; read_timeout`) and the CSP `connect-src` entry for same-origin streams. Without this the feature does not work in production (§6, point 5).
- Clients: `quotations-ui` replaces `useLiveLinenSync`'s poll with an `EventSource` store that applies events into the query cache directly (no refetch storms, no full-page refresh); on reconnect it replays from `last_event_id` and falls back to one scoped snapshot fetch if the gap is unreplayable. `skaner` gets the same stream. The old `/linens/live-clock` endpoint stays for one release for compatibility, then is removed.

### 8.4 Reconciliation engine

One pure function, `reconcile(shipment) → ReconciliationRecord`, called only by the backend:

- Input: manifest lines + receiving lines (primary round) + accepted corrections.
- Per-linen classification, with the brief's ordering rules enforced in code: shortages stay `PENDING` until the receiver explicitly completes receiving (rule 2); a `SHORT` classification never mutates linen status (rule 3 / §9 — a handover discrepancy is not proof of loss); unexpected items never enter the manifest (rule 4); duplicate attempts don't inflate counts (rule 5); the record is recomputable from raw rows and stored with the row versions it used (rule 6); both parties read the same stored record (rule 7).
- `VERIFY AGAIN` writes a new `round` into `receiving_lines` and a separate verification summary; it does not create a shipment, does not touch the primary round, and issues no state transition (brief §8).
- Quantity-level `balance_engine.py` is kept as the billing-facing rollup; the linen-level engine is a separate, stricter concern. They must not be merged — one is money, the other is custody.

### 8.5 UI

- `/linen/scan` becomes a session: picker of large square cards rendered from `GET /linens/transitions`, grouped by derived custody (`At the laundry` / `From the hotel`), then continuous scanning with auto-focus restore, non-blocking toast-level feedback, live counters and a searchable recent-history strip (brief §4, §5). No blocking dialogs.
- New `Handover` area: `Create dispatch` (declare), `Pending for me` (receive), shipment detail with live reconciliation, `VERIFY AGAIN`, `RESUME / CORRECT`, `CONFIRM & COMPLETE` gated on an authorised decision when discrepancies are unresolved (brief §6, §8, §10).
- Reuse the existing design system (`quotations-ui` cards/buttons/tokens) and the existing gate-pass/delivery screens' vocabulary; no parallel design language.

## 9. Safe implementation sequence

Each phase ends green: pytest for backend behaviour, vitest for client logic, and a live multi-browser check for sync. Nothing is declared done on the basis of a screenshot.

**Phase 0 — Ground truth and guardrails (no behaviour change)** ✅ done 2026-11-02.
Baseline recorded: `bill-service` **424 passed / 2 skipped** in 14s (411 pre-existing + 13 new contract tests; mongomock-backed, cannot reach Atlas), `quotations-ui` **14 passed / 3 files**, `tsc -b` and `vite build` clean. Production data shape frozen in §7 (status distribution, event volume, tenant stamping, code-space overlap). Compatibility guard in place: `bill-service/tests/test_linen_contract_baseline.py` pins every current linen response shape, the action→status contract, and the cross-tenant 404 rule — including three defects (D28, D30, D31) deliberately pinned as behaviour so that fixing them is a visible, deliberate edit.

> **Decision A (blocking):** which registry is authoritative — `bill_db` or `laundry_management` (§7)? Options: (i) keep `bill_db`, repoint `deploy/backend.env` → `MONGODB_MAIN_DB=bill_db` and stamp its 10 unstamped linens; (ii) keep `laundry_management`, migrate `bill_db`'s 30 linens, 304 events, 116 gate passes and 55 deliveries into it; (iii) consolidate both into a third name. Recommendation: **(i)** — `bill_db` already holds the live handover history and the tags that were actually printed and scanned, and moving 40 documents is far less risk than moving 475. Also decide whether `skaner` is repointed from Vercel to the self-hosted stack (D26); my recommendation is to make one URL authoritative for both clients, since mobile and web currently disagree about the same physical tag. I will not move, copy, or repoint production data without an explicit choice.

> **Decision B (blocking):** the brief's "4 Hotel Hands + 4 Laundry Hands = 8 states" does not exist; the code has 10 actions / 12 statuses with no custody partition (D4, D5). Since inventing states is forbidden, options: (i) derive custody and show the **real** existing actions grouped by direction, adding a legal transition into `IN_STOCK`/`AT_CLIENT` so both directions are reachable; (ii) show all 10 actions in two direction groups where they legitimately apply, accepting that the split is 5/5 rather than 4/4; (iii) treat `AT_CLIENT` as a first-class state produced by a new `send_to_hotel` action. Recommendation: (i)+(iii) — it makes the model complete without renaming anything.

> **Decision C:** event plane — (i) Mongo Change Streams + SSE, no new infrastructure (recommended, §8.3); (ii) add Redis pub/sub now. Recommendation: (i), with the fan-out interface drawn so (ii) can drop in later.

**Phase 1** — this document. ✅

**Phase 2 — Backend foundation (correctness first, invisible to users)**
`TRANSITIONS` table + `GET /linens/transitions`; CAS writes with `$inc` for `wash_count`; single-transaction writes; wire `services/idempotency.py` into linen scan/bulk-scan; unique index on `linen_events` idempotency key; fix `bulk_scan` abort semantics (per-line error capture, always bump/emit); close the PATCH `status` hole with a compat window; unit tests for every illegal transition and both racing operators. Existing endpoints keep their response shapes.

**Phase 3 — Real-time infrastructure**
`event_outbox` + transactional emit; change-stream watcher; scoped SSE endpoint; nginx buffering/timeout/CSP config; replace the poll in `quotations-ui` with an idempotent `EventSource` store with reconnect + replay; port to `skaner`; **verify across separate browsers before proceeding** — this is the gate for the brief's core complaint.

**Phase 4 — Scanning UX**
Session entity + endpoints; card picker from live transition data; continuous scan loop, focus restore, session-level duplicate set, live counters, recent history; end-of-session summary. Tests: 1,000-scan session, duplicate storm, two operators on one linen.

**Phase 5 — Dispatch/receiving UI + manifests**
`linen_shipments` + `linen_manifest_lines`; declare flow (hotel→laundry and laundry→hotel on the same endpoints, roles reversed); pending-for-me queue; receiving with live manifest comparison.

**Phase 6 — Reconciliation engine + verification**
`receiving_lines`, `reconciliation_records`, the pure engine and its seven rules; `VERIFY AGAIN` rounds; exact-figure tests (the brief's 5-dispatched / 4-received / 3-matched / 2-short / 1-unexpected case as a fixture).

**Phase 7 — Summary, confirmation, correction**
Summaries with searchable detail; `CONFIRM & COMPLETE` vs `RESUME / CORRECT`; authorised completion-with-exceptions; `correction_operations` and the eight correction operations.

**Phase 8 — Integration, regression, isolation**
End-to-end both directions across two tenants; cross-tenant probe tests asserting 404 and zero stream leakage; performance pass against 1,000 concurrent subscribers; full pytest + vitest + flutter suites; extend `.github/workflows/ci.yml` to actually run them (D27).

**Phase 9 — Documentation**
Operator-facing runbook (dispatch, receive, verify, correct), architecture decision record for the event plane, migration notes for the registry decision, and an updated `docs/engineering-progress.md`.

---

## 10. Test environment facts (for planning)

- `bill-service` requires Python ≥ 3.12 (`pyproject.toml`). A usable environment already exists at `system-manegment/.venv` (Python 3.12.7, pytest 9.1.1, `motor` and `pytest-asyncio` importable), so Phase 0 starts from a working runner, not a bootstrap job.
- `bill-service/pytest.ini`: `pythonpath = src`, `testpaths = tests`, `asyncio_mode = auto`. **Baseline established 2026-11-02: `424 passed, 2 skipped` in 14s** (411 before this pass, +13 contract tests). The harness (`tests/conftest.py`) substitutes `mongomock-motor` for every MAIN/SECONDARY/LOCAL collection, so no test can reach the Atlas cluster — backend work is safely testable locally. Relevant existing modules: `test_linen_live_clock.py`, `test_linen_contract_baseline.py`, `test_idempotency.py`, `test_balance_engine.py`, `test_tenant_isolation.py`, `test_delivery_lifecycle.py`, `test_adjustment_workflow.py`, `test_reported_tenant_bugs.py`, `test_stamp_tenancy_script.py`.
- `quotations-ui`: `npm run test` → `vitest run`. **Baseline: 3 files, 14 tests, all passing** (`src/api/interceptors.test.ts`, `src/features/ai/api/ai-api.test.ts`, and `src/features/linen/lib/linen-code.test.ts` added by the scanner fix). `npm run lint` currently crashes on this host for pre-existing reasons (oxlint bindings vs Node v20.16); `tsc -b` and `vite build` both exit 0.
- `skaner`: `flutter test` runs but mutates tracked iOS generated files as a side effect (uncommitted churn left in place, reported rather than force-reverted).
- Live verification of the camera flow in a real browser is still outstanding: the local stack writes to the **shared Atlas production cluster**, so I did not mint users or seed data. That check needs either the user's own session or explicit consent to create a test tenant.
