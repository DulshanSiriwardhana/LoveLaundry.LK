# Hotel Desk

Your account with Love Laundry. Standalone app for hotel customers;
it talks to the existing services and owns no data of its own.

- **Deploy target:** hotel.lovelaundry.lk
- **Dev port:** 5175
- **Sign-in:** `POST /client/auth/login`
- **Session storage:** `ll_hotel_session` (namespaced — never shared with another app)

## Rules this app must keep

1. The tenant comes from the JWT only, never from a URL, body or query string.
2. Money is computed by `bill_service`. This app never re-adds totals.
3. Nothing is written to a new collection. If the API cannot do it, the API is
   extended first.

## Run

```bash
npm install
npm run dev     # http://localhost:5175
npm run build   # tsc --noEmit && vite build
```
