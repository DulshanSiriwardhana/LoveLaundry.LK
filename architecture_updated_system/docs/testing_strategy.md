# Testing Strategy

## Principles

1. **Hermetic by default.** No test touches the production MongoDB Atlas cluster
   or any network. The backend uses an in-memory repository (`APP_ENV=test`); the
   scanner is tested against a synthetic tree in `tmp_path`.
2. **Test behaviour that was fixed or is subtle** — not line coverage theatre.
3. **No fabricated results.** A reported "passed" count always corresponds to a
   command that was actually run (see `docs/current_checkpoint.md`).

## Layers

| Layer | Location | What it covers |
| --- | --- | --- |
| Unit — crypto | `backend/tests/test_crypto.py` | canonical JSON golden, search tokens, envelope round-trip, signing |
| Unit/HTTP — auth | `backend/tests/test_auth.py` | login, revocation, role gating, password never exposed, CRUD |
| HTTP — health | `backend/tests/test_health.py` | liveness/readiness shape |
| Unit — scanner | `system_info/backend/tests/test_scanner.py` | path bounding, symlink escape, redaction, route/env extraction |
| HTTP — scanner | `system_info/backend/tests/test_api.py` | endpoints, 404s, API-key enforcement |

## Cross-language contract tests

`canonical_json` is asserted against a **golden string** because it must stay
byte-identical to the TypeScript (`quotations-ui/src/config/ai.ts`) and Dart
(`skaner/lib/core/utils/idempotency.dart`) implementations. Any change to the
serializer must update all three in the same commit family and will fail this
test otherwise.

## Running

```bash
(cd backend && ../.venv/bin/python -m pytest -q)
(cd system_info/backend && ../../.venv/bin/python -m pytest -q)
```

## Not yet covered

- Mongo adapter integration tests (mongomock-motor is available; add next).
- Sync worker (not yet implemented).
- End-to-end browser tests for the frontends (none yet).
- Load / performance tests (scaffold only; **not executed**).
