import { describe, expect, it } from 'vitest';
import { buildMatrixRows, matrixRowMonthlyAmount } from '../src/services/matrixService';
import { addMoney } from '../src/lib/money';

const item = {
  _id: 'item-1',
  itemCode: 'I1',
  name: 'Shirt',
  sectionCode: 'SEC',
  billingCategoryCode: 'CAT',
  sortOrder: 1,
  defaultUnitRateLkr: 10,
  active: true,
};

const entry = (dayOfMonth: number, quantity: number, lineAmountLkr: number) => ({
  itemId: 'item-1',
  serviceDate: `2026-01-${String(dayOfMonth).padStart(2, '0')}`,
  dayOfMonth,
  quantity,
  unitRateLkr: 10,
  lineAmountLkr,
  pricingStatus: 'priced',
  billingCategoryCode: 'CAT',
  sectionCode: 'SEC',
  itemCode: 'I1',
  itemName: 'Shirt',
});

describe('buildMatrixRows', () => {
  it('maps entries to days and keeps an unentered day distinct from an explicit zero', () => {
    const { rows, totals } = buildMatrixRows({
      monthKey: '2026-01',
      daysInMonth: 3,
      items: [item],
      entries: [entry(2, 2, 20), entry(3, 0, 0)],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].days).toEqual([null, 2, 0]);
    expect(rows[0].quantities).toEqual({ '2026-01-02': 2, '2026-01-03': 0 });
    expect(rows[0].totalQuantity).toBe(2);
    expect(rows[0].weightedAverageRateLkr).toBe(10);
    expect(totals.totalQuantity).toBe(2);
    expect(totals.entryCount).toBe(2);
  });

  it('reports unpriced quantity without inventing a rate', () => {
    const { rows } = buildMatrixRows({
      monthKey: '2026-01',
      daysInMonth: 2,
      items: [item],
      entries: [{ ...entry(1, 3, 0), unitRateLkr: null, pricingStatus: 'missing_rate' }],
    });

    expect(rows[0].unpricedQuantity).toBe(3);
    expect(rows[0].weightedAverageRateLkr).toBe(0);
  });
});

describe('money helpers used by the matrix/reports', () => {
  it('adds in integer cents so floating point drift does not leak into totals', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
  });

  it('treats an unpriced row as zero', () => {
    expect(matrixRowMonthlyAmount(3, 12.34)).toBe(37.02);
    expect(matrixRowMonthlyAmount(3, null)).toBe(0);
  });
});
