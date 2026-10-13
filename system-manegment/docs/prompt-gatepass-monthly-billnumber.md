# Task Prompt — Gate Pass ↔ Monthly Operations sync & per-hotel bill numbers

> Hand this prompt to an engineer/agent. It is the canonical spec for the
> feature. Implement against the current `bill-service` + `quotations-ui`
> submodules. Do not weaken existing invariants.

## 1. Goal

Make **Monthly Operations the canonical input surface**, keep **Gate Passes**
and monthly operations **bidirectionally consistent**, and enforce that a
**bill number is unique per hotel** (not globally) while being stored with the
hotel's code prefix. Printing must let the operator choose whether the prefix
is shown.

## 2. Requirements

### R1 — Monthly operations is the base
- Entering monthly operations (per day) is the primary workflow.
- Confirming a monthly day must **always create the corresponding gate pass**
  (and any delivery / rewash records) and link them back to the day.
- Generated gate passes start in `DRAFT` and carry `origin.kind == "monthly"`.

### R2 — Manual gate passes sync back to monthly operations
- Creating a gate pass manually via `POST /gatepasses` is optional but, when
  done, it **must** be reflected in the matching monthly entry
  `(client_name, kind="receiving", year, month, day)`.
- Rules for the target day:
  - `EMPTY` → create day state as `CONFIRMED` with quantities derived from the
    gate pass.
  - `DRAFT` → merge quantities/references and promote to `CONFIRMED`.
  - `CONFIRMED` and already linked → no-op.
  - `CONFIRMED` with other passes → append `gate_pass_id`.
  - `CANCELLED` → skip (log a warning).
- Editing a manual gate pass's references (bill number, ALRS number, gate-pass
  number) must propagate to the linked monthly day.
- Monthly-generated passes must **not** be re-synced (monthly stays the source
  of truth for those).

### R3 — Bill number uniqueness is per hotel
- The same bill number may exist for different hotels; it must **not** collide
  within one hotel.
- Uniqueness of `bill_number` is scoped by `(normalized_value, hotel)`.
- All other references (`gate_pass_number`, `alrs_number`, legacy invoice
  numbers, generated shop-bill ids) remain **globally** unique.

### R4 — Prefix on save
- On save, a bill number must be stored prefixed with the hotel's code:
  `{HOTEL_CODE}-{raw}` (e.g. `RH-1001`).
- Derivation of the hotel code must be stable and idempotent
  (`derive_hotel_code`); re-saving an already-prefixed value must not
  double-prefix.

### R5 — Prefix on display is irrelevant
- Lists/details may show the stored value; no prefix logic is required for
  plain reads.

### R6 — Print asks whether to include the prefix
- When printing a **bill**, **gate pass**, **monthly operations** sheet, or
  **invoice**, first ask the operator: *include the hotel-code prefix or not?*
- Backend print-data endpoints accept `include_prefix` (default `false` =
  strip). The frontend must surface the choice and pass it through.

## 3. Current implementation map (as of this prompt)

`bill-service` (commit `722ff13`):
- `services/hotel_code.py` — `derive_hotel_code`, `prefix_bill_number`,
  `format_bill_number`, `strip_prefix`.
- `services/manual_references.py` — hotel-scoped `bill_number` via composite
  `scope_key`; other refs global.
- `services/monthly_sync.py` — `sync_gate_pass_to_monthly`,
  `update_monthly_day_references`.
- `routers/gatepasses.py` — prefixes `manual_bill_number` on create; calls the
  monthly back-sync; `GET /{id}/print-data?include_prefix=`.
- `routers/monthly.py` — prefixes on day-cell save; confirm creates gate pass;
  `GET /sync-status/{year}/{month}`, `POST /trigger-sync`,
  `POST /trigger-sync-all`, `GET /{kind}/{client}/{year}/{month}/print-data`.
- `routers/bills.py`, `routers/shop_bills.py`,
  `routers/operational_reports.py` — prefix on save + `include_prefix` on
  print-data.

`quotations-ui` (commit `f6a8b10`):
- `features/sync/` — operations sync panel + API (`fetchSyncStatus`,
  `triggerHotelSync`, `triggerGlobalSync`).
- Print-time prefix prompt (R6): `lib/bill-number.ts` (`formatBillNumber`),
  `components/ui/print-prefix-dialog.tsx` + `lib/use-print-prefix-choice.tsx`,
  wired into the Bill, Gate Pass, Monthly Operations and Consolidated Invoice
  print flows (`includePrefix` prop on each print template).

## 4. Acceptance criteria

- [ ] Backend unit/integration tests cover: per-hotel bill-number collision
      (same number allowed across hotels; rejected within one hotel);
      prefix idempotency; manual gate pass → monthly back-sync (all day
      states); monthly confirm → gate pass creation; `include_prefix`
      strip/keep on every print-data endpoint.
- [ ] `quotations-ui` builds (`npm run build`) and lints (`npm run lint`).
- [ ] Printing a bill / gate pass / monthly sheet / invoice asks about the
      prefix and honours the answer.

## 5. Non-goals / invariants

- No global uniqueness relaxation for gate-pass / ALRS / invoice numbers.
- No change to encryption-at-rest for sensitive fields.
- No destructive migration of existing rows: legacy un-prefixed bill numbers
  must still display and match.

## 6. Open questions

1. Should the print prompt default to **with prefix** or **without**?
2. Do *all* print surfaces get the prompt, or only the four named ones?
3. Should the choice be remembered per user/session?
