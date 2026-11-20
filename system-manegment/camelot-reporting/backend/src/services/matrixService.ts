import { addMoney, multiplyMoney } from '../lib/money';

export interface MatrixEntry {
  itemId: string;
  serviceDate: string;
  dayOfMonth: number;
  quantity: number;
  unitRateLkr: number | null;
  lineAmountLkr: number;
  pricingStatus: string;
  billingCategoryCode: string | null;
  sectionCode: string;
  itemCode: string;
  itemName: string;
  sectionName?: string;
  billingCategoryName?: string;
}

export interface MatrixItem {
  _id: string;
  itemCode: string;
  name: string;
  sectionCode: string;
  sectionName?: string;
  billingCategoryCode: string | null;
  billingCategoryName?: string | null;
  sortOrder: number;
  defaultUnitRateLkr: number | null;
  unitOfMeasure?: string;
  active: boolean;
}

export interface MatrixRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  sectionCode: string;
  sectionName: string;
  billingCategoryCode: string | null;
  billingCategoryName: string;
  unitOfMeasure: string;
  active: boolean;
  days: Array<number | null>;
  quantities: Record<string, number>;
  totalQuantity: number;
  unitRateLkr: number | null;
  weightedAverageRateLkr: number | null;
  hasRateVariance: boolean;
  totalAmountLkr: number;
  unpricedQuantity: number;
  recordedDays: number;
}

/**
 * Build the spreadsheet-style month matrix. `days[index]` is the quantity for
 * day (index + 1). A null means "not entered"; 0 means explicitly confirmed
 * zero. The two are deliberately different.
 */
export function buildMatrixRows(input: {
  monthKey: string;
  entries: MatrixEntry[];
  items: MatrixItem[];
  daysInMonth: number;
}): {
  rows: MatrixRow[];
  totals: {
    totalQuantity: number;
    totalAmountLkr: number;
    unpricedQuantity: number;
    entryCount: number;
  };
} {
  const byItem = new Map<string, MatrixEntry[]>();
  for (const e of input.entries) {
    const list = byItem.get(e.itemId) ?? [];
    list.push(e);
    byItem.set(e.itemId, list);
  }

  const sortedItems = input.items.slice().sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.sectionCode.localeCompare(b.sectionCode) ||
      a.itemCode.localeCompare(b.itemCode),
  );

  const rows: MatrixRow[] = sortedItems.map((item) => {
    const itemEntries = byItem.get(item._id) ?? [];
    const days = Array.from({ length: input.daysInMonth }, () => null as number | null);
    const quantities: Record<string, number> = {};
    for (const entry of itemEntries) {
      if (entry.dayOfMonth >= 1 && entry.dayOfMonth <= input.daysInMonth) {
        days[entry.dayOfMonth - 1] = entry.quantity;
        quantities[entry.serviceDate] = entry.quantity;
      }
    }
    const rates = new Set(itemEntries.filter((e) => e.unitRateLkr !== null).map((e) => Number(e.unitRateLkr)));
    const totalQuantity = itemEntries.reduce((s, e) => s + e.quantity, 0);
    const totalAmountLkr = addMoney(...itemEntries.map((e) => e.lineAmountLkr));
    return {
      itemId: item._id,
      itemCode: item.itemCode,
      itemName: item.name,
      sectionCode: item.sectionCode,
      sectionName: item.sectionName ?? item.sectionCode,
      billingCategoryCode: item.billingCategoryCode,
      billingCategoryName: item.billingCategoryName ?? '',
      unitOfMeasure: item.unitOfMeasure ?? 'piece',
      active: item.active,
      days,
      quantities,
      totalQuantity,
      unitRateLkr: item.defaultUnitRateLkr,
      weightedAverageRateLkr: totalQuantity > 0 ? Number((totalAmountLkr / totalQuantity).toFixed(4)) : null,
      hasRateVariance: rates.size > 1,
      totalAmountLkr,
      unpricedQuantity: itemEntries
        .filter((e) => e.quantity > 0 && e.pricingStatus !== 'waived' && e.unitRateLkr === null)
        .reduce((s, e) => s + e.quantity, 0),
      recordedDays: new Set(itemEntries.map((e) => e.serviceDate)).size,
    };
  });

  return {
    rows,
    totals: {
      totalQuantity: rows.reduce((s, r) => s + r.totalQuantity, 0),
      totalAmountLkr: addMoney(...rows.map((r) => r.totalAmountLkr)),
      unpricedQuantity: rows.reduce((s, r) => s + r.unpricedQuantity, 0),
      entryCount: input.entries.length,
    },
  };
}

export function matrixRowMonthlyAmount(quantity: number, rate: number | null): number {
  return multiplyMoney(quantity, rate);
}
