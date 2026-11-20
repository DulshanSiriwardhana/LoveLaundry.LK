# Love Laundry — MongoDB seed for October 2026

This package contains the October 2026 inventory data and a MongoDB structure for a simple daily-entry web app that produces monthly service summaries for invoicing.

## Database

Default database: `lovelaundry_inventory`

Collections:

| Collection | Purpose |
|---|---|
| `laundries` | Laundry/organization master record. |
| `inventory_sections` | Uniforms, internal items, bedding, F&B linen, pressing-only sections. |
| `inventory_items` | Item catalogue, unit, default rate and invoice-category mapping. |
| `billing_categories` | Invoice summary categories and their mapped item IDs, including future-use categories with no October activity. |
| `item_rate_history` | Effective-dated item rates so future rate changes do not rewrite history. |
| `monthly_reports` | One monthly report header, customer link, workflow and audit status. |
| `daily_inventory_entries` | One document per item per date with quantity and a rate snapshot. This is the source of truth for calculations. |
| `monthly_report_summaries` | October's precomputed daily, section and invoice-category summary. Rebuild it after future edits. |

`customers` and `invoices` collections are created with indexes but have no seeded records. Assign the correct customer to the October report before creating an invoice.

## Import

Requirements: MongoDB Server, `mongosh`, and MongoDB Database Tools (`mongoimport`).

1. Extract this ZIP.
2. Start MongoDB and open a terminal in the extracted `camelot_mongodb_import` directory.
3. Run:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/lovelaundry_inventory"
./import.sh
```

For MongoDB Atlas/remote use, put `/lovelaundry_inventory` in the URI path before any `?` options, for example `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/lovelaundry_inventory?retryWrites=true&w=majority`. Ensure the database user can create indexes and write documents.

The import uses `--mode upsert --upsertFields _id`, so rerunning it updates the seeded documents instead of duplicating them. It does not drop collections.

### MongoDB Compass

Import each JSON file in `collections/` into a collection with the same name. Choose **JSON** and enable **Import JSON array**. Create indexes by running `scripts/setup_indexes.js` in `mongosh` after the import.

## Daily entry flow for the web app

1. Select a `monthly_reports` document (or create one for the selected customer and month).
2. Select a date and load active `inventory_items`, grouped by `sectionCode`. Every seeded catalogue item has an invoice-category mapping; new items must be assigned one.
3. For each item, accept a quantity. Upsert one `daily_inventory_entries` document for `(reportId, serviceDate, itemId)`.
4. Read the active rate from `item_rate_history` (or the item's default rate), then store `unitRateLkr` and `lineAmountLkr = quantity * unitRate` on the entry. This snapshot is important: changing next month's rate must not alter prior invoices.
5. If an item has no rate, save it as `pricingStatus: "missing_rate"`. Do not silently invoice it at zero.
6. Recalculate the monthly summary from `daily_inventory_entries` after saving edits. The summary is derived, not the source of truth.
7. Before invoice generation, require a customer, all positive quantities to have a price, and all items to have a billing category. Then generate a draft invoice and freeze its line amounts.

### Suggested upsert key

```js
{ reportId, serviceDate, itemId }
```

Use MongoDB's unique index `uq_daily_item_entry` to prevent duplicate entries for the same item on the same day in one report.

### Suggested upsert example

```js
const quantity = 12;
const unitRateLkr = 80;
const serviceDate = "2026-11-01";
const item = await db.collection("inventory_items").findOne({ _id: itemId, organizationId });
if (!item) throw new Error("Unknown inventory item");
if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Quantity must be a non-negative integer");
if (unitRateLkr == null && quantity > 0) {
  // Save with missing_rate and prevent invoice finalization until resolved.
}
const amount = unitRateLkr == null ? 0 : quantity * unitRateLkr;
await db.collection("daily_inventory_entries").updateOne(
  { reportId, serviceDate, itemId },
  { $set: { organizationId, reportId, serviceDate, dayOfMonth: Number(serviceDate.slice(-2)),
    itemId, itemCode: item.itemCode, itemName: item.name,
    sectionCode: item.sectionCode, billingCategoryCode: item.billingCategoryCode,
    billingCategoryName: item.billingCategoryName, quantity,
    unitRateLkr, lineAmountLkr: amount,
    pricingStatus: unitRateLkr == null ? "missing_rate" : "priced", updatedAt: new Date() },
    $setOnInsert: { createdAt: new Date() } },
  { upsert: true }
);
```

## Monthly invoice summary

`monthly_report_summaries` contains the October 2026 calculated snapshot, with daily totals and invoice-category totals. For future months, recompute from `daily_inventory_entries`; do not add daily totals manually.

Category aggregation snippets are provided in:

- `scripts/monthly_category_totals.js`
- `scripts/daily_totals.js`

The underlying billing logic groups by `billingCategoryCode` and sums `quantity` and the entry-level `lineAmountLkr`. The app can show invoice lines such as category, quantity, amount, and any unpriced quantity. Do not display a single unit rate for a category that combines items with different rates unless you explicitly calculate and label a weighted-average rate.

## October 2026 imported totals

| Section | Quantity | Amount (LKR) |
|---|---:|---:|
| Uniforms | 3,477 | 260,255.00 |
| Internal Items | 224 | 4,298.00 |
| Bedding | 0 | 0.00 |
| F&B Linen | 4,155 | 117,071.00 |
| Pressing Only | 0 | 0.00 |
| **Total** | **7,856** | **381,624.00** |

The 24 categories with October activity reproduce the workbook's service-category summary exactly. Additional zero-activity categories are included for bedding, pressing-only and other catalogue items so future entries can be billed without an immediate schema change. Each daily and monthly amount is calculated from quantity multiplied by the rate snapshot.

## Import caveats requiring resolution before invoicing

- **Water Bottle Bags:** 2 units recorded on 14 and 18 October, but the source workbook has no rate. The 2 units are included in quantity, their amount is stored as zero with `pricingStatus: "missing_rate"`, and invoice readiness is false until a rate is supplied or the quantity is formally waived.
- **Sarong and Jersey:** source rate is blank, but quantity is zero. They have no rate-history record yet.
- **Customer:** the workbook filename contains “Camelot”, but the visible inventory sheets identify Love Laundry and do not provide a verified customer ID/name. The report therefore has `customerId: null`. Assign the proper customer before invoicing.
- **Printed footer differences:** daily quantities are calculated from item-level daily entries. Where a printed daily footer differs from the sum of the photographed item rows, item-level entries remain the source of truth.
- Bedding and Pressing Only item rows were present, with no recorded daily quantities in the source workbook.

## Data model rules

- `serviceDate` uses `YYYY-MM-DD` strings in `Asia/Colombo` to avoid UTC date-shift issues for day-only records.
- All monetary values use LKR and are stored as numeric values.
- Missing daily entry means no quantity recorded (treated as zero in reports).
- Rates are snapshotted into each daily entry and should not be retroactively overwritten.
- Use the item's `billingCategoryCode` at entry time as a historical classification snapshot. If category mapping changes, preserve the old entry's category unless an authorized correction is made.
- Keep the monthly report in `draft` until reviewed. Invoice generation should not proceed while the report has missing rates, an unassigned customer, or unmapped positive-quantity items.
