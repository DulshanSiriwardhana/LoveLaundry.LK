import { env } from '../config/env';
import { getMonthMeta, isValidMonthKey, monthLabel } from '../lib/dates';
import { badRequest, notFound, unprocessable } from '../lib/errors';
import { Customer, CustomerDoc } from '../models/Customer';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { InventoryItem } from '../models/InventoryItem';
import { InventorySection } from '../models/InventorySection';
import { BillingCategory } from '../models/BillingCategory';
import { MonthlyReport, MonthlyReportDoc } from '../models/MonthlyReport';
import { MonthlyReportSummary } from '../models/MonthlyReportSummary';
import { AppSettings, SETTINGS_ID } from '../models/AppSettings';
import {
  CalcCategory,
  CalcEntry,
  CalcItem,
  CalcSection,
  MonthlyCalculation,
  calculateMonthly,
} from './calculationService';
import { writeAudit, AuditActor } from './auditService';

export interface ReportContext {
  report: MonthlyReportDoc;
  entries: CalcEntry[];
  items: CalcItem[];
  sections: CalcSection[];
  categories: CalcCategory[];
  calculation: MonthlyCalculation;
}

const DEFAULT_CUSTOMER: {
  name: string;
  city: string;
  country: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
} = {
  name: 'Camelot Beach Hotel',
  city: 'Negombo',
  country: 'Sri Lanka',
};

