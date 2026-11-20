// Monthly invoice category totals from item-level daily entries.
// Usage in mongosh: db.daily_inventory_entries.aggregate(monthlyCategoryTotals("monthly-report-2026-10"))
function monthlyCategoryTotals(reportId) {
  return [
    { $match: { reportId } },
    { $group: {
      _id: { code: "$billingCategoryCode", name: "$billingCategoryName" },
      quantity: { $sum: "$quantity" },
      amountLkr: { $sum: "$lineAmountLkr" },
      unpricedQuantity: { $sum: { $cond: [{ $eq: ["$pricingStatus", "missing_rate"] }, "$quantity", 0] } }
    }},
    { $project: {
      _id: 0,
      billingCategoryCode: "$_id.code",
      billingCategoryName: "$_id.name",
      quantity: 1,
      amountLkr: { $round: ["$amountLkr", 2] },
      unpricedQuantity: 1
    }},
    { $sort: { billingCategoryName: 1 } }
  ];
}
