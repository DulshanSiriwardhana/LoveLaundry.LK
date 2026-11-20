const coreCollections = {
  central_system: ["users", "adjustments", "sessions"],
  laundry_internal: ["bills", "invoices", "monthly_operations"],
  linen_tracking: ["movements", "snapshots"],
};

for (const [databaseName, collectionNames] of Object.entries(coreCollections)) {
  const database = db.getSiblingDB(databaseName);
  const existing = new Set(database.getCollectionInfos().map((info) => info.name));
  for (const collectionName of collectionNames) {
    if (!existing.has(collectionName)) {
      database.createCollection(collectionName);
    }
  }
}
