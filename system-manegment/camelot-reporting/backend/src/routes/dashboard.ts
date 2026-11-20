import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { currentMonthKey } from '../lib/dates';
import { requireAuth } from '../middleware/auth';
import { monthKeySchema, parseQuery } from '../middleware/validate';
import { InventoryItem } from '../models/InventoryItem';
import { Invoice } from '../models/Invoice';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { ensureMonthlyReport, rebuildSummary } from '../services/reportService';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { month } = parseQuery(
      z.object({ month: monthKeySchema.optional() }),
      req.query,
    );
    const monthKey = month ?? currentMonthKey();
    const report = await ensureMonthlyReport(monthKey);
    const rebuilt = await rebuildSummary(monthKey);
    const calc = rebuilt.calculation;
    const invoices = await Invoice.find({ monthKey }).sort({ createdAt: -1 }).lean();
    const activeInvoice = invoices.find((i) => !['void'].includes(i.status)) ?? null;
    const itemCount = await InventoryItem.countDocuments({ organizationId: report.organizationId, active: true });
    const entriesWithRates = await DailyInventoryEntry.countDocuments({ reportId: report._id });

    const recentDays = calc.dailyTotals
      .filter((d) => d.entryCount > 0)
      .slice(-7)
      .reverse();

    res.json({
      monthKey,
      report: {
        id: report._id,
        name: report.reportName,
        status: report.status,
        invoiceStatus: report.invoiceStatus,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        validation: report.validation,
      },
      totals: {
        totalQuantity: calc.totals.totalQuantity,
        totalAmountLkr: calc.totals.totalAmountLkr,
        unpricedQuantity: calc.totals.unpricedQuantity,
        recordedDays: calc.totals.recordedDayCount,
        incompleteDays: calc.totals.incompleteDayCount,
        daysInMonth: calc.dailyTotals.length,
        activeItems: itemCount,
        entryCount: entriesWithRates,
        invoiceReady: calc.invoiceReady && calc.blockingIssues.length === 0,
      },
      dailySeries: calc.dailyTotals.map((d) => ({
        date: d.serviceDate,
        day: d.dayOfMonth,
        quantity: d.totalQuantity,
        amount: d.totalAmountLkr,
        status: d.status,
      })),
      sectionBreakdown: calc.sectionTotals,
      categoryBreakdown: calc.categoryTotals.filter((c) => c.totalQuantity > 0),
      issues: calc.issues,
      recentDays,
      invoice: activeInvoice
        ? {
            id: activeInvoice._id,
            invoiceNumber: activeInvoice.invoiceNumber,
            status: activeInvoice.status,
            totalLkr: activeInvoice.totals.totalLkr,
          }
        : null,
    });
  }),
);
