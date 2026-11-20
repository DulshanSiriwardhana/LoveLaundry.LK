/**
 * Verify the October 2026 reference dataset against the reconciled baseline.
 * Exits non-zero on any mismatch. Run after `npm run seed`.
 */
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { env } from '../config/env';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { MonthlyReport } from '../models/MonthlyReport';
import { calculateMonthly } from '../services/calculationService';
import { loadReportContext, rebuildSummary } from '../services/reportService';
import { addMoney } from '../lib/money';

const EXPECTED = {
  totalQuantity: 7856,
  totalAmountLkr: 381624,
  sections: {
    UNIFORMS: { quantity: 3477, amount: 260255 },
    INTERNAL_ITEMS: { quantity: 224, amount: 4298 },
    BEDDING: { quantity: 0, amount: 0 },
    FNB_LINEN: { quantity: 4155, amount: 117071 },
    PRESSING_ONLY: { quantity: 0, amount: 0 },
  },
  unpricedQuantity: 2,
  entryCount: 806,
};

async function main() {
  await connectDatabase();
  const report = await MonthlyReport.findOne({ monthKey: '2026-10', organizationId: env.organisationId });
  if (!report) throw new Error('October 2026 report not found. Run npm run seed first.');

  // Rebuild first so the comparison uses entries as the source of truth.
  const { calculation } = await rebuildSummary('2026-10');

  const results: Array<{ check: string; pass: boolean; actual: string; expected: string }> = [];
  const check = (name: string, pass: boolean, actual: unknown, expected: unknown) => {
    results.push({ check: name, pass, actual: String(actual), expected: String(expected) });
  };

  check('Total quantity', calculation.totals.totalQuantity === EXPECTED.totalQuantity, calculation.totals.totalQuantity, EXPECTED.totalQuantity);
  check(
    'Total cost LKR',
    Math.abs(calculation.totals.totalAmountLkr - EXPECTED.totalAmountLkr) < 0.005,
    calculation.totals.totalAmountLkr.toFixed(2),
    EXPECTED.totalAmountLkr.toFixed(2),
  );
  check('Entry documents', calculation.totals.entryCount === EXPECTED.entryCount, calculation.totals.entryCount, EXPECTED.entryCount);
  check('Unpriced quantity', calculation.totals.unpricedQuantity === EXPECTED.unpricedQuantity, calculation.totals.unpricedQuantity, EXPECTED.unpricedQuantity);

  for (const [code, expected] of Object.entries(EXPECTED.sections)) {
    const section = calculation.sectionTotals.find((s) => s.sectionCode === code);
    check(
      `${code} quantity`,
      section?.totalQuantity === expected.quantity,
      section?.totalQuantity ?? 'missing',
      expected.quantity,
    );
    check(
      `${code} cost`,
      Math.abs((section?.totalAmountLkr ?? -1) - expected.amount) < 0.005,
      (section?.totalAmountLkr ?? 0).toFixed(2),
      expected.amount.toFixed(2),
    );
  }

  // Daily totals must equal their item entries.
  const entries = await DailyInventoryEntry.find({ reportId: report._id }).lean();
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.serviceDate, (byDate.get(e.serviceDate) ?? 0) + e.quantity);
  const dailyMatch = calculation.dailyTotals.every((d) => (byDate.get(d.serviceDate) ?? 0) === d.totalQuantity);
  check('Daily totals equal item entries', dailyMatch, dailyMatch ? 'all match' : 'mismatch', true);

  // No duplicate daily entries.
  const keys = new Set(entries.map((e) => `${e.serviceDate}|${e.itemId}`));
  check('No duplicate daily item entries', keys.size === entries.length, `${keys.size}/${entries.length}`, 'equal');

  // Line amount = quantity × rate for priced rows.
  const badLines = entries.filter(
    (e) => e.pricingStatus === 'priced' && Math.abs((e.quantity * (e.unitRateLkr ?? 0)) - e.lineAmountLkr) > 0.009,
  );
  check('Quantity × rate equals stored line amount', badLines.length === 0, `${badLines.length} mismatches`, 0);

  // Missing-rate item remains visible.
  const waterBags = entries.filter((e) => e.itemCode === 'FNB_LINEN-15');
  check('Water Bottle Bags entries present', waterBags.length === 2, waterBags.length, 2);
  check(
    'Water Bottle Bags flagged missing rate',
    waterBags.every((e) => e.pricingStatus === 'missing_rate' && e.quantity === 1),
    waterBags.map((e) => `${e.serviceDate}:${e.quantity}:${e.pricingStatus}`).join(','),
    '2 entries, missing_rate',
  );

  // The report must not be invoice-ready while a rate is unresolved.
  check('Invoice readiness blocked by missing rate', calculation.invoiceReady === false, calculation.invoiceReady, false);

  // Historical safety: report totals equal sum of entries, not the seeded summary.
  const context = await loadReportContext('2026-10');
  const recomputed = calculateMonthly({
    monthKey: '2026-10',
    entries: context.entries,
    items: context.items,
    sections: context.sections,
    categories: context.categories,
    completedDates: context.report.completedDates ?? [],
  });
  check(
    'Report totals equal fresh calculation',
    recomputed.totals.totalQuantity === calculation.totals.totalQuantity &&
      Math.abs(recomputed.totals.totalAmountLkr - calculation.totals.totalAmountLkr) < 0.005,
    `${recomputed.totals.totalQuantity}/${recomputed.totals.totalAmountLkr.toFixed(2)}`,
    `${calculation.totals.totalQuantity}/${calculation.totals.totalAmountLkr.toFixed(2)}`,
  );

  const width = Math.max(...results.map((r) => r.check.length));
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check.padEnd(width)}  actual=${r.actual}  expected=${r.expected}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log('');
  console.log(
    failed.length === 0
      ? `All ${results.length} October 2026 checks passed. Unpriced quantity: ${addMoney(calculation.totals.unpricedQuantity)}.`
      : `${failed.length} of ${results.length} checks FAILED.`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
