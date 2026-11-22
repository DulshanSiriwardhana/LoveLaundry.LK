import { env } from '../config/env';
import { dateBelongsToMonth, dayOfMonth, getMonthMeta, isValidServiceDate, nextDate, previousDate } from '../lib/dates';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { addMoney } from '../lib/money';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { InventoryItem } from '../models/InventoryItem';
import { Invoice } from '../models/Invoice';
import { MonthlyReport } from '../models/MonthlyReport';
import { loadRatesForItems, resolveRateForDate } from './rateService';
import { AuditActor, writeAudit } from './auditService';
import { buildMatrixRows } from './matrixService';
import { ensureMonthlyReport, rebuildSummary } from './reportService';

export interface EntryInput {
  itemId: string;
  quantity: number | null;
}

async function assertMonthEditable(monthKey: string): Promise<void> {
  const locked = await Invoice.findOne({
    monthKey,
    status: { $in: ['finalized', 'paid'] },
  }).lean();
  if (locked) {
    // Corrections are allowed only while an explicit revision draft is open.
    // The finalized invoice itself remains immutable.
    const revisionDraft = await Invoice.exists({
      monthKey,
      status: { $in: ['draft', 'reviewed'] },
      parentInvoiceId: { $ne: null },
    });
    if (!revisionDraft) {
      throw conflict(
        `A finalized invoice (${locked.invoiceNumber}) exists for ${monthKey}. Historical inventory is locked. Create an invoice revision to make corrections.`,
        { invoiceId: locked._id, invoiceNumber: locked.invoiceNumber, code: 'INVOICE_LOCKED' },
      );
    }
  }
  const report = await MonthlyReport.findOne({ organizationId: env.organisationId, monthKey }).lean();
  if (report?.status === 'closed') {
    throw conflict('This monthly report is closed and cannot be edited.');
  }
}

export async function getDayEntry(monthKey: string, date: string) {
  if (!isValidServiceDate(date)) throw badRequest('Date must be a valid YYYY-MM-DD value.');
  if (!dateBelongsToMonth(date, monthKey)) throw badRequest('Date must be inside the selected month.');
  const report = await ensureMonthlyReport(monthKey);
  const meta = getMonthMeta(monthKey);

  const items = await InventoryItem.find({
    organizationId: env.organisationId,
    $or: [{ active: true }],
  })
    .sort({ sortOrder: 1, itemCode: 1 })
    .lean();

  const entries = await DailyInventoryEntry.find({ reportId: report._id, serviceDate: date }).lean();
  const entryMap = new Map(entries.map((e) => [e.itemId, e]));
  const rates = await loadRatesForItems(items.map((i) => i._id));
  const sections = await import('../models/InventorySection').then(({ InventorySection }) =>
    InventorySection.find({ organizationId: env.organisationId, isActive: true }).sort({ sortOrder: 1 }).lean(),
  );

  const rows = items.map((item) => {
    const entry = entryMap.get(item._id);
    const resolved = resolveRateForDate(rates.get(item._id) ?? [], date, item.defaultUnitRateLkr);
    return {
      itemId: item._id,
      itemCode: item.itemCode,
      itemName: item.name,
      sectionCode: item.sectionCode,
      sectionName: item.sectionName,
      billingCategoryCode: item.billingCategoryCode,
      billingCategoryName: item.billingCategoryName,
      unitOfMeasure: item.unitOfMeasure,
      sortOrder: item.sortOrder,
      active: item.active,
      quantity: entry ? entry.quantity : null,
      entered: Boolean(entry),
      unitRateLkr: entry ? entry.unitRateLkr : resolved.rate,
      rateSource: resolved.source,
      lineAmountLkr: entry ? entry.lineAmountLkr : 0,
      pricingStatus: entry ? entry.pricingStatus : resolved.rate === null ? 'missing_rate' : 'priced',
      entryId: entry?._id ?? null,
    };
  });

  const totals = {
    totalQuantity: rows.reduce((s, r) => s + (r.quantity ?? 0), 0),
    totalAmountLkr: addMoney(...rows.map((r) => r.lineAmountLkr)),
    unpricedQuantity: rows
      .filter((r) => (r.quantity ?? 0) > 0 && r.unitRateLkr === null)
      .reduce((s, r) => s + (r.quantity ?? 0), 0),
    enteredItemCount: rows.filter((r) => r.entered).length,
    pendingItemCount: rows.filter((r) => !r.entered).length,
  };

  const index = meta.dates.indexOf(date);
  return {
    monthKey,
    date,
    dayOfMonth: dayOfMonth(date),
    daysInMonth: meta.daysInMonth,
    previousDate: index > 0 ? meta.dates[index - 1] : null,
    nextDate: index >= 0 && index < meta.dates.length - 1 ? meta.dates[index + 1] : null,
    completed: (report.completedDates ?? []).includes(date),
    lockedByInvoice: await Invoice.exists({ monthKey, status: { $in: ['finalized', 'paid'] } }).then(Boolean),
    sections: sections.map((s) => ({ code: s.code, name: s.name, sortOrder: s.sortOrder })),
    rows,
    totals,
  };
}

