#!/usr/bin/env bash
set -euo pipefail

# Include the target database in the URI path.
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/lovelaundry_inventory}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v mongosh >/dev/null 2>&1 || { echo "mongosh is required. Install MongoDB Shell first." >&2; exit 1; }
command -v mongoimport >/dev/null 2>&1 || { echo "mongoimport is required (MongoDB Database Tools)." >&2; exit 1; }

mongosh "$MONGO_URI" --quiet --file "$ROOT/scripts/setup_indexes.js"

for collection in laundries inventory_sections inventory_items billing_categories item_rate_history monthly_reports daily_inventory_entries monthly_report_summaries; do
  echo "Importing $collection..."
  mongoimport \
    --uri "$MONGO_URI" \
    --collection "$collection" \
    --file "$ROOT/collections/$collection.json" \
    --jsonArray \
    --mode upsert \
    --upsertFields _id
done

echo "Import completed using URI: $MONGO_URI"
