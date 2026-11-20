// Run against lovelaundry_inventory after setting MONGO_URI.
const requiredCollections = [
  "laundries", "inventory_sections", "inventory_items", "billing_categories",
  "item_rate_history", "monthly_reports", "daily_inventory_entries", "monthly_report_summaries",
  "customers", "invoices"
];
const existing = new Set(db.getCollectionNames());
for (const name of requiredCollections) {
  if (!existing.has(name)) db.createCollection(name);
}

db.laundries.createIndex({ code: 1 }, { unique: true, name: "uq_laundry_code" });
db.inventory_sections.createIndex({ organizationId: 1, code: 1 }, { unique: true, name: "uq_section_code_per_laundry" });
db.inventory_items.createIndex({ organizationId: 1, itemCode: 1 }, { unique: true, name: "uq_item_code_per_laundry" });
db.inventory_items.createIndex({ organizationId: 1, sectionCode: 1, sortOrder: 1 }, { name: "ix_items_by_section" });
db.inventory_items.createIndex({ organizationId: 1, name: 1 }, { name: "ix_items_by_name" });
db.billing_categories.createIndex({ organizationId: 1, code: 1 }, { unique: true, name: "uq_billing_category_per_laundry" });
db.item_rate_history.createIndex({ itemId: 1, effectiveFrom: 1 }, { unique: true, name: "uq_item_rate_effective_date" });
db.item_rate_history.createIndex({ organizationId: 1, itemId: 1, effectiveFrom: -1 }, { name: "ix_item_rate_lookup" });
db.monthly_reports.createIndex({ organizationId: 1, monthKey: 1, customerId: 1 }, { name: "ix_monthly_report_lookup" });
db.monthly_reports.createIndex({ organizationId: 1, status: 1, monthKey: -1 }, { name: "ix_report_status_month" });
db.daily_inventory_entries.createIndex({ reportId: 1, serviceDate: 1, itemId: 1 }, { unique: true, name: "uq_daily_item_entry" });
db.daily_inventory_entries.createIndex({ organizationId: 1, reportId: 1, serviceDate: 1 }, { name: "ix_daily_report_date" });
db.daily_inventory_entries.createIndex({ reportId: 1, itemId: 1, serviceDate: 1 }, { name: "ix_daily_item_history" });
db.daily_inventory_entries.createIndex({ reportId: 1, billingCategoryCode: 1 }, { name: "ix_daily_invoice_categories" });
db.monthly_report_summaries.createIndex({ reportId: 1 }, { unique: true, name: "uq_report_summary" });
db.customers.createIndex({ organizationId: 1, customerCode: 1 }, { unique: true, name: "uq_customer_code_per_laundry", partialFilterExpression: { customerCode: { $type: "string" } } });
db.customers.createIndex({ organizationId: 1, name: 1 }, { name: "ix_customers_by_name" });
db.invoices.createIndex({ organizationId: 1, invoiceNumber: 1 }, { unique: true, name: "uq_invoice_number_per_laundry" });
db.invoices.createIndex({ organizationId: 1, customerId: 1, invoiceDate: -1 }, { name: "ix_customer_invoice_history" });
print("Indexes ready for database: " + db.getName());
