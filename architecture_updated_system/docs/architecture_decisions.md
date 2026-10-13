# Architecture Decisions

> Stage 2 deliverable. Every decision here is scoped to
> `architecture_updated_system/`. **Nothing outside that directory is modified.**

## ADR-000: Isolation boundary
**Decision.** All new code, configs, dependencies, docs, tests and dashboards live under
`architecture_updated_system/`. The legacy system is treated as **read-only reference**.
**Rationale.** The brief forbids modifying/renaming/deleting the original services,
frontends, `.env` files, manifests, ports or databases. A hard directory boundary makes
this auditable (`git status` on the legacy tree must stay clean).
**Consequences.** No shared virtualenv, no shared lockfiles, no shared runtime.

## ADR-001: Modular-monolith backend instead of 6 microservices
**Decision.** Recreate the six Python services as **one FastAPI application** organised
into isolated domain modules (`app/modules/<domain>`), each owning its routers, schemas and
repository. Preserve the original **API paths** exactly by mounting each module at its
legacy prefix.
**Rationale.** The brief prioritises *preserving API paths and data contracts* over
preserving the deployment topology. A modular monolith makes local run, integration
testing and parity verification dramatically simpler while keeping module boundaries
enforceable (no cross-module imports except through `app.core` / `app.db`).
**Alternatives considered.** (a) Six separate apps mirroring the originals — rejected as
high-overhead with no contract benefit at this stage. (b) Migrating to a new API surface —
rejected; the brief requires preserved paths.
**Exit criteria for splitting later.** If a module needs independent scaling or a distinct
release cadence, extract it behind the same prefix using the stable `app.core` interfaces.

## ADR-002: Preserve the 3-database role model (MAIN / SECONDARY / LOCAL)
**Decision.** Keep the role-based database selection from the legacy
`connection_manager.py`: each role resolves its own URI + db name; business code selects a
role explicitly; the API never reads from `LOCAL`.
**Rationale.** This is load-bearing domain behaviour (offline-first replication +
verification replica), not an implementation detail. Changing it would break the sync
worker and the `/admin/database/*` contract.
**Consequences.** Config exposes `MONGODB_MAIN_*`, `MONGODB_SECONDARY_*`, `MONGODB_LOCAL_*`
with legacy fallbacks (`MONGO_URI`/`DATABASE_URL`, `MONGO_DB_NAME`).

## ADR-003: Repository abstraction with an in-memory adapter for tests
**Decision.** Domain modules depend on a `Repository` protocol. Production uses a
Mongo-backed adapter (motor); tests use an in-memory adapter (and/or `mongomock-motor`).
**Rationale.** The legacy tests must never touch the production Atlas cluster. A pluggable
repository keeps unit tests hermetic and fast while keeping production code on real Mongo.
**Consequences.** Dependency injection via FastAPI `Depends`; no module imports a concrete
client at import time.

## ADR-004: Reuse the legacy crypto envelope scheme byte-for-byte
**Decision.** Port AES-256-GCM envelope encryption, deterministic HMAC search tokens, API
key hashing, request signing, and `canonical_json` exactly (including compact separators,
sorted keys, `ensure_ascii=False`) so cross-client hashes keep matching.
**Rationale.** The Dart (`skaner`) and TS (`quotations-ui`) clients verify `data_hash`
independently; any deviation breaks integrity checks. `MASTER_KEY` remains the single
shared secret.
**Consequences.** `canonical_json` is covered by a golden test; key derivation strings
(`-kek`, `-hmac`) are constants, not configurable.

## ADR-005: JWT auth parity (HS256 + live revocation)
**Decision.** Keep HS256 with `JWT_SECRET`, and keep the "reload the user on every request"
revocation semantics (disabled/deleted users lose access immediately; role changes apply on
the next request).
**Rationale.** Security behaviour must not regress; a valid token for a disabled account
must stop working before expiry.
**Consequences.** `get_current_user` depends on a user lookup interface injected from the
auth module to avoid import cycles.

