import { createHash } from 'crypto';
import { getMonthMeta, MonthMeta } from '../lib/dates';
import { addMoney, multiplyMoney, sumMoney } from '../lib/money';

export interface CalcEntry {
  _id?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  sectionId?: string;
  sectionCode: string;
  sectionName?: string;
  billingCategoryCode: string | null;
  billingCategoryName?: string | null;
  serviceDate: string;
  dayOfMonth: number;
  quantity: number;
  unitOfMeasure?: string;
  unitRateLkr: number | null;
  lineAmountLkr?: number;
  pricingStatus: 'priced' | 'missing_rate' | 'waived';
}

export interface CalcItem {
  _id: string;
  itemCode: string;
  name: string;
  sectionCode: string;
  sectionName?: string;
  billingCategoryCode: string | null;
  billingCategoryName?: string | null;
  sortOrder?: number;
  active?: boolean;
  unitOfMeasure?: string;
  defaultUnitRateLkr?: number | null;
}

export interface CalcSection {
  code: string;
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CalcCategory {
  code: string;
  name: string;
  sortOrder?: number;
  includeOnInvoice?: boolean;
  active?: boolean;
}

export interface DailyTotal {
  serviceDate: string;
  dayOfMonth: number;
  totalQuantity: number;
  totalAmountLkr: number;
  unpricedQuantity: number;
  entryCount: number;
  status: 'complete' | 'incomplete' | 'empty';
}

export interface SectionTotal {
  sectionCode: string;
  sectionName: string;
  totalQuantity: number;
  totalAmountLkr: number;
  unpricedQuantity: number;
  itemCount: number;
}

export interface CategoryTotal {
  billingCategoryCode: string | null;
  billingCategoryName: string;
  sortOrder: number;
  totalQuantity: number;
  totalAmountLkr: number;
  unpricedQuantity: number;
  itemCount: number;
  hasActivity: boolean;
  includeOnInvoice: boolean;
  weightedAverageRateLkr: number | null;
}

export interface ItemTotal {
  itemId: string;
  itemCode: string;
  itemName: string;
  sectionCode: string;
  sectionName: string;
  billingCategoryCode: string | null;
  billingCategoryName: string;
  unitOfMeasure: string;
  totalQuantity: number;
  totalAmountLkr: number;
  unpricedQuantity: number;
  unitRateLkr: number | null;
  weightedAverageRateLkr: number | null;
  hasRateVariance: boolean;
  recordedDays: number;
}

export interface CalculationIssue {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  itemId?: string | null;
  itemCode?: string | null;
  serviceDate?: string | null;
  quantity?: number;
}

export interface MonthlyCalculation {
  monthKey: string;
  totals: {
    totalQuantity: number;
    totalAmountLkr: number;
    unpricedQuantity: number;
    pricedQuantity: number;
    entryCount: number;
    activeDayCount: number;
    recordedDayCount: number;
    incompleteDayCount: number;
  };
  dailyTotals: DailyTotal[];
  sectionTotals: SectionTotal[];
  categoryTotals: CategoryTotal[];
  itemTotals: ItemTotal[];
  issues: CalculationIssue[];
  invoiceReady: boolean;
  blockingIssues: CalculationIssue[];
  warnings: CalculationIssue[];
  checksum: string;
}

export function entryAmountLkr(entry: Pick<CalcEntry, 'quantity' | 'unitRateLkr' | 'pricingStatus'>): number {
  if (entry.pricingStatus === 'waived') return 0;
  if (entry.unitRateLkr === null || entry.unitRateLkr === undefined) return 0;
  return multiplyMoney(entry.quantity, entry.unitRateLkr);
}

function entryCost(entry: CalcEntry): number {
  // The stored line amount is the historical snapshot. Recompute when absent
  // or invalid so imported legacy rows remain usable.
  if (Number.isFinite(entry.lineAmountLkr)) return entry.lineAmountLkr as number;
  return entryAmountLkr(entry);
}

export function isUnpriced(entry: Pick<CalcEntry, 'quantity' | 'unitRateLkr' | 'pricingStatus'>): boolean {
  return entry.quantity > 0 && entry.pricingStatus !== 'waived' && entry.unitRateLkr === null;
}

export function sourceChecksum(entries: CalcEntry[]): string {
  const payload = entries
    .map((e) => `${e._id ?? `${e.itemId}|${e.serviceDate}`}:${e.quantity}:${e.unitRateLkr ?? 'null'}:${e.pricingStatus}`)
    .sort()
    .join(';');
  return createHash('sha256').update(payload).digest('hex');
}

export function calculateMonthly(input: {
  monthKey: string;
  entries: CalcEntry[];
  items: CalcItem[];
  sections: CalcSection[];
  categories: CalcCategory[];
  completedDates?: string[];
  meta?: MonthMeta;
}): MonthlyCalculation {
  const meta = input.meta ?? getMonthMeta(input.monthKey);
  const completed = new Set(input.completedDates ?? []);
  const entries = input.entries;

  // ---- Daily totals -------------------------------------------------------
  const byDate = new Map<string, CalcEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.serviceDate) ?? [];
    list.push(entry);
    byDate.set(entry.serviceDate, list);
  }

  const dailyTotals: DailyTotal[] = meta.dates.map((date) => {
    const dayEntries = byDate.get(date) ?? [];
    const unpriced = dayEntries.filter(isUnpriced).reduce((s, e) => s + e.quantity, 0);
    let status: DailyTotal['status'] = 'empty';
    if (dayEntries.length > 0) {
      status = completed.has(date) && unpriced === 0 ? 'complete' : 'incomplete';
    }
    return {
      serviceDate: date,
      dayOfMonth: Number(date.slice(-2)),
      totalQuantity: dayEntries.reduce((s, e) => s + e.quantity, 0),
      totalAmountLkr: sumMoney(dayEntries, entryCost),
      unpricedQuantity: unpriced,
      entryCount: dayEntries.length,
      status,
    };
  });

  // ---- Item totals --------------------------------------------------------
  const byItem = new Map<string, CalcEntry[]>();
  for (const entry of entries) {
    const list = byItem.get(entry.itemId) ?? [];
    list.push(entry);
    byItem.set(entry.itemId, list);
  }

  const itemTotals: ItemTotal[] = input.items
    .slice()
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.sectionCode.localeCompare(b.sectionCode) ||
        a.itemCode.localeCompare(b.itemCode),
    )
    .map((item) => {
      const itemEntries = byItem.get(item._id) ?? [];
      const totalQuantity = itemEntries.reduce((s, e) => s + e.quantity, 0);
      const totalAmountLkr = sumMoney(itemEntries, entryCost);
      const unpricedQuantity = itemEntries.filter(isUnpriced).reduce((s, e) => s + e.quantity, 0);
      const rates = new Set(
        itemEntries.filter((e) => e.unitRateLkr !== null).map((e) => Number(e.unitRateLkr)),
      );
      const weighted = totalQuantity > 0 ? Number((totalAmountLkr / totalQuantity).toFixed(4)) : null;
      return {
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.name,
        sectionCode: item.sectionCode,
        sectionName: item.sectionName ?? item.sectionCode,
        billingCategoryCode: item.billingCategoryCode,
        billingCategoryName: item.billingCategoryName ?? '',
        unitOfMeasure: item.unitOfMeasure ?? 'piece',
        totalQuantity,
        totalAmountLkr,
        unpricedQuantity,
        unitRateLkr: item.defaultUnitRateLkr ?? null,
        weightedAverageRateLkr: weighted,
        hasRateVariance: rates.size > 1,
        recordedDays: new Set(itemEntries.map((e) => e.serviceDate)).size,
      };
    });

  // ---- Section totals -----------------------------------------------------
  const sectionTotals: SectionTotal[] = input.sections
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((section) => {
      const sectionItems = input.items.filter((i) => i.sectionCode === section.code);
      const sectionEntries = entries.filter((e) => e.sectionCode === section.code);
      return {
        sectionCode: section.code,
        sectionName: section.name,
        totalQuantity: sectionEntries.reduce((s, e) => s + e.quantity, 0),
        totalAmountLkr: sumMoney(sectionEntries, entryCost),
        unpricedQuantity: sectionEntries.filter(isUnpriced).reduce((s, e) => s + e.quantity, 0),
        itemCount: sectionItems.length,
      };
    });

  // Ensure entries from sections that are not in the catalogue still appear.
  const knownSections = new Set(sectionTotals.map((s) => s.sectionCode));
  for (const entry of entries) {
    if (knownSections.has(entry.sectionCode)) continue;
    knownSections.add(entry.sectionCode);
    sectionTotals.push({
      sectionCode: entry.sectionCode,
      sectionName: entry.sectionName ?? entry.sectionCode,
      totalQuantity: entries.filter((e) => e.sectionCode === entry.sectionCode).reduce((s, e) => s + e.quantity, 0),
      totalAmountLkr: sumMoney(
        entries.filter((e) => e.sectionCode === entry.sectionCode),
        entryCost,
      ),
      unpricedQuantity: entries
        .filter((e) => e.sectionCode === entry.sectionCode && isUnpriced(e))
        .reduce((s, e) => s + e.quantity, 0),
      itemCount: input.items.filter((i) => i.sectionCode === entry.sectionCode).length,
    });
  }

  // ---- Billing category totals -------------------------------------------
  const categoryTotals: CategoryTotal[] = input.categories
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((category) => {
      const categoryEntries = entries.filter((e) => e.billingCategoryCode === category.code);
      const totalQuantity = categoryEntries.reduce((s, e) => s + e.quantity, 0);
      const totalAmountLkr = sumMoney(categoryEntries, entryCost);
      return {
        billingCategoryCode: category.code,
        billingCategoryName: category.name,
        sortOrder: category.sortOrder ?? 0,
        totalQuantity,
        totalAmountLkr,
        unpricedQuantity: categoryEntries.filter(isUnpriced).reduce((s, e) => s + e.quantity, 0),
        itemCount: input.items.filter((i) => i.billingCategoryCode === category.code).length,
        hasActivity: totalQuantity > 0,
        includeOnInvoice: category.includeOnInvoice !== false,
        weightedAverageRateLkr:
          totalQuantity > 0 ? Number((totalAmountLkr / totalQuantity).toFixed(4)) : null,
      };
    });

  // Unmapped entries (category not in catalogue) must not disappear.
  const knownCategories = new Set(categoryTotals.map((c) => c.billingCategoryCode));
  for (const entry of entries) {
    if (!entry.billingCategoryCode || knownCategories.has(entry.billingCategoryCode)) continue;
    knownCategories.add(entry.billingCategoryCode);
    const categoryEntries = entries.filter((e) => e.billingCategoryCode === entry.billingCategoryCode);
    const totalQuantity = categoryEntries.reduce((s, e) => s + e.quantity, 0);
    const totalAmountLkr = sumMoney(categoryEntries, entryCost);
    categoryTotals.push({
      billingCategoryCode: entry.billingCategoryCode,
      billingCategoryName: entry.billingCategoryName ?? entry.billingCategoryCode,
      sortOrder: 9999,
      totalQuantity,
      totalAmountLkr,
      unpricedQuantity: categoryEntries.filter(isUnpriced).reduce((s, e) => s + e.quantity, 0),
      itemCount: 0,
      hasActivity: totalQuantity > 0,
      includeOnInvoice: true,
      weightedAverageRateLkr:
        totalQuantity > 0 ? Number((totalAmountLkr / totalQuantity).toFixed(4)) : null,
    });
  }

  // ---- Issues -------------------------------------------------------------
  const issues: CalculationIssue[] = [];
  const pricedQty = entries.filter((e) => !isUnpriced(e)).reduce((s, e) => s + e.quantity, 0);

  const missingRateEntries = entries.filter(isUnpriced);
  if (missingRateEntries.length > 0) {
    const grouped = new Map<string, { itemId: string; itemCode: string; itemName: string; qty: number; dates: string[] }>();
    for (const e of missingRateEntries) {
      const g = grouped.get(e.itemId) ?? {
        itemId: e.itemId,
        itemCode: e.itemCode,
        itemName: e.itemName,
        qty: 0,
        dates: [],
      };
      g.qty += e.quantity;
      g.dates.push(e.serviceDate);
      grouped.set(e.itemId, g);
    }
    for (const g of grouped.values()) {
      issues.push({
        code: 'MISSING_RATE',
        severity: 'blocking',
        message: `${g.itemName} (${g.itemCode}) has ${g.qty} unit(s) with no rate. Assign a rate or mark the quantity waived before invoicing.`,
        itemId: g.itemId,
        itemCode: g.itemCode,
        serviceDate: g.dates.sort()[0],
        quantity: g.qty,
      });
    }
  }

  const missingRateCatalogue = input.items.filter(
    (i) => i.billingCategoryCode === null || i.billingCategoryCode === '',
  );
  for (const item of missingRateCatalogue) {
    issues.push({
      code: 'MISSING_BILLING_CATEGORY',
      severity: 'warning',
      message: `${item.name} (${item.itemCode}) has no billing category. Assign one before it receives a quantity.`,
      itemId: item._id,
      itemCode: item.itemCode,
    });
  }

  for (const entry of entries) {
    if (entry.quantity > 0 && (!entry.billingCategoryCode || entry.billingCategoryCode === '')) {
      issues.push({
        code: 'UNMAPPED_POSITIVE_QUANTITY',
        severity: 'blocking',
        message: `${entry.itemName} has a positive quantity without a billing category.`,
        itemId: entry.itemId,
        itemCode: entry.itemCode,
        serviceDate: entry.serviceDate,
        quantity: entry.quantity,
      });
    }
    const expected = entryAmountLkr(entry);
    if (
      entry.pricingStatus === 'priced' &&
      Number.isFinite(entry.lineAmountLkr) &&
      Math.abs((entry.lineAmountLkr as number) - expected) > 0.009
    ) {
      issues.push({
        code: 'LINE_AMOUNT_MISMATCH',
        severity: 'warning',
        message: `${entry.itemName} on ${entry.serviceDate} stores ${entry.lineAmountLkr} but quantity × rate is ${expected}.`,
        itemId: entry.itemId,
        itemCode: entry.itemCode,
        serviceDate: entry.serviceDate,
      });
    }
  }

  const duplicateKeys = new Set<string>();
  const duplicateSeen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.serviceDate}|${entry.itemId}`;
    if (duplicateSeen.has(key)) duplicateKeys.add(key);
    duplicateSeen.add(key);
  }
  if (duplicateKeys.size > 0) {
    issues.push({
      code: 'DUPLICATE_ENTRIES',
      severity: 'blocking',
      message: `${duplicateKeys.size} duplicate daily item entr${duplicateKeys.size === 1 ? 'y' : 'ies'} detected.`,
    });
  }

  const blockingIssues = issues.filter((i) => i.severity === 'blocking');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totalQuantity = entries.reduce((s, e) => s + e.quantity, 0);
  const totalAmountLkr = sumMoney(entries, entryCost);
  const recordedDayCount = dailyTotals.filter((d) => d.entryCount > 0).length;

  return {
    monthKey: input.monthKey,
    totals: {
      totalQuantity,
      totalAmountLkr,
      unpricedQuantity: missingRateEntries.reduce((s, e) => s + e.quantity, 0),
      pricedQuantity: pricedQty,
      entryCount: entries.length,
      activeDayCount: recordedDayCount,
      recordedDayCount,
      incompleteDayCount: dailyTotals.filter((d) => d.status === 'incomplete').length,
    },
    dailyTotals,
    sectionTotals,
    categoryTotals,
    itemTotals,
    issues,
    invoiceReady: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    checksum: sourceChecksum(entries),
  };
}

/** Weighted average rate is informational only; never use it to recalculate history. */
export function weightedAverageRate(totalAmountLkr: number, totalQuantity: number): number | null {
  if (!totalQuantity) return null;
  return Number(((addMoney(totalAmountLkr) * 100) / totalQuantity / 100).toFixed(4));
}