export async function saveDayEntries(
  monthKey: string,
  date: string,
  entries: EntryInput[],
  actor?: AuditActor,
) {
  if (!isValidServiceDate(date)) throw badRequest('Date must be a valid YYYY-MM-DD value.');
  if (!dateBelongsToMonth(date, monthKey)) throw badRequest('Date must be inside the selected month.');
  await assertMonthEditable(monthKey);
  const report = await ensureMonthlyReport(monthKey, actor);

  const seen = new Set<string>();
  for (const entry of entries) {
    if (!entry.itemId) throw badRequest('Every entry requires an itemId.');
    if (seen.has(entry.itemId)) throw badRequest(`Duplicate item in request: ${entry.itemId}`);
    seen.add(entry.itemId);
    if (entry.quantity !== null) {
      if (!Number.isInteger(entry.quantity)) throw badRequest('Quantities must be whole numbers.');
      if (entry.quantity < 0) throw badRequest('Quantities cannot be negative.');
      if (entry.quantity > 1_000_000) throw badRequest('Quantity is unrealistically large.');
    }
  }

  const items = await InventoryItem.find({ _id: { $in: [...seen] }, organizationId: env.organisationId }).lean();
  const itemMap = new Map(items.map((i) => [i._id, i]));
  const missing = [...seen].filter((id) => !itemMap.has(id));
  if (missing.length > 0) throw badRequest(`Unknown inventory item(s): ${missing.join(', ')}`);

  const rates = await loadRatesForItems([...seen]);
  const existing = await DailyInventoryEntry.find({ reportId: report._id, serviceDate: date }).lean();
  const existingMap = new Map(existing.map((e) => [e.itemId, e]));
  const now = new Date();
  const day = dayOfMonth(date);
  const auditChanges: Array<Record<string, unknown>> = [];

  for (const input of entries) {
    const item = itemMap.get(input.itemId)!;
    const current = existingMap.get(input.itemId);

    if (input.quantity === null) {
      if (current) {
        await DailyInventoryEntry.deleteOne({ _id: current._id });
        auditChanges.push({ itemId: item._id, itemCode: item.itemCode, from: current.quantity, to: null });
      }
      continue;
    }

    const resolved = resolveRateForDate(rates.get(item._id) ?? [], date, item.defaultUnitRateLkr);
    const rate = resolved.rate;
    const amount = rate === null ? 0 : Number((input.quantity * rate).toFixed(2));
    const pricingStatus = rate === null ? 'missing_rate' : 'priced';

    await DailyInventoryEntry.findOneAndUpdate(
      { reportId: report._id, serviceDate: date, itemId: item._id },
      {
        $set: {
          organizationId: env.organisationId,
          reportId: report._id,
          customerId: report.customerId ?? null,
          sectionId: item.sectionId,
          sectionCode: item.sectionCode,
          sectionName: item.sectionName,
          itemId: item._id,
          itemCode: item.itemCode,
          itemName: item.name,
          billingCategoryCode: item.billingCategoryCode,
          billingCategoryName: item.billingCategoryName,
          serviceDate: date,
          dayOfMonth: day,
          quantity: input.quantity,
          unitOfMeasure: item.unitOfMeasure,
          unitRateLkr: rate,
          lineAmountLkr: amount,
          pricingStatus,
          entrySource: 'manual',
          updatedBy: actor?.id ?? '',
          updatedAt: now,
        },
        $setOnInsert: {
          _id: newId('entry'),
          createdBy: actor?.id ?? '',
          createdAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (current && current.quantity !== input.quantity) {
      auditChanges.push({ itemId: item._id, itemCode: item.itemCode, from: current.quantity, to: input.quantity });
    }
  }

  await rebuildSummary(monthKey, actor);
  await writeAudit({
    actor,
    action: 'DAILY_ENTRIES_SAVED',
    entityType: 'daily_inventory',
    entityId: `${report._id}:${date}`,
    description: `Saved ${entries.length} item(s) for ${date}.`,
    changes: { date, changes: auditChanges.slice(0, 200) },
  });

  return getDayEntry(monthKey, date);
}

export async function copyDay(
  monthKey: string,
  fromDate: string,
  toDate: string,
  options: { overwrite?: boolean; itemIds?: string[] } = {},
  actor?: AuditActor,
) {
  if (!isValidServiceDate(fromDate) || !isValidServiceDate(toDate)) throw badRequest('Dates must be valid.');
  if (!dateBelongsToMonth(fromDate, monthKey) || !dateBelongsToMonth(toDate, monthKey)) {
    throw badRequest('Both dates must be inside the selected month.');
  }
  if (fromDate === toDate) throw badRequest('Choose a different source and target date.');
  await assertMonthEditable(monthKey);
  const report = await ensureMonthlyReport(monthKey, actor);
  const source = await DailyInventoryEntry.find({ reportId: report._id, serviceDate: fromDate }).lean();
  if (source.length === 0) throw notFound(`No entries exist on ${fromDate}.`);
  const filterItems = options.itemIds?.length ? new Set(options.itemIds) : null;
  const targetExisting = await DailyInventoryEntry.find({ reportId: report._id, serviceDate: toDate }).lean();
  const targetMap = new Set(targetExisting.map((e) => e.itemId));

  const toCopy = source.filter((e) => !filterItems || filterItems.has(e.itemId));
  const skipped = toCopy.filter((e) => targetMap.has(e.itemId) && !options.overwrite);
  const toWrite = toCopy.filter((e) => options.overwrite || !targetMap.has(e.itemId));

  if (toWrite.length > 0) {
    await saveDayEntries(
      monthKey,
      toDate,
      toWrite.map((e) => ({ itemId: e.itemId, quantity: e.quantity })),
      actor,
    );
  }
  await writeAudit({
    actor,
    action: 'DAY_COPIED',
    entityType: 'daily_inventory',
    entityId: `${report._id}:${toDate}`,
    description: `Copied ${toWrite.length} item(s) from ${fromDate} to ${toDate}.`,
    changes: { fromDate, toDate, copied: toWrite.length, skipped: skipped.length },
  });
  return { copied: toWrite.length, skipped: skipped.length, target: await getDayEntry(monthKey, toDate) };
}

export async function getMatrix(monthKey: string) {
  const report = await ensureMonthlyReport(monthKey);
  const meta = getMonthMeta(monthKey);
  const entries = await DailyInventoryEntry.find({ reportId: report._id }).lean();
  const items = await InventoryItem.find({
    organizationId: env.organisationId,
  })
    .sort({ sortOrder: 1, itemCode: 1 })
    .lean();
  const entryItemIds = new Set(entries.map((e) => e.itemId));
  const relevantItems = items.filter((i) => i.active || entryItemIds.has(i._id));
  const { rows, totals } = buildMatrixRows({
    monthKey,
    entries: entries.map((e) => ({
      itemId: e.itemId,
      serviceDate: e.serviceDate,
      dayOfMonth: e.dayOfMonth,
      quantity: e.quantity,
      unitRateLkr: e.unitRateLkr ?? null,
      lineAmountLkr: e.lineAmountLkr,
      pricingStatus: e.pricingStatus,
      billingCategoryCode: e.billingCategoryCode ?? null,
      sectionCode: e.sectionCode,
      itemCode: e.itemCode,
      itemName: e.itemName,
      sectionName: e.sectionName,
      billingCategoryName: e.billingCategoryName ?? undefined,
    })),
    items: relevantItems.map((item) => ({
      ...item,
      billingCategoryCode: item.billingCategoryCode ?? null,
      defaultUnitRateLkr: item.defaultUnitRateLkr ?? null,
    })),
    daysInMonth: meta.daysInMonth,
  });
  const rebuilt = await rebuildSummary(monthKey);
  return {
    monthKey,
    days: meta.dates,
    daysInMonth: meta.daysInMonth,
    completedDates: report.completedDates ?? [],
    rows,
    totals,
    dailyTotals: rebuilt.calculation.dailyTotals,
    sectionTotals: rebuilt.calculation.sectionTotals,
    categoryTotals: rebuilt.calculation.categoryTotals,
    validation: rebuilt.report.validation,
  };
}

export async function deleteDay(monthKey: string, date: string, actor?: AuditActor) {
  await assertMonthEditable(monthKey);
  const report = await ensureMonthlyReport(monthKey, actor);
  const result = await DailyInventoryEntry.deleteMany({ reportId: report._id, serviceDate: date });
  await rebuildSummary(monthKey, actor);
  await writeAudit({
    actor,
    action: 'DAY_ENTRIES_DELETED',
    entityType: 'daily_inventory',
    entityId: `${report._id}:${date}`,
    description: `Deleted ${result.deletedCount} entries on ${date}.`,
  });
  return { deleted: result.deletedCount };
}

export { nextDate, previousDate };
