# Vercel deployment guide

This repository is a **monorepo with Git submodules**. It cannot be deployed as one Vercel project from the repository root. It must be deployed as **one Vercel project per deployable folder**, with each project's **Root Directory** set to that folder.

This document describes the supported layout, the required environment variables, and the components that cannot run on Vercel as-is.

Copyable env templates for every Vercel project are in [`deploy/vercel/env/`](deploy/vercel/env/). Local-development `.env.example` files have also been added to the root-level apps that were missing them.

> ⚠️ **Secrets already in the repository:** several submodules contain committed `.env` files with real-looking MongoDB credentials and shared secrets (`system-manegment/bill-service/.env`, `system-manegment/quotation-service/.env`, `system-manegment/user-service/.env`, `system-manegment/quotations-ui/.env`, `architecture_updated_system/.env`, `deploy/backend.env`, etc.). Treat those values as compromised: rotate `JWT_SECRET`, `MASTER_KEY`, DB users and API keys before deploying. Never put real values in Vercel via a committed file — use the Vercel dashboard/CLI environment variables.

### What was added to make this deployable

- `deploy/vercel/env/` — one `.env.example` per Vercel project, plus a shared-values reference.
- Missing local `.env.example` files for `production/backend`, the five `production/apps/*` apps, `architecture_updated_system` (root + frontend), and `client-pub`.
- Vercel serverless handlers (`.python-version`, `.vercelignore`, `api/index.py`, `vercel.json`) for `production/backend` and `architecture_updated_system/backend`.
- SPA `vercel.json` rewrites for the frontends that had none.

The authoritative microservice submodules under `system-manegment/` were intentionally left unchanged so they do not become dirty submodules; the small source fixes they still need are listed in section 3. Unrelated pre-existing work in the working tree was also left untouched.

---

## 1. What can and cannot be deployed to Vercel

### Deployable on Vercel

| # | Vercel project | Root Directory | Runtime | Build / output |
|---|---|---|---|---|
| 1 | `ll-bill-service` | `system-manegment/bill-service` | Python 3.13 | `api/index.py` |
| 2 | `ll-user-service` | `system-manegment/user-service` | Python 3.13 | `api/index.py` |
| 3 | `ll-quotation-service` | `system-manegment/quotation-service` | Python 3.13 | `api/index.py` |
| 4 | `ll-worker-service` | `system-manegment/worker-service` | Python 3.13 | `api/index.py` |
| 5 | `ll-laundry-management` | `system-manegment/laundry-management` | Python 3.13 | `api/index.py` |
| 6 | `ll-love-ai` | `system-manegment/love-ai` | Python 3.13 | `api/index.py` |
| 7 | `ll-love-bot` | `system-manegment/love-bot` | Node (TypeScript) | `api/chat.ts`, no build |
| 8 | `ll-quotations-ui` | `system-manegment/quotations-ui` | Vite/React | `npm run build` → `dist` |
| 9 | `ll-public-site` | `public.lovelaundry.lk` | Vite/React | `npm run build` → `dist` |
| 10 | `ll-production-backend` | `production/backend` | Python 3.12 | `api/index.py` (added in this repo) |
| 11 | `ll-platform-admin` | `production/apps/platform-admin` | Vite/React | `npm run build` → `dist` |
| 12 | `ll-hotel-scanner` | `production/apps/hotel-scanner` | Vite/React | `npm run build` → `dist` |
| 13 | `ll-laundry-scanner` | `production/apps/laundry-scanner` | Vite/React | `npm run build` → `dist` |
| 14 | `ll-laundry-internal` | `production/apps/laundry-internal` | Vite/React | `npm run build` → `dist` |
| 15 | `ll-linen-tracking` | `production/apps/linen-tracking` | Vite/React | `npm run build` → `dist` |
| 16 | `ll-recreated-backend` | `architecture_updated_system/backend` | Python 3.12 | `api/index.py` (added in this repo) |
| 17 | `ll-recreated-app` | `architecture_updated_system/frontend` | Vite/React | `npm run build` → `dist` |
| 18 | `ll-system-info-ui` | `architecture_updated_system/system_info/frontend` | Vite/React | `npm run build` → `dist` |
| 19 | `ll-client-pub` | `client-pub` | Vite/React | `npm run build` → `dist` |
| 20 | `ll-mobile-web` | `mobile-app` | Vite/React | `npm run build` → `dist` |

Projects 1–9 are the **authoritative live system** (per `ARCHITECTURE_AND_USER_HIERARCHY.md`). Deploy those first. Projects 10–20 are independent rebuilds/extra apps; deploy only the ones you actually use.

### Not deployable on Vercel as-is