export async function ensureCustomer(): Promise<CustomerDoc> {
  let customer = await Customer.findById(env.customerId);
  if (customer) return customer;
  const settings = await AppSettings.findById(SETTINGS_ID).lean();
  const details = settings?.customer ?? DEFAULT_CUSTOMER;
  customer = await Customer.create({
    _id: env.customerId,
    organizationId: env.organisationId,
    customerCode: 'CAMELOT',
    name: details.name || DEFAULT_CUSTOMER.name,
    address: details.address ?? '',
    city: details.city || DEFAULT_CUSTOMER.city,
    country: details.country || DEFAULT_CUSTOMER.country,
    contactPerson: details.contactPerson ?? '',
    phone: details.phone ?? '',
    email: details.email ?? '',
    taxNumber: details.taxNumber ?? '',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return customer;
}

export async function ensureMonthlyReport(
  monthKey: string,
  actor?: AuditActor,
): Promise<MonthlyReportDoc> {
  if (!isValidMonthKey(monthKey)) throw badRequest('Month must be in YYYY-MM format.');
  const meta = getMonthMeta(monthKey);
  const customer = await ensureCustomer();
  let report = await MonthlyReport.findOne({ organizationId: env.organisationId, monthKey });
  if (!report) {
    report = await MonthlyReport.create({
      _id: `monthly-report-${monthKey}`,
      organizationId: env.organisationId,
      customerId: customer._id,
      customerName: customer.name,
      reportName: `${monthLabel(monthKey)} Inventory Report`,
      reportType: 'monthly_inventory',
      monthKey,
      year: meta.year,
      month: meta.month,
      periodStart: meta.periodStart,
      periodEnd: meta.periodEnd,
      timezone: env.timezone,
      currency: env.currency,
      status: 'draft',
      invoiceStatus: 'not_generated',
      source: { type: 'application', quantitySourceOfTruth: 'item_level_daily_entries' },
      totals: {},
      validation: { invoiceReady: false, blockingIssues: [] },
      completedDates: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await writeAudit({
      actor,
      action: 'REPORT_CREATED',
      entityType: 'monthly_report',
      entityId: report._id,
      description: `Created monthly report for ${monthKey}.`,
    });
  } else if (!report.customerId) {
    report.customerId = customer._id;
    report.customerName = customer.name;
    report.updatedAt = new Date();
    await report.save();
  }
  return report;
}

export async function loadReportContext(monthKey: string): Promise<ReportContext> {
  const report = await ensureMonthlyReport(monthKey);
  const entriesRaw = await DailyInventoryEntry.find({ reportId: report._id }).sort({ serviceDate: 1, itemId: 1 }).lean();
  const entryItemIds = new Set(entriesRaw.map((e) => e.itemId));
  const itemDocs = await InventoryItem.find({
    organizationId: env.organisationId,
    $or: [{ active: true }, { _id: { $in: [...entryItemIds] } }],
  })
    .sort({ sortOrder: 1, itemCode: 1 })
    .lean();
  const sectionDocs = await InventorySection.find({ organizationId: env.organisationId }).sort({ sortOrder: 1 }).lean();
  const categoryDocs = await BillingCategory.find({ organizationId: env.organisationId })
    .sort({ sortOrder: 1 })
    .lean();

  const entries: CalcEntry[] = entriesRaw.map((e) => ({
    _id: e._id,
    itemId: e.itemId,
    itemCode: e.itemCode,
    itemName: e.itemName,
    sectionId: e.sectionId,
    sectionCode: e.sectionCode,
    sectionName: e.sectionName,
    billingCategoryCode: e.billingCategoryCode ?? null,
    billingCategoryName: e.billingCategoryName ?? '',
    serviceDate: e.serviceDate,
    dayOfMonth: e.dayOfMonth,
    quantity: e.quantity,
    unitOfMeasure: e.unitOfMeasure,
    unitRateLkr: e.unitRateLkr ?? null,
    lineAmountLkr: e.lineAmountLkr,
    pricingStatus: (e.pricingStatus as CalcEntry['pricingStatus']) ?? 'priced',
  }));

  const items: CalcItem[] = itemDocs.map((i) => ({
    _id: i._id,
    itemCode: i.itemCode,
    name: i.name,
    sectionCode: i.sectionCode,
    sectionName: i.sectionName,
    billingCategoryCode: i.billingCategoryCode ?? null,
    billingCategoryName: i.billingCategoryName,
    sortOrder: i.sortOrder,
    active: i.active,
    unitOfMeasure: i.unitOfMeasure,
    defaultUnitRateLkr: i.defaultUnitRateLkr ?? null,
  }));

  const sections: CalcSection[] = sectionDocs.map((s) => ({
    code: s.code,
    name: s.name,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));

  const categories: CalcCategory[] = categoryDocs.map((c) => ({
    code: c.code,
    name: c.name,
    sortOrder: c.sortOrder,
    includeOnInvoice: c.includeOnInvoice,
    active: c.active,
  }));

  const calculation = calculateMonthly({
    monthKey,
    entries,
    items,
    sections,
    categories,
    completedDates: report.completedDates ?? [],
    meta: getMonthMeta(monthKey),
  });

  return { report, entries, items, sections, categories, calculation };
}

export async function rebuildSummary(monthKey: string, actor?: AuditActor) {
  const context = await loadReportContext(monthKey);
  const { report, calculation } = context;
  const customer = await ensureCustomer();

  const blockingIssues = [...calculation.blockingIssues];
  if (!report.customerId && !customer._id) {
    blockingIssues.push({
      code: 'CUSTOMER_REQUIRED',
      severity: 'blocking',
      message: 'Assign the Camelot Beach Hotel customer before generating an invoice.',
    });
  }
  const invoiceReady = blockingIssues.length === 0 && report.status !== 'closed';

  const summaryId = report._id.replace('monthly-report-', 'monthly-summary-');
  const summaryPayload = {
    organizationId: env.organisationId,
    reportId: report._id,
    monthKey,
    currency: report.currency ?? 'LKR',
    totalQuantity: calculation.totals.totalQuantity,
    totalAmountLkr: calculation.totals.totalAmountLkr,
    unpricedQuantity: calculation.totals.unpricedQuantity,
    pricedQuantity: calculation.totals.pricedQuantity,
    entryCount: calculation.totals.entryCount,
    activeDayCount: calculation.totals.activeDayCount,
    dailyTotals: calculation.dailyTotals,
    sectionTotals: calculation.sectionTotals,
    billingCategoryTotals: calculation.categoryTotals,
    itemTotals: calculation.itemTotals,
    generatedAt: new Date(),
    sourceEntryCount: calculation.totals.entryCount,
    sourceChecksum: calculation.checksum,
    updatedAt: new Date(),
  };

  await MonthlyReportSummary.findOneAndUpdate(
    { reportId: report._id },
    { $set: summaryPayload, $setOnInsert: { _id: summaryId, createdAt: new Date() } },
    { upsert: true, new: true },
  );

  report.totals = {
    totalQuantity: calculation.totals.totalQuantity,
    totalAmountLkr: calculation.totals.totalAmountLkr,
    unpricedQuantity: calculation.totals.unpricedQuantity,
    pricedQuantity: calculation.totals.pricedQuantity,
    entryCount: calculation.totals.entryCount,
    activeDayCount: calculation.totals.activeDayCount,
  } as MonthlyReportDoc['totals'];
  report.validation = {
    itemQuantitiesReconciled: true,
    sectionTotalsReconciled: true,
    billingCategoryTotalsReconciled: true,
    formulaErrors: 0,
    invoiceReady,
    blockingIssues,
    warnings: calculation.warnings,
    unmappedPositiveQuantity: calculation.issues
      .filter((i) => i.code === 'UNMAPPED_POSITIVE_QUANTITY')
      .reduce((s, i) => s + (i.quantity ?? 0), 0),
    recordedDays: calculation.totals.recordedDayCount,
    incompleteDays: calculation.totals.incompleteDayCount,
    checksum: calculation.checksum,
    recalculatedAt: new Date().toISOString(),
  };
  report.updatedAt = new Date();
  await report.save();

  if (report.invoiceStatus === 'not_generated' && invoiceReady) {
    // readiness is informational; invoice generation remains an explicit action.
  }

  return { report, summary: summaryPayload, calculation, context };
}

export async function getSummary(monthKey: string) {
  const report = await ensureMonthlyReport(monthKey);
  let summary = await MonthlyReportSummary.findOne({ reportId: report._id }).lean();
  if (!summary) {
    const rebuilt = await rebuildSummary(monthKey);
    summary = await MonthlyReportSummary.findOne({ reportId: report._id }).lean();
    return { report: rebuilt.report, summary };
  }
  return { report, summary };
}

export function assertInvoiceReady(calculation: MonthlyCalculation, report: MonthlyReportDoc): void {
  const issues = [...calculation.blockingIssues];
  if (!report.customerId) {
    issues.push({ code: 'CUSTOMER_REQUIRED', severity: 'blocking', message: 'A customer is required.' });
  }
  if (report.status === 'closed') {
    issues.push({ code: 'REPORT_CLOSED', severity: 'blocking', message: 'The monthly report is closed.' });
  }
  if (issues.length > 0) {
    throw unprocessable(
      'The monthly report is not invoice-ready. Resolve the blocking issues first.',
      issues.map((i) => ({
        code: i.code,
        message: i.message,
        itemId: i.itemId ?? null,
        serviceDate: i.serviceDate ?? null,
      })),
    );
  }
}

export async function setDayCompletion(
  monthKey: string,
  serviceDate: string,
  completed: boolean,
  actor?: AuditActor,
) {
  const report = await ensureMonthlyReport(monthKey);
  if (!serviceDate.startsWith(`${monthKey}-`)) throw badRequest('The date is not inside the selected month.');
  const set = new Set(report.completedDates ?? []);
  if (completed) set.add(serviceDate);
  else set.delete(serviceDate);
  report.completedDates = [...set].sort();
  report.updatedAt = new Date();
  await report.save();
  await rebuildSummary(monthKey, actor);
  await writeAudit({
    actor,
    action: completed ? 'DAY_MARKED_COMPLETE' : 'DAY_MARKED_INCOMPLETE',
    entityType: 'monthly_report',
    entityId: report._id,
    description: `${completed ? 'Marked' : 'Reopened'} ${serviceDate}.`,
  });
  return report;
}

export async function listReportMonths() {
  const reports = await MonthlyReport.find({ organizationId: env.organisationId })
    .sort({ monthKey: -1 })
    .lean();
  return reports;
}

export async function requireReport(monthKey: string): Promise<MonthlyReportDoc> {
  const report = await MonthlyReport.findOne({ organizationId: env.organisationId, monthKey });
  if (!report) throw notFound(`No monthly report exists for ${monthKey}.`);
  return report;
}

export async function resolveSettings() {
  let settings = await AppSettings.findById(SETTINGS_ID);
  if (!settings) {
    settings = await AppSettings.create({
      _id: SETTINGS_ID,
      organizationId: env.organisationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return settings;
}
