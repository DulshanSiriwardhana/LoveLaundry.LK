/**
 * Decimal-safe money helpers.
 *
 * All arithmetic is performed in integer cents (1 LKR = 100 cents) so that
 * repeated additions and multiplications do not accumulate floating point
 * drift. Documents continue to store LKR amounts rounded to two decimals for
 * MongoDB / Excel compatibility.
 */

export function toCents(amountLkr: number | null | undefined): number {
  if (amountLkr === null || amountLkr === undefined || !Number.isFinite(amountLkr)) return 0;
  return Math.round(amountLkr * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function money(amountLkr: number): number {
  return fromCents(toCents(amountLkr));
}

export function addMoney(...amounts: Array<number | null | undefined>): number {
  return fromCents(amounts.reduce<number>((sum, a) => sum + toCents(a), 0));
}

export function subtractMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function multiplyMoney(quantity: number, unitRateLkr: number | null | undefined): number {
  if (unitRateLkr === null || unitRateLkr === undefined) return 0;
  return fromCents(Math.round(quantity * toCents(unitRateLkr)));
}

export function sumMoney<T>(rows: T[], select: (row: T) => number | null | undefined): number {
  return fromCents(rows.reduce<number>((sum, row) => sum + toCents(select(row)), 0));
}

export function percentOf(amountLkr: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return fromCents(Math.round((toCents(amountLkr) * percent) / 100));
}

export function formatLkr(amountLkr: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountLkr || 0);
}