| Component | Why | Alternative |
|---|---|---|
| `system-manegment/monolith` | Its `api/index.py` imports sibling service sources via `../<service>/src`, which is outside its Root Directory. `vercel.json` `includeFiles` also points outside the root. | Keep as Docker/local only, or vendor all six service sources into `monolith/src/` and rewrite `loader.py` before deploying. |
| `system-manegment/release/edition-v1/*` | Frozen release snapshot; submodule is uninitialized in Git. | Do not deploy. Use the authoritative tree. |
| `system-managment/*` | Stale duplicate tree (misspelled). | Do not deploy. Use `system-manegment/`. |
| `system-manegment/skaner` | Flutter mobile app, not a web app. | Build with Flutter and publish to Google Play / App Store, or host the build artifacts as static downloads. |
| `architecture_updated_system/system_info/backend` | Read-only filesystem scanner that needs `SCAN_SOURCE_ROOT` mounted on disk. Vercel Functions have an ephemeral filesystem. | Keep as a container/VM with the legacy tree bind-mounted. Its frontend can still be deployed. |
| `system-manegment/camelot-reporting/backend` | No `api/` handler and no `src/index.ts`/`dist/index.js` entry point in this checkout. | Add an Express serverless handler and a real entry point first. Its env template is included for completeness. |
| Background sync workers | The Python services deliberately skip sync threads when `VERCEL=1` (set automatically by Vercel). MAIN → SECONDARY/LOCAL replication will **not** happen on Vercel. | Run sync in a Vercel Cron/Queue/daemon or an external worker (Railway/Fly/Cloud Run) and keep `SYNC_ENABLED=false` on the functions. |
| `/ws/linen` WebSocket in bill-service | In-memory, single-instance hub; Vercel WebSockets are beta,Fluid-only, pinned to an instance and closed at max duration. | Keep on a long-running container/VM, or add Redis pub/sub + client reconnect/resync before enabling on Vercel. |
| SQLite database URLs | Vercel Functions cannot rely on a persistent local SQLite file. | Use MongoDB Atlas (or hosted Postgres). Never set `DATABASE_URL=sqlite:///...` in Vercel. |

---

## 2. Prerequisites

1. **GitHub repository with the submodules accessible to Vercel.** Vercel supports public Git submodules. If the `LoveLaundry/*` submodules are private, grant Vercel access or convert them to normal folders first; otherwise projects 1–9 will build with empty source directories.
2. **MongoDB Atlas** (or another hosted MongoDB) reachable from the internet. Create separate databases/users as needed. Do **not** use `mongodb://localhost` in Vercel.
3. **Two independent shared secrets**, generated once and reused by every backend that needs them:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"  # JWT_SECRET
   python -c "import secrets; print(secrets.token_urlsafe(48))"  # MASTER_KEY
   ```

   `love-ai` explicitly rejects the placeholder `CHANGE-ME-IN-PRODUCTION-love-laundry-2026`. `production/backend` requires at least 32 characters for both secrets when `APP_ENV=production`.
4. **A hosted LLM endpoint** for love-bot, if you want AI replies (`LLM_BASE_URL` must not be `http://localhost:11434/v1`). If omitted, the bot falls back to its rule-based replies.
5. **Vercel CLI** (optional, for scripted deploys): `npm i -g vercel`.

---

## 3. Required source fixes before deploying the authoritative submodules

These files live inside Git submodules. Edit them in each submodule, commit and push there, then update the gitlinks in this repo.

1. **Replace legacy `builds`/`routes`** in these `vercel.json` files with the modern config below:
   - `system-manegment/bill-service/vercel.json`
   - `system-manegment/laundry-management/vercel.json`
   - `system-manegment/love-ai/vercel.json`
   - (the monolith config is not deployable as-is)

   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "functions": { "api/index.py": { "maxDuration": 30 } },
     "rewrites": [{ "source": "/(.*)", "destination": "/api/index.py" }]
   }
   ```

   Do not combine `functions` with `builds`. The other three Python services (`user-service`, `quotation-service`, `worker-service`) have a `$schema`-only `vercel.json`; adding the same explicit config is recommended for deterministic routing.

2. **Pin Python 3.13.** Vercel ignores `runtime.txt`; it reads `.python-version`, `pyproject.toml` or `Pipfile.lock`. The services already contain `.python-version` with `3.13`, but their `.vercelignore` also lists `.python-version`, so Vercel never sees it. Remove the `.python-version` line from each `.vercelignore`, **or** change `requires-python = ">=3.12"` to `requires-python = "~=3.13.0"` in each `pyproject.toml`.

3. **Set hosted DB env vars** on every backend. Code falls back to `mongodb://127.0.0.1:27017` when `DATABASE_URL`/`MONGODB_MAIN_URI` is missing, which will fail on Vercel.

4. **Set CORS env vars** on every backend to the real deployed frontend origins. Several configs merge a hardcoded allowlist with your env value, but you should still set it explicitly.

5. **Remove committed `.env` files from the submodules** (`bill-service`, `quotation-service`, `user-service`, `quotations-ui`) and rotate the secrets they contained.

These fixes are *not* required for projects 10–20; their Vercel configs and `.python-version` files are already included in this repo.

---

## 4. Environment variable setup

