import { differenceInCalendarDays, parseISO, subDays, format } from 'date-fns';
import { env } from '../config/env';
import { ItemRateHistory, ItemRateHistoryDoc } from '../models/ItemRateHistory';
import { InventoryItem, InventoryItemDoc } from '../models/InventoryItem';
import { badRequest, conflict, notFound } from '../lib/errors';
import { isValidServiceDate } from '../lib/dates';
import { newId } from '../lib/ids';

export interface RateRecord {
  itemId: string;
  unitRateLkr: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * Resolve the rate that applies on a day-only date.
 * The latest rate whose effective window contains the date wins.
 * Falls back to the item's default rate only when no history exists.
 */
export function resolveRateForDate(
  rates: RateRecord[],
  date: string,
  fallbackRate: number | null | undefined,
): { rate: number | null; source: 'rate_history' | 'item_default' | 'none'; record?: RateRecord } {
  const applicable = rates
    .filter(
      (r) =>
        r.effectiveFrom <= date && (r.effectiveTo === null || r.effectiveTo === undefined || r.effectiveTo >= date),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (applicable.length > 0) {
    return { rate: applicable[0].unitRateLkr, source: 'rate_history', record: applicable[0] };
  }
  if (fallbackRate !== null && fallbackRate !== undefined && Number.isFinite(fallbackRate)) {
    return { rate: fallbackRate, source: 'item_default' };
  }
  return { rate: null, source: 'none' };
}

export async function loadRatesForItems(itemIds: string[]): Promise<Map<string, RateRecord[]>> {
  if (itemIds.length === 0) return new Map();
  const rows = await ItemRateHistory.find({ itemId: { $in: itemIds } })
    .sort({ effectiveFrom: 1 })
    .lean();
  const map = new Map<string, RateRecord[]>();
  for (const id of itemIds) map.set(id, []);
  for (const row of rows) {
    const list = map.get(row.itemId) ?? [];
    list.push({
      itemId: row.itemId,
      unitRateLkr: row.unitRateLkr,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo ?? null,
    });
    map.set(row.itemId, list);
  }
  return map;
}

export async function resolveRateForItemDate(
  item: Pick<InventoryItemDoc, '_id' | 'defaultUnitRateLkr'>,
  date: string,
): Promise<{ rate: number | null; source: string }> {
  const rates = await ItemRateHistory.find({ itemId: item._id }).sort({ effectiveFrom: 1 }).lean();
  const resolved = resolveRateForDate(
    rates.map((r) => ({
      itemId: r.itemId,
      unitRateLkr: r.unitRateLkr,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo ?? null,
    })),
    date,
    item.defaultUnitRateLkr,
  );
  return { rate: resolved.rate, source: resolved.source };
}

/**
 * Create an effective-dated rate. Any open-ended earlier rate is closed the
 * day before the new rate, preserving history for prior months.
 */
export async function createRate(input: {
  itemId: string;
  unitRateLkr: number;
  effectiveFrom: string;
  note?: string;
  userId?: string;
}): Promise<ItemRateHistoryDoc> {
  const item = await InventoryItem.findById(input.itemId);
  if (!item) throw notFound('Inventory item not found.');
  if (!isValidServiceDate(input.effectiveFrom)) throw badRequest('effectiveFrom must be a valid YYYY-MM-DD date.');
  if (!Number.isFinite(input.unitRateLkr) || input.unitRateLkr < 0) {
    throw badRequest('Rate must be a non-negative number.');
  }

  const existingSameDate = await ItemRateHistory.findOne({
    itemId: item._id,
    effectiveFrom: input.effectiveFrom,
  });
  if (existingSameDate) {
    throw conflict('A rate already exists for this item and effective date.', {
      rateId: existingSameDate._id,
    });
  }

  const previousOpen = await ItemRateHistory.findOne({
    itemId: item._id,
    effectiveFrom: { $lt: input.effectiveFrom },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: input.effectiveFrom } }],
  }).sort({ effectiveFrom: -1 });

  if (previousOpen) {
    const dayBefore = format(subDays(parseISO(input.effectiveFrom), 1), 'yyyy-MM-dd');
    if (previousOpen.effectiveFrom > dayBefore) {
      throw conflict('The effective date overlaps an existing rate.');
    }
    previousOpen.effectiveTo = dayBefore;
    previousOpen.status = 'superseded';
    previousOpen.updatedAt = new Date();
    await previousOpen.save();
  }

  const created = await ItemRateHistory.create({
    _id: newId('rate'),
    organizationId: env.organisationId,
    itemId: item._id,
    itemCode: item.itemCode,
    unitRateLkr: input.unitRateLkr,
    currency: 'LKR',
    effectiveFrom: input.effectiveFrom,
    effectiveTo: null,
    status: 'active',
    source: input.note ?? 'manual',
    createdBy: input.userId ?? '',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Keep the catalogue default in sync only for rates that are already effective.
  if (input.effectiveFrom <= new Date().toISOString().slice(0, 10)) {
    item.defaultUnitRateLkr = input.unitRateLkr;
    item.rateStatus = 'configured';
    item.updatedAt = new Date();
    await item.save();
  }

  return created;
}

export async function updateFutureRate(
  rateId: string,
  input: { unitRateLkr?: number; effectiveFrom?: string; note?: string },
): Promise<ItemRateHistoryDoc> {
  const rate = await ItemRateHistory.findById(rateId);
  if (!rate) throw notFound('Rate record not found.');
  const today = new Date().toISOString().slice(0, 10);
  if (rate.effectiveFrom <= today) {
    throw conflict(
      'A rate that has already taken effect cannot be edited. Create a new effective-dated rate instead so historical costs stay intact.',
    );
  }
  const nextDate = input.effectiveFrom ?? rate.effectiveFrom;
  if (!isValidServiceDate(nextDate)) throw badRequest('effectiveFrom must be a valid date.');
  if (input.unitRateLkr !== undefined && input.unitRateLkr < 0) throw badRequest('Rate must be non-negative.');

  if (nextDate !== rate.effectiveFrom) {
    const clash = await ItemRateHistory.findOne({ itemId: rate.itemId, effectiveFrom: nextDate, _id: { $ne: rate._id } });
    if (clash) throw conflict('Another rate already exists on that effective date.');
    const previous = await ItemRateHistory.findOne({
      itemId: rate.itemId,
      effectiveFrom: { $lt: nextDate },
      _id: { $ne: rate._id },
    }).sort({ effectiveFrom: -1 });
    if (previous) {
      previous.effectiveTo = format(subDays(parseISO(nextDate), 1), 'yyyy-MM-dd');
      previous.status = 'superseded';
      previous.updatedAt = new Date();
      await previous.save();
    }
    rate.effectiveFrom = nextDate;
  }
  if (input.unitRateLkr !== undefined) rate.unitRateLkr = input.unitRateLkr;
  if (input.note !== undefined) rate.source = input.note;
  rate.updatedAt = new Date();
  await rate.save();
  return rate;
}

export async function deleteFutureRate(rateId: string): Promise<void> {
  const rate = await ItemRateHistory.findById(rateId);
  if (!rate) throw notFound('Rate record not found.');
  const today = new Date().toISOString().slice(0, 10);
  if (rate.effectiveFrom <= today) {
    throw conflict('Historical rates cannot be deleted. Create a new effective-dated rate instead.');
  }
  await rate.deleteOne();
  const previous = await ItemRateHistory.findOne({ itemId: rate.itemId }).sort({ effectiveFrom: -1 });
  if (previous && previous.effectiveTo) {
    previous.effectiveTo = null;
    previous.status = 'active';
    previous.updatedAt = new Date();
    await previous.save();
  }
}

/** Utility used by import and the daily entry screen. */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}
