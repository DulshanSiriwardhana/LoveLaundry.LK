# Migration Plan

How to move from the legacy system to the recreated one **without touching the
legacy system** during the transition.

## Guiding rules

1. The legacy services stay running and untouched throughout.
2. The recreated backend exposes the **same paths** as legacy, so clients can be
   repointed by changing `VITE_*_API_URL` (frontends) / service URLs (bot).
3. Cut over **per module**, never big-bang.

## Phase A — Parallel run (current)

- Legacy serves production.
- Recreated backend runs on `:8100` with a copy of the data (fresh Mongo on
  `:27018`). Parity matrix rows are ticked only as modules are ported + tested.

## Phase B — Shadow verification

- Point a copy of traffic (or the scanner + read-only clients) at the recreated
  backend and diff responses against legacy for the ported modules.
- The three-DB role model (MAIN/SECONDARY/LOCAL) is preserved, so the existing
  sync/verification semantics carry over (once the sync worker is ported).

## Phase C — Module cutover

Order by risk/size (small→large): `worker-service` → `quotation-service` →
`love-ai` → `laundry-management` → `bill-service`.

For each: repoint the relevant `VITE_*_API_URL` / bot URL, monitor, keep legacy
warm for rollback.

## Phase D — Decommission (operator decision)

Only after every parity row is ticked, tests pass, and a load test has been run.
No dates are asserted here.

## Data

- `MASTER_KEY` / `JWT_SECRET` must match so encrypted fields and tokens remain
  valid across the transition.
- Database migration is a straight role-based copy; the recreation does not change
  the storage schema for ported entities.