Copy the relevant template from `deploy/vercel/env/` into each Vercel project's **Environment Variables** (dashboard: Settings → Environment Variables, or `vercel env add`). Use the same values for Production, Preview and Development unless you intentionally want different DBs.

Templates available:

| Template | Used by |
|---|---|
| `00-shared.env.example` | Reference only — shared values copied into multiple projects |
| `bill-service.env.example` | Project 1 |
| `user-service.env.example` | Project 2 |
| `quotation-service.env.example` | Project 3 |
| `worker-service.env.example` | Project 4 |
| `laundry-management.env.example` | Project 5 |
| `love-ai.env.example` | Project 6 |
| `love-bot.env.example` | Project 7 |
| `quotations-ui.env.example` | Project 8 |
| `public-storefront.env.example` | Project 9 |
| `production-backend.env.example` | Project 10 |
| `production-frontend.env.example` | Projects 11–15 |
| `recreated-backend.env.example` | Project 16 |
| `recreated-frontend.env.example` | Project 17 |
| `system-info-frontend.env.example` | Project 18 |
| `camelot-backend.env.example` | Not deployable yet; reference |
| `mobile-app.env.example` | Project 20 |

Rules:

- `JWT_SECRET` and `MASTER_KEY` must be **identical** in projects 1–6 (and 10, 16 if deployed) or tokens/decryption will not interoperate.
- `ALLOWED_ORIGINS` / `CORS_ORIGINS` are comma-separated (or JSON arrays where noted). Include every frontend URL, with no trailing slash.
- `VITE_*` variables are **baked into the static bundle at build time**. After changing them you must redeploy the frontend. They are public values — never put secrets in `VITE_*`.
- `CHAT_API_KEY` must be set on both `love-bot` and `quotation-service` if you enable it.
- The code sets `VERCEL=1` automatically on Vercel; do not set it manually unless you are testing locally.

---

## 5. Deploy with the Vercel dashboard (recommended)

For each project in the table:

1. Vercel → **Add New… → Project** → import the GitHub repository.
2. Set **Root Directory** to the exact path from the table. Vercel will show a warning that the root directory is not the repository root — this is expected.
3. Framework Preset:
   - Python services: **Other** (Vercel detects `api/index.py`).
   - `love-bot`: **Other** (no build command, `api/chat.ts` handler).
   - Vite apps: **Vite** (build `npm run build`, output `dist`).
4. Add the environment variables from the matching template.
5. Deploy.

Recommended deployment order:

1. `ll-love-bot` (quotation-service calls it)
2. The six Python backends (1–6)
3. `ll-production-backend` / `ll-recreated-backend` if used
4. All frontends (8, 9, 11–15, 17, 18, 20)

After all frontends have URLs, go back and update `ALLOWED_ORIGINS`/`CORS_ORIGINS` on every backend, then redeploy them.

---

## 6. Deploy with Vercel CLI (alternative)

From this repository root:

```bash
npm i -g vercel
vercel login

# Example: one Python backend
cd system-manegment/bill-service
vercel link          # choose the existing Vercel project or create a new one
vercel env pull .env.vercel.local   # optional, for local debugging only; never commit
vercel --prod

# Example: one Vite frontend
cd ../../public.lovelaundry.lk
vercel link
vercel --prod
```

When using the CLI from a subdirectory, that directory becomes the project root. If you prefer Git-integrated deployments with a Root Directory setting, link once from the repository root and configure the Root Directory in the project settings instead.

Useful commands:

```bash
vercel logs <deployment-url>       # inspect cold-start/import errors
vercel env ls                      # confirm variables per environment
vercel --prod --force              # rebuild with new VITE_* values
```

---

## 7. Post-deployment verification

For each Python backend:

```bash
curl https://<project>.vercel.app/health
```

Then check:

- Login through `quotations-ui` produces a token that is accepted by bill/worker/laundry-management (proves shared `JWT_SECRET`).
- AI insights load (proves shared `MASTER_KEY`, `LOVE_AI_API_KEYS` and matching `JWT_SECRET`).
- Public storefront chat sends a message (proves `VITE_CHAT_API_URL` → quotation-service and `CHAT_BOT_URL` → love-bot).
- QR tracking links resolve (proves `PUBLIC_BASE` on quotation-service and `VITE_TRACK_BASE_URL` on the UI).
- Browser console has no CORS errors (proves `ALLOWED_ORIGINS`).
- `vercel logs` shows no import-time errors such as `DATABASE_URL is not set` or placeholder-key rejection.

---

## 8. Known limitations after deployment

- No MAIN → SECONDARY/LOCAL database replication unless you run an external sync worker.
- `/ws/linen` live updates will not work reliably across Vercel instances.
- Field-level encryption interoperability requires the exact same `MASTER_KEY` everywhere.
- Vercel Functions have plan-dependent execution time limits; `love-bot` requests that call a slow LLM may time out on Hobby plans.
- The recreated `production/` and `architecture_updated_system/` trees are alternative architectures. Running both them and the authoritative `system-manegment/` services against the same databases can cause schema/data conflicts. Pick one architecture for production.
