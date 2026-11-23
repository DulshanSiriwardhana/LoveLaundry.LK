# LoveLaundry.LK — Consolidated Security Audit & Production Readiness Report

**Date:** 2026-11-23
**Branch:** `production` (HEAD `5288ed7`; all audit edits are uncommitted/unstaged)
**Scope:** 22 local repositories — all frontends, backends, APIs, databases/auth layers, integrations, WebSockets, and deployment/communication configuration present in this checkout.

---

## 1. Executive verdict

| Gate | Status |
| --- | --- |
| Code-level Critical/High findings in the audited checkout | **PASS** — fixed and covered by local regression tests |
| Credential rotation / history purge | **FAIL** — operator action required |
| Dependency posture (all checkouts) | **FAIL** — 11 unpatched high advisories remain where upgrades were out of scope |
| Live infrastructure, database, backup and DAST verification | **NOT VERIFIED** — no production access from this checkout |
| Overall production readiness | **CONDITIONAL — do NOT declare unconditional production-ready** |

No absolute security claim is made. The results below describe the local source tree and the tests executed against it. Nothing here verifies a running production environment.

---

## 2. Severity inventory and disposition

### Critical

| Finding | Disposition |
| --- | --- |
| Hardcoded MongoDB Atlas URI with a live username/password in tracked migration `system-manegment/release/deploy/migrations/001_multi_tenant_backfill.py` | **Fixed in source** — `resolve_connection()` now reads `MONGODB_MAIN_URI` / `DATABASE_URL` / `MONGODB_URI` and DB name from environment; regression test added. **Rotation still required** — the credential also exists in historical commits. |
| AI service key embedded in browser and mobile clients (HMAC `X-API-Key` / `X-Signature` request signing). A shipped key is public by definition. | **Fixed in source** — browser clients use the signed-in JWT only; `VITE_AI_API_KEY` / HMAC browser code removed from both quotations checkouts, Dockerfile, `.env.example`, deploy examples, UI text. All three mobile copies now send `Authorization: Bearer $token` from `services.auth.token`; dead key-settings UI removed; `defaultAiKey = ''`. **Rotation still required** — historical commits contain a 24-character literal key assignment in Dart sources (`cb7033f2` in both skaner repos, `1a2fbe44` in release). Service keys remain server-side for internal service callers (`LOVE_AI_API_KEYS`). |

### High

All of the following were fixed in code and verified locally:

* Cross-tenant IDOR and organization-scope gaps across core API routers (`bills`, `linen`, `adjustments`, `events`, `notifications`, `dashboards`, `linen/missing`, reconciliation history, tag import/activation). Scoping now goes through `repository_scope()` / `assert_organization_access()` in `production/backend/app/core/principal.py`.
* User enumeration and membership-injection issues in `system-manegment/user-service`.
* Fail-open authentication that trusted JWT claims alone: `get_user_lookup(required=True)` in `production/backend/app/core/security.py` now requires a live user record; no claims-only fallback. Disabled status, `token_revoked`, `token_revoked_at` and `token_version` are enforced, including on WebSockets.
* Stale tenant/role claims: live user record wins on status and revocation; normalized principal derives stable identity from the verified record.
* Missing authorization on `/notifications/stream`, `/events`, `/dashboards/platform`, `/linen/missing/scan` and reconciliation history.
* RFID endpoint SSRF: new `production/backend/app/rfid/endpoints.py` validates host/port and rejects loopback, link-local/metadata, multicast, public and (by default) hostname targets; development/simulated adapters cannot be registered in production.
* Client-controlled audit/approver identity: `actor_identity()` in `production/backend/app/core/principal.py` derives `actor_id`/`auth_id`/`user_name` from the verified principal when authentication is enabled, defeating body-based audit forgery and self-approval bypass.
* Login-throttle bypass via forwarded IP headers: in-process limiter in `production/backend/app/authentication/router.py` ignores `X-Forwarded-For` unless the deployment explicitly configures trusted proxies.
* Localhost origins allowed by CORS in production: `production/backend/app/core/config.py` strips local origins when `APP_ENV=production`.
* Sensitive input reflected in validation errors: `production/backend/app/core/errors.py` returns generic `{"detail": "Invalid request"}` / `{"detail": "Internal server error"}`; no input echo.
* Unbounded request bodies: `production/backend/app/core/http_limits.py` buffers with a configured cap (default 10 MiB) and returns 413 without reflecting content.
* Missing baseline response headers: `production/backend/app/core/security_headers.py` adds `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, COOP/CORP, restrictive CSP and HSTS to all HTTP responses; equivalent hardening applied to nginx/Vercel configs across production apps, both quotations checkouts, release v2 hotel-scanner and platform-admin.

### Medium / Low

| Finding | Disposition |
| --- | --- |
| Over-long access-token lifetime | **Fixed** — user-service TTL tightened; core honours revocation markers. |
| Reader credential revocation | **Fixed** — immediate revocation verified in `test_hybrid_identity.py`. |
| Gatepass 500 leaked exception detail | **Fixed** in `system-manegment/bill-service` — generic response; detail sent to module logger only. |
| JWT access tokens stored in `localStorage` in authenticated frontends | **Residual risk** — CSP and shorter TTL reduce exposure but do not eliminate XSS token theft. Not changed to preserve architecture/auth behaviour. |
| WebSocket token-in-URL in hotel-scanner and quotations live-feed clients | **Residual risk — NOT VERIFIED server-side** — no `/ws/linen` server implementation exists in this checkout. Client behaviour preserved as required. |
| In-process login throttling is per-process | **Residual risk** — multi-instance deployments need a shared limiter. |
| SCA advisories | **FAIL / open** — see §6. |

---

## 3. Key changed files (evidence)

* `production/backend/app/core/security.py` — fail-closed live-user lookup, status and revocation checks.
* `production/backend/app/core/principal.py` — `actor_identity()`, organization scoping helpers.
* `production/backend/app/core/http_limits.py`, `security_headers.py`, `errors.py` — new transport/error hardening modules.
* `production/backend/app/main.py` — middleware wiring (body limit, CORS, security headers).
* `production/backend/app/authentication/router.py` — proxy-header-independent throttling.
* `production/backend/app/rfid/endpoints.py` (new) — endpoint/SSRF validation.
* `production/backend/app/api/{bills,linen,adjustments,notifications,events,dashboards,rfid,linen_lifecycle}.py` — authorization and principal-derived identity.
* `production/backend/app/{identity/service.py, linen/missing.py, notifications/service.py, reconciliation/service.py, events/outbox.py}` — tenant scoping.
* `production/backend/tests/test_backend_hardening.py` (new, 13 tests), `tests/live_lookup.py` (new), `tests/test_tenant_security_regressions.py` (new, 14 tests), plus updates to `conftest.py`, `test_auth_contract.py`, `test_production_workflows.py`, `test_security.py`.
* `production/tests/unit/test_frontend_secret_hygiene.py` (new, 22 tests), `test_deployment_secret_hygiene.py` (new, 2 tests), `test_frontend_security_headers.py` (new, 16 tests).
* Both quotations checkouts: `src/features/ai/api/ai-api.ts`, `src/config/ai.ts`, `src/features/ai/pages/ai-insights-page.tsx`, `.env.example`, `Dockerfile`, `nginx/default.conf`, `vercel.json` — JWT-only AI client, hash-based CSP without `unsafe-inline` in `script-src`.
* All three mobile copies (`system-managment/skaner`, `system-manegment/skaner`, `system-manegment/release/edition-v1/LoveMobi`): `lib/features/misc/ai_insights_page.dart`, `lib/features/misc/settings_page.dart`, `lib/config/api_config.dart`.
* `system-manegment/release/deploy/migrations/001_multi_tenant_backfill.py` — env-only connection configuration.

Architecture, routes, APIs, auth model, permissions, business logic, WebSocket behaviour, theme contracts and deployment topology were preserved; no feature was removed to hide a finding.

---

## 4. Verification results (exact, re-run on 2026-11-23)

### Python suites

| Suite | Result |
| --- | --- |
| Core backend (`production/backend`, `--tb=short`) | **83 passed in 10.93s** |
| User service (`system-manegment/user-service`) | **177 passed, 48 warnings in 58.36s** |
| Bill service (`system-manegment/bill-service`) | **457 passed, 2 skipped, 13 warnings in 9.00s** |
| Love AI (`system-manegment/love-ai`) | **27 passed in 1.44s** |
| Production unit tests (`production/tests/unit`, includes frontend secret hygiene 22, deployment secret hygiene 2, frontend security headers 16) | **45 passed in 4.36s** |
| Laundry management (both checkouts) | **135 passed** each |
| Quotation service (both checkouts) | **68 passed** each |
| Worker service (both checkouts) | **44 passed** each |
| Monolith | **7 passed** |
| Release edition-v2 | **66 passed** |
| Architecture backends (`architecture_updated_system/backend`, `system_info/backend`) | **rc=0** |

### Frontend builds and tests

| Target | Result |
| --- | --- |
| `production/apps/hotel-app` | `BUILD_OK` |
| `production/apps/hotel-scanner` | `BUILD_OK`; tests **17 passed** |
| `production/apps/shop-app` | `BUILD_OK` |
| `system-manegment/quotations-ui` | `BUILD_OK`; tests **60 passed** |
| `system-managment/quotations-ui` | `BUILD_OK` |
| Production `laundry-internal` / `laundry-scanner` / `linen-tracking` / `platform-admin` / shared components | **7 / 9 / 7 / 8 / 3 passed** |
| `love-bot` (both checkouts) / camelot backend / guest-billing | **1 / 1 / 4 / 4 passed** |
| Dart analyzer, three mobile copies, changed files | **No issues found** |

### Blocked verification

* `system-manegment/release/edition-v2/apps/hotel-scanner` and `system-manegment/release/edition-v1/quotations-ui`: incomplete local `node_modules` (`vitest: not found`, `vite: not found`); no install permitted, so builds/tests were not run there.
* No dependency install, upgrade, commit, stage, push, pull, rebase or force-push was performed.

---

## 5. Tenant-isolation, database and infrastructure status

**Tenant isolation (code-level): PASS.** Regression suites cover cross-tenant access denial, organization-scoped repository predicates, invalid/missing organization scope, stale tenant claims, disabled users, revocation, and live-lookup outage. Core uses a shared live-user projection for authenticated fixtures (`tests/live_lookup.py`) and fails closed when no user record or lookup fails (503 with generic detail).

**Live multi-tenant database: NOT VERIFIED.** No production database was accessed. Tenant-field backfill correctness, indexes, and per-tenant query enforcement against real data were not confirmed.

**Database credential handling: partial.** The hardcoded Atlas URI was removed from the tracked migration, and no high-confidence credential pattern remains in tracked source files. However, untracked runtime secret files on disk (`deploy/backend.env`, `architecture_updated_system/.env`, and service `.env` files) still contain live credentials; they must remain gitignored and uncommitted, and the exposed credential must be rotated.

**Backup / recovery: NOT VERIFIED.** Only application-level JSON export UI (`reports-backup`, mobile `backup_restore_page`) exists in the checkout. No automated backup schedule, restore drill, or disaster-recovery runbook was found.

**TLS / network enforcement / Vercel edge: NOT VERIFIED.** Security headers are configured in application and nginx/Vercel files, but actual TLS termination, HSTS at the edge, WAF/network ACLs, and Vercel edge defaults were not observable from repository evidence.

**DAST: NOT VERIFIED.** No dynamic scan was run.

**`/ws/linen` server authorization: NOT VERIFIED.** No server implementation exists in this checkout; only client-side WebSocket usage was observed.

---

## 6. Dependency (SCA) status — FAIL where upgrades were out of scope

`npm audit --omit=dev` results:

* `production/apps/*` and `production/shared/frontend-components`: **0 vulnerabilities**.
* `system-manegment/quotations-ui`: **3 high** — `follow-redirects`, `vite`, `zod` (all `fixAvailable=true`).
* `system-managment/quotations-ui`: **7 high** — `axios`, `follow-redirects`, `nanoid`, `source-map-js`, `vite`, `zod` (`fixAvailable=true`), and `xlsx` (`fixAvailable=false`).
* `system-manegment/love-bot`: **1 high** — `body-parser` (`fixAvailable=true`).
* `system-manegment/camelot-reporting/backend`: audit error `ENOLOCK` — no lockfile present; cannot evaluate without creating one (out of scope).

`xlsx` exploitability note: the two advisories are prototype pollution and ReDoS, both requiring untrusted workbook parsing. Source review found only export usage — `XLSX.utils.json_to_sheet`, `book_new`, `book_append_sheet`, `writeFile` in both quotations checkouts — and no untrusted `XLSX.read`/`readArrayBuffer` path. Exploitability in the current code is therefore low, but the package remains unpatched and should be replaced or upgraded when dependency changes are authorised.

No dependency was installed, upgraded, or removed during this audit.

---

## 7. Residual risks

1. **Exposed credentials remain valid until rotated.** The Atlas credential and the Love AI service key must be treated as compromised because they appeared in source/history.
2. **Historical credential commits remain in git history** in four repositories (details in §8). Purging requires a coordinated history rewrite and force-push by operators; it was deliberately not attempted.
3. **Tokens in `localStorage`** — XSS could still steal access tokens. CSP hardening reduces but does not eliminate this.
4. **WebSocket token-in-URL** in two clients; server-side authorization for `/ws/linen` could not be verified.
5. **Unpatched high advisories** in three checkouts (§6).
6. **In-process throttling** is not shared across multiple backend instances.
7. **Proxy IP trust** — deployments behind a proxy must set `TRUSTED_PROXY_CIDRS`; otherwise client-IP-based controls use the direct peer address.
8. **Unverifiable release copies** due to incomplete local toolchains (§4).
9. **No DAST, backup restore drill, or live tenant-isolation check** was performed.
10. **Nested dirty checkout** `system-managment/quotations-ui` is ahead 1 / behind 128 with 101 dirty entries; its local commit `048e7d6` duplicates already-pushed official fix `657d698`. Do not push it without an explicit operator decision.

---

## 8. Operator-required actions (not performed by this audit)

1. **Rotate the MongoDB Atlas credential** found in the untracked runtime env files and historical commits. Update every service and deployment secret store; verify old credential is revoked.
2. **Rotate the Love AI service key** (`LOVE_AI_API_KEYS`). Keep it server-side only; confirm no browser/mobile artifact can present it.
3. **Purge historical credential commits** after rotation, in a coordinated rewrite:
   * root repo: `d114721`
   * `system-managment/quotation-service` and `system-manegment/quotation-service`: `a3d5b41` plus one other commit each
   * `system-manegment/release`: `5bfcff3`
   * historical literal AI key in Dart commits: `cb7033f2` (both skaner repos), `1a2fbe44` (release)
4. Keep all `.env` runtime files gitignored and uncommitted.
5. Set `TRUSTED_PROXY_CIDRS` in proxy deployments; review `MAX_REQUEST_BODY_BYTES` and login-throttle settings for deployment scale.
6. Authorise dependency upgrades (`npm audit fix` where available) and decide the `xlsx` replacement strategy; create a lockfile for camelot backend before SCA can be evaluated.
7. Run DAST, a backup/restore drill, and live multi-tenant isolation verification against production-like data.
8. Verify `/ws/linen` server authorization once the server implementation is available in the deployment environment.

### 8.1 Deployment propagation (performed after this report was drafted)

Git-integrated Vercel deployments were triggered by pushing the hardened configuration. The following commits were pushed by this audit:

| Repository / branch | Commit | Contents |
| --- | --- | --- |
| `DulshanSiriwardhana/LoveLaundry.LK` `production` | `25bdf4d` | Parent tree hardening plus gitlinks repointed to the pushed submodule commits |
| `public.lovelaundry.lk` `main` | `686da42` | Hardened Vercel headers incl. HSTS |
| `LoveLaundry/bill-service` `main` | `4dc8b72` | Service hardening |
| `LoveLaundry/quotations-ui` `main` | `2de54db` | Header/CSP hardening |
| `LoveLaundry/release` `main` | `117d6eb` | Credential removal, mobile key removal, config hardening |
| `LoveLaundry/skaner` `main` | `d52dbb1` | Mobile AI key removal |
| `LoveLaundry/user-service` `main` | `50a55aa` | Service hardening |
| `LoveLaundry/hotel-app` `main` | `c6a05ef` | Hardened Vercel headers only (no application-code change) |
| `LoveLaundry/shop-app` `main` | `faf49db` | Hardened Vercel headers only (no application-code change) |

Live URL observations at the time of verification:

* `system-lovelaundry-lk.vercel.app` and `lovelaundry-manager.vercel.app` **picked up** the new headers: `X-Frame-Options: DENY`, hash-based CSP (`2 × sha256-`), HSTS `max-age=31536000`, and the `lovelaundry-theme` bootstrap.
* `hotels-manager-amber.vercel.app` and `lovelaundry-shop-app.vercel.app` **picked up** the new headers on re-check: `X-Frame-Options: DENY`, `script-src 'self'` CSP (no `unsafe-inline` in `script-src`), HSTS `max-age=31536000`. `style-src` still permits `'unsafe-inline'`, as required by the existing Vite styling.
* `shops-manager.vercel.app` returns `DEPLOYMENT_NOT_FOUND` — the Vercel deployment itself is missing; source repository fixes cannot restore it. Operator must redeploy the Vercel project.
* `hotels-manager.vercel.app` serves an unrelated `HotelManager Pro` application with **no matching source in this checkout**; it could not be updated or verified.
* The hotel/shop live sites deploy from independent `hotel-app`/`shop-app` repositories whose source trees differ substantially from the recreated `production/apps/*` copies. Only response-header hardening was pushed to them; the theme/UI work in the recreated apps was deliberately **not** ported.

The concurrent parent commit `c0ece3e` had already included seven security-fix files from the excluded nested checkout `system-managment/quotations-ui` (a non-deployment duplicate). These were left in place; rewriting published history was out of scope. The dirty duplicate `system-managment/skaner` was intentionally left uncommitted and unpushed.

---

## 9. Checklists

### PASS
- [x] Code-level Critical/High auth, authz, tenant-scoping, SSRF, input-validation, error-handling and header findings fixed.
- [x] AI service key removed from all browser/mobile clients; JWT-only clients verified by automated tests.
- [x] Hardcoded Atlas URI removed from tracked migration; env-only configuration verified by tests.
- [x] Principal-derived actor/approver identity prevents body-based spoofing.
- [x] Fail-closed user lookup with revocation and live-status checks.
- [x] Regression tests added for significant fixes; all local suites listed in §4 pass.
- [x] Production frontends and both quotations checkouts build successfully.
- [x] Existing routes, APIs, auth, permissions, business logic, WebSocket client behaviour, theme contract and deployment topology preserved.

### FAIL
- [ ] Credential rotation (Atlas, Love AI) — not performed.
- [ ] Historical credential commits purged — not performed.
- [ ] No unpatched high-severity dependencies across all checkouts — 11 advisories remain (§6).
- [ ] Release-copy builds/tests where test runners are incomplete — blocked (§4).

### NOT VERIFIED
- [ ] Live database security, tenant backfill and query enforcement.
- [ ] Backup/recovery and restore drill.
- [ ] DAST.
- [ ] TLS termination, HSTS at edge, WAF/network enforcement, Vercel edge defaults.
- [ ] `/ws/linen` server-side authorization.
- [ ] Multi-instance rate limiting behaviour.
- [ ] Release v2 hotel-scanner / release v1 quotations build and test suites.
- [ ] `hotels-manager.vercel.app` (`HotelManager Pro`) source and security posture — no matching source in this checkout.
- [ ] `shops-manager.vercel.app` deployment restoration (`DEPLOYMENT_NOT_FOUND`).

---

## 10. Final statement

The audited source tree is materially hardened and all locally executable regression suites pass. Production readiness remains **conditional**: the credential-rotation, history-purge, dependency-upgrade and live-infrastructure verification gates must be closed by operators before an unconditional production-ready claim can be made. No security control is described here as absolute.
