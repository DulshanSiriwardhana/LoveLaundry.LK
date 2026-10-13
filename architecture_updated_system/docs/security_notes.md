# Security Notes

## Isolation guarantees (verified)

- All work is confined to `architecture_updated_system/`. `git status` on the
  legacy tree shows **no modified tracked files** (only pre-existing untracked
  directories and the prior-session ledger).
- The scanner is **read-only**: it never opens a source file for writing and never
  creates/renames/deletes anything under the scanned root.
- The scanner is **path-bounded**: every traversed entry is verified to resolve
  inside `SCAN_SOURCE_ROOT`; symlinks that escape the root are skipped. There is
  no arbitrary-path parameter in the API.
- The scanner is **secret-redacting**: only environment **variable names** are
  collected; `.env` values are never read into the model, and `redact()` masks
  credential-shaped strings as a second layer. Verified by test and a live
  smoke test against the real tree (0 matches for secret patterns).

## Authentication / authorization

- JWT HS256 signed with `JWT_SECRET` (no default; missing ⇒ startup failure).
- `get_current_user` reloads the user on every request and rejects deleted
  (`401`) / disabled (`403`) accounts — a token for a disabled user stops working
  before expiry. Live role changes take effect on the next request.
- Role-gated mutations use `require_role([...])`.
- Passwords are bcrypt-hashed and stripped from every response (`public_user`).

## Crypto

- Envelope encryption: AES-256-GCM, per-document DEK wrapped by `KEK`.
- `KEK = sha256(MASTER_KEY + "-kek")`, `HMAC_KEY = sha256(MASTER_KEY + "-hmac")`.
- `MASTER_KEY` must be **identical across all recreated modules** (and to legacy
  services if they interoperate). Treat it as a high-value secret.

## Deployment

- Every published host port binds to `127.0.0.1` only.
- The scanner container receives the legacy tree as a **read-only** volume.
- Compose fails fast if `JWT_SECRET` / `MASTER_KEY` are unset.

## Known legacy risks (carried, not introduced)

- Committed `.env` files in the legacy services may contain real credentials.
  Rotation is an operator action and is **out of scope** here; no legacy value was
  read into this project's artefacts.
- The legacy `.gitmodules` contains incorrect `path=` values (git resolves by
  gitlink path). Not modified.

## ⚠ Stray secrets file found (operator action required)

`architecture_updated_system/.env` **already existed** when this stage ran (it was
**not** created by this work). It contains **non-empty** values for `DATABASE_URL`,
`MONGODB_MAIN_URI`, `JWT_SECRET`, `MASTER_KEY`, and others — i.e. likely real
credentials. This project did **not** read its values and did **not** modify it.

Mitigations already in place:

- `.gitignore` ignores `.env`, so it cannot be committed accidentally.
- Both services load their env file from an **absolute path inside their own
  package** (`backend/.env`, `system_info/backend/.env`) — never from the process
  CWD — so this stray root file is **not** loaded implicitly.
- Docker Compose passes secrets explicitly from the shell; it does not consume
  this file.

**Operator action:** verify whether this file is intentional. If it was pasted by
mistake, rotate the exposed credentials and remove/relocate the file. This project
will not delete it.
