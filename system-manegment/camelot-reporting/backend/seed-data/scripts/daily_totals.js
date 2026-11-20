// Daily totals for a monthly report.
// Usage: db.daily_inventory_entries.aggregate(dailyTotals("monthly-report-2026-10"))
function dailyTotals(reportId) {
  return [
    { $match: { reportId } },
    { $group: {
      _id: "$serviceDate",
      totalQuantity: { $sum: "$quantity" },
      totalAmountLkr: { $sum: "$lineAmountLkr" },
      unpricedQuantity: { $sum: { $cond: [{ $eq: ["$pricingStatus", "missing_rate"] }, "$quantity", 0] } }
    }},
    { $project: {
      _id: 0,
      serviceDate: "$_id",
      totalQuantity: 1,
      totalAmountLkr: { $round: ["$totalAmountLkr", 2] },
      unpricedQuantity: 1
    }},
    { $sort: { serviceDate: 1 } }
  ];
}
