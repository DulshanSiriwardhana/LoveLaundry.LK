# Shop Counter

Billing and day close for shop customers. Standalone app for our own staff;
it talks to the existing services and owns no data of its own.

- **Deploy target:** shop.lovelaundry.lk
- **Dev port:** 5174
- **Sign-in:** `POST /auth/login`
- **Session storage:** `ll_shop_session` (namespaced — never shared with another app)

## Rules this app must keep

1. The tenant comes from the JWT only, never from a URL, body or query string.
2. Money is computed by `bill_service`. This app never re-adds totals.
3. Nothing is written to a new collection. If the API cannot do it, the API is
   extended first.

## Run

```bash
npm install
npm run dev     # http://localhost:5174
npm run build   # tsc --noEmit && vite build
```