## ADR-006: `system_info` is a separate, bounded, read-only scanner service
**Decision.** `system_info/backend` is an independent FastAPI service that scans a
**configured source root** (default: the legacy tree) and serves a JSON architecture model.
It is **read-only** against the scanned tree, **path-bounded** (no traversal outside the
configured root), and **secret-redacting** (only `.env`-style *variable names* are
collected; values are never read into responses). It binds to loopback by default.
**Rationale.** The brief demands an architecture intelligence tool that cannot exfiltrate
secrets and cannot be used as an unrestricted filesystem API.
**Consequences.** Reuse the same extraction logic as
`scripts/generate_inventory.py` (single source of truth) by importing it, or vendor a
shared `scanner` package.

## ADR-007: Dashboards are separate apps
**Decision.** `frontend/` recreates the operational UI; `system_info/frontend/` hosts the
architecture-intelligence dashboard. They are independent Vite apps.
**Rationale.** The architecture dashboard is a developer/operator tool, not an end-user
screen; keeping it separate avoids coupling its lifecycle to the product UI.

## ADR-008: Docker Compose for local orchestration
**Decision.** Provide `deployment/docker-compose.yml` wiring the backend, the two
frontends, MongoDB roles and the scanner, with **new** ports (no reuse of legacy ports).
**Rationale.** The brief requires Docker + Compose and forbids reusing original service
ports.
**Consequences.** Port assignments are documented in `deployment/README.md` and must not
collide with the legacy services.

## ADR-009: No fabricated performance claims
**Decision.** The repository contains **no** statement about concurrent-user capacity until
a scripted load test has actually been run and its artefacts committed under
`deployment/loadtest/`.
**Rationale.** The brief explicitly forbids unverified performance numbers.
**Consequences.** `docs/current_checkpoint.md` records "load test: not yet executed".

## ADR-010: Legacy HTTP error shape preserved
**Decision.** HTTP errors return FastAPI's legacy `{"detail": ...}` body (validation
errors return `{"detail": [<errors>]}`). The structured `{"error": {...}}` envelope is
reserved for internal `AppError` only.
**Rationale.** Existing clients (`quotations-ui`, `skaner`, the public storefront) parse
`detail`. Wrapping every 4xx/5xx in a new envelope would break them and violate the
byte-compatible API goal.
**Consequences.** `core/errors.py` maps `StarletteHTTPException` and
`RequestValidationError` to the legacy shape.

## ADR-011: One modular monolith, domain modules per legacy service
**Decision.** Each legacy service becomes a domain package under
`backend/app/modules/<domain>/` (schemas, repository protocol + in-memory + Mongo
adapters, deps, router). The router preserves the legacy service's paths.
**Rationale.** Keeps deployment simple, enables shared crypto/clock/security, and makes
endpoint parity auditable against `docs/functional_parity_matrix.md`.
**Consequences.** When two legacy services used the same path (e.g. `/meta`), only the
first-registered module wins in the monolith; such collisions are tracked in
`docs/current_checkpoint.md`.

## ADR-012: Database synchronization is a transport-agnostic service
**Decision.** MAIN→SECONDARY and MAIN→LOCAL replication lives in
`app/sync/service.py` as `MongoSyncService`, which needs only three database-like
handles (main/secondary/local) and an injectable `ping`. SECONDARY is drained from an
append-only `sync_queue` (retry with exponential backoff, `FAILED` after
`SYNC_RETRY_MAX_ATTEMPTS`); LOCAL is copied incrementally using a per-collection
`updated_at` watermark in `sync_state`. `/admin/database/*` exposes status, manual
sync, and logs, gated to the `ADMIN` role.
**Rationale.** Keeping the engine free of Motor types lets the real copy/drain logic be
tested against mongomock instead of stubbed, while production uses Motor unchanged.
**Consequences.** The polling worker process that calls `drain_due_jobs` on an interval
is still a backlog item; `docs/current_checkpoint.md` records that end-to-end
replication has not been executed against the production databases.
