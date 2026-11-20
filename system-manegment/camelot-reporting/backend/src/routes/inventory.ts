import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { asyncHandler } from '../lib/asyncHandler';
import { getMonthMeta, isValidMonthKey, monthLabel } from '../lib/dates';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newId, slugify } from '../lib/ids';
import { toCents } from '../lib/money';
import { requireAuth, requireRole } from '../middleware/auth';
import { monthKeySchema, parseBody, parseQuery, serviceDateSchema } from '../middleware/validate';
import { BillingCategory } from '../models/BillingCategory';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { InventoryItem } from '../models/InventoryItem';
import { InventorySection } from '../models/InventorySection';
import { ItemRateHistory } from '../models/ItemRateHistory';
import { writeAudit } from '../services/auditService';
import {
  createRate,
  deleteFutureRate,
  loadRatesForItems,
  resolveRateForDate,
  updateFutureRate,
} from '../services/rateService';
import { rebuildSummary } from '../services/reportService';

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

inventoryRouter.get(
  '/sections',
  asyncHandler(async (_req, res) => {
    const sections = await InventorySection.find({ organizationId: env.organisationId })
      .sort({ sortOrder: 1 })
      .lean();
    res.json({ sections });
  }),
);

const sectionSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_ -]+$/),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

inventoryRouter.post(
  '/sections',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(sectionSchema, req.body);
    const code = body.code.toUpperCase().replace(/\s+/g, '_');
    const exists = await InventorySection.findOne({ organizationId: env.organisationId, code });
    if (exists) throw conflict('A section with this code already exists.');
    const section = await InventorySection.create({
      _id: `section-${slugify(code)}`,
      organizationId: env.organisationId,
      code,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
      isActive: body.isActive ?? true,
      createdFrom: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await writeAudit({
      req,
      action: 'SECTION_CREATED',
      entityType: 'inventory_section',
      entityId: section._id,
      description: `Created section ${section.name}.`,
    });
    res.status(201).json({ section });
  }),
);

inventoryRouter.patch(
  '/sections/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(sectionSchema.partial(), req.body);
    const section = await InventorySection.findById(req.params.id);
    if (!section) throw notFound('Section not found.');
    if (body.code && body.code.toUpperCase().replace(/\s+/g, '_') !== section.code) {
      const code = body.code.toUpperCase().replace(/\s+/g, '_');
      const clash = await InventorySection.findOne({ organizationId: env.organisationId, code, _id: { $ne: section._id } });
      if (clash) throw conflict('Another section already uses this code.');
      // Keep denormalised item/entry labels consistent.
      await InventoryItem.updateMany({ sectionId: section._id }, { $set: { sectionCode: code } });
      await DailyInventoryEntry.updateMany({ sectionId: section._id }, { $set: { sectionCode: code } });
      section.code = code;
    }
    if (body.name !== undefined) {
      section.name = body.name;
      await InventoryItem.updateMany({ sectionId: section._id }, { $set: { sectionName: body.name } });
    }
    if (body.sortOrder !== undefined) section.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) section.isActive = body.isActive;
    section.updatedAt = new Date();
    await section.save();
    await writeAudit({
      req,
      action: 'SECTION_UPDATED',
      entityType: 'inventory_section',
      entityId: section._id,
      description: `Updated section ${section.name}.`,
      changes: body,
    });
    res.json({ section });
  }),
);

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

inventoryRouter.get(
  '/items',
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      z.object({
        section: z.string().optional(),
        search: z.string().optional(),
        active: z.enum(['true', 'false', 'all']).optional(),
        missingRate: z.enum(['true', 'false']).optional(),
      }),
      req.query,
    );
    const filter: Record<string, unknown> = { organizationId: env.organisationId };
    if (query.section) filter.sectionCode = query.section.toUpperCase();
    if (query.active !== 'all') filter.active = query.active === 'true';
    if (query.missingRate === 'true') filter.rateStatus = 'missing_rate';
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { itemCode: rx }, { billingCategoryName: rx }];
    }
    const items = await InventoryItem.find(filter).sort({ sectionCode: 1, sortOrder: 1 }).lean();
    res.json({ items });
  }),
);

inventoryRouter.get(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await InventoryItem.findById(req.params.id).lean();
    if (!item) throw notFound('Inventory item not found.');
    const rates = await ItemRateHistory.find({ itemId: item._id }).sort({ effectiveFrom: -1 }).lean();
    res.json({ item, rates });
  }),
);

const itemCreateSchema = z.object({
  sectionCode: z.string().trim().min(1),
  name: z.string().trim().min(2).max(160),
  itemCode: z.string().trim().max(40).optional(),
  unitOfMeasure: z.string().trim().min(1).max(20).default('piece'),
  defaultUnitRateLkr: z.number().min(0).max(1_000_000).nullable().optional(),
  billingCategoryCode: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
  effectiveFrom: serviceDateSchema.optional(),
});

async function nextItemCode(sectionCode: string): Promise<string> {
  const items = await InventoryItem.find({
    organizationId: env.organisationId,
    sectionCode,
  })
    .select({ itemCode: 1, itemNo: 1 })
    .lean();
  let max = 0;
  for (const item of items) {
    const match = item.itemCode.match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
    if (item.itemNo) max = Math.max(max, item.itemNo);
  }
  return `${sectionCode}-${String(max + 1).padStart(2, '0')}`;
}

inventoryRouter.post(
  '/items',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(itemCreateSchema, req.body);
    const section = await InventorySection.findOne({
      organizationId: env.organisationId,
      code: body.sectionCode.toUpperCase(),
    });
    if (!section) throw badRequest('The selected inventory section does not exist.');

    let categoryName: string | null = null;
    if (body.billingCategoryCode) {
      const category = await BillingCategory.findOne({
        organizationId: env.organisationId,
        code: body.billingCategoryCode.toUpperCase(),
      });
      if (!category) throw badRequest('The selected billing category does not exist.');
      categoryName = category.name;
    }

    const itemCode = (body.itemCode || (await nextItemCode(section.code))).toUpperCase().trim();
    const exists = await InventoryItem.findOne({ organizationId: env.organisationId, itemCode });
    if (exists) throw conflict('An item with this code already exists.');

    const rate = body.defaultUnitRateLkr ?? null;
    const itemNoMatch = itemCode.match(/(\d+)$/);
    const item = await InventoryItem.create({
      _id: `item-${slugify(`${section.code}-${itemCode}`)}-${Date.now().toString(36)}`,
      organizationId: env.organisationId,
      sectionId: section._id,
      sectionCode: section.code,
      sectionName: section.name,
      itemCode,
      itemNo: itemNoMatch ? Number(itemNoMatch[1]) : 0,
      name: body.name,
      unitOfMeasure: body.unitOfMeasure,
      currency: 'LKR',
      defaultUnitRateLkr: rate,
      rateStatus: rate === null ? 'missing_rate' : 'configured',
      billingCategoryCode: body.billingCategoryCode?.toUpperCase() ?? null,
      billingCategoryName: categoryName,
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 0,
      notes: body.notes ?? '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (rate !== null) {
      await createRate({
        itemId: item._id,
        unitRateLkr: rate,
        effectiveFrom: body.effectiveFrom ?? new Date().toISOString().slice(0, 10),
        note: 'Initial item rate',
        userId: req.user!.id,
      });
    }
    if (body.billingCategoryCode) {
      await BillingCategory.updateOne(
        { organizationId: env.organisationId, code: body.billingCategoryCode.toUpperCase() },
        { $addToSet: { itemIds: item._id }, $set: { updatedAt: new Date() } },
      );
    }
    await writeAudit({
      req,
      action: 'ITEM_CREATED',
      entityType: 'inventory_item',
      entityId: item._id,
      description: `Created item ${item.name} (${item.itemCode}).`,
    });
    res.status(201).json({ item });
  }),
);

const itemUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  sectionCode: z.string().trim().min(1).optional(),
  unitOfMeasure: z.string().trim().min(1).max(20).optional(),
  defaultUnitRateLkr: z.number().min(0).max(1_000_000).nullable().optional(),
  billingCategoryCode: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional(),
});

inventoryRouter.patch(
  '/items/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(itemUpdateSchema, req.body);
    const item = await InventoryItem.findById(req.params.id);
    if (!item) throw notFound('Inventory item not found.');
    const before = item.toObject();

    if (body.name !== undefined) item.name = body.name;
    if (body.unitOfMeasure !== undefined) item.unitOfMeasure = body.unitOfMeasure;
    if (body.sortOrder !== undefined) item.sortOrder = body.sortOrder;
    if (body.notes !== undefined) item.notes = body.notes;
    if (body.active !== undefined) item.active = body.active;
    if (body.sectionCode !== undefined && body.sectionCode.toUpperCase() !== item.sectionCode) {
      const section = await InventorySection.findOne({
        organizationId: env.organisationId,
        code: body.sectionCode.toUpperCase(),
      });
      if (!section) throw badRequest('The selected section does not exist.');
      item.sectionId = section._id;
      item.sectionCode = section.code;
      item.sectionName = section.name;
    }
    if (body.billingCategoryCode !== undefined) {
      if (!body.billingCategoryCode) {
        item.billingCategoryCode = null;
        item.billingCategoryName = null;
      } else {
        const category = await BillingCategory.findOne({
          organizationId: env.organisationId,
          code: body.billingCategoryCode.toUpperCase(),
        });
        if (!category) throw badRequest('The selected billing category does not exist.');
        item.billingCategoryCode = category.code;
        item.billingCategoryName = category.name;
        await BillingCategory.updateOne(
          { _id: category._id },
          { $addToSet: { itemIds: item._id }, $set: { updatedAt: new Date() } },
        );
      }
    }
    if (body.defaultUnitRateLkr !== undefined) {
      if (body.defaultUnitRateLkr === null) {
        item.defaultUnitRateLkr = null;
        item.rateStatus = 'missing_rate';
      } else {
        if (toCents(body.defaultUnitRateLkr) !== toCents(item.defaultUnitRateLkr ?? -1)) {
          item.defaultUnitRateLkr = body.defaultUnitRateLkr;
          item.rateStatus = 'configured';
          // Preserve history: a default-rate change starts a new effective rate.
          const today = new Date().toISOString().slice(0, 10);
          const existingToday = await ItemRateHistory.findOne({ itemId: item._id, effectiveFrom: today });
          if (!existingToday) {
            await createRate({
              itemId: item._id,
              unitRateLkr: body.defaultUnitRateLkr,
              effectiveFrom: today,
              note: 'Default rate updated from item catalogue',
              userId: req.user!.id,
            });
          }
        }
      }
    }

    item.updatedAt = new Date();
    await item.save();
    await writeAudit({
      req,
      action: 'ITEM_UPDATED',
      entityType: 'inventory_item',
      entityId: item._id,
      description: `Updated item ${item.name}.`,
      changes: { before, after: item.toObject() },
    });
    res.json({ item });
  }),
);

// ---------------------------------------------------------------------------
// Billing categories
// ---------------------------------------------------------------------------

inventoryRouter.get(
  '/billing-categories',
  asyncHandler(async (_req, res) => {
    const categories = await BillingCategory.find({ organizationId: env.organisationId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ categories });
  }),
);

inventoryRouter.post(
  '/billing-categories',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        code: z.string().trim().min(2).max(60),
        name: z.string().trim().min(2).max(120),
        includeOnInvoice: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
      }),
      req.body,
    );
    const code = body.code.toUpperCase().replace(/\s+/g, '_');
    const exists = await BillingCategory.findOne({ organizationId: env.organisationId, code });
    if (exists) throw conflict('A billing category with this code already exists.');
    const category = await BillingCategory.create({
      _id: `billing-category-${slugify(code)}`,
      organizationId: env.organisationId,
      code,
      name: body.name,
      displayName: body.name,
      sortOrder: body.sortOrder ?? 0,
      itemIds: [],
      includeOnInvoice: body.includeOnInvoice ?? true,
      active: true,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json({ category });
  }),
);

inventoryRouter.patch(
  '/billing-categories/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        name: z.string().trim().min(2).max(120).optional(),
        includeOnInvoice: z.boolean().optional(),
        showWhenZero: z.boolean().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        itemIds: z.array(z.string()).optional(),
      }),
      req.body,
    );
    const category = await BillingCategory.findById(req.params.id);
    if (!category) throw notFound('Billing category not found.');
    if (body.name !== undefined) {
      category.name = body.name;
      category.displayName = body.name;
      await InventoryItem.updateMany(
        { billingCategoryCode: category.code },
        { $set: { billingCategoryName: body.name } },
      );
    }
    if (body.includeOnInvoice !== undefined) category.includeOnInvoice = body.includeOnInvoice;
    if (body.showWhenZero !== undefined) category.showWhenZero = body.showWhenZero;
    if (body.active !== undefined) category.active = body.active;
    if (body.sortOrder !== undefined) category.sortOrder = body.sortOrder;
    if (body.itemIds !== undefined) {
      const items = await InventoryItem.find({ _id: { $in: body.itemIds } }).lean();
      const validIds = items.map((i) => i._id);
      await InventoryItem.updateMany(
        { _id: { $in: validIds } },
        { $set: { billingCategoryCode: category.code, billingCategoryName: category.name } },
      );
      const removed = category.itemIds.filter((id) => !validIds.includes(id));
      if (removed.length > 0) {
        await InventoryItem.updateMany(
          { _id: { $in: removed }, billingCategoryCode: category.code },
          { $set: { billingCategoryCode: null, billingCategoryName: null } },
        );
      }
      category.itemIds = validIds;
    }
    category.updatedAt = new Date();
    await category.save();
    res.json({ category });
  }),
);

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

inventoryRouter.get(
  '/rates',
  asyncHandler(async (req, res) => {
    const query = parseQuery(z.object({ itemId: z.string().optional() }), req.query);
    const filter: Record<string, unknown> = { organizationId: env.organisationId };
    if (query.itemId) filter.itemId = query.itemId;
    const rates = await ItemRateHistory.find(filter).sort({ effectiveFrom: -1 }).lean();
    res.json({ rates });
  }),
);

inventoryRouter.get(
  '/rates/history/:itemId',
  asyncHandler(async (req, res) => {
    const item = await InventoryItem.findById(req.params.itemId).lean();
    if (!item) throw notFound('Inventory item not found.');
    const rates = await ItemRateHistory.find({ itemId: item._id }).sort({ effectiveFrom: -1 }).lean();
    res.json({ item, rates });
  }),
);

inventoryRouter.get(
  '/rates/missing',
  asyncHandler(async (_req, res) => {
    const items = await InventoryItem.find({
      organizationId: env.organisationId,
      $or: [{ rateStatus: 'missing_rate' }, { defaultUnitRateLkr: null }],
    })
      .sort({ sectionCode: 1, sortOrder: 1 })
      .lean();
    const missingEntries = await DailyInventoryEntry.find({
      pricingStatus: 'missing_rate',
      quantity: { $gt: 0 },
    })
      .sort({ serviceDate: 1 })
      .lean();
    res.json({ items, entries: missingEntries });
  }),
);

inventoryRouter.get(
  '/rates/applicable',
  asyncHandler(async (req, res) => {
    const query = parseQuery(z.object({ month: monthKeySchema }), req.query);
    const meta = getMonthMeta(query.month);
    const items = await InventoryItem.find({
      organizationId: env.organisationId,
      $or: [{ active: true }],
    })
      .sort({ sectionCode: 1, sortOrder: 1 })
      .lean();
    const rates = await loadRatesForItems(items.map((i) => i._id));
    const rows = items.map((item) => {
      const resolved = resolveRateForDate(rates.get(item._id) ?? [], meta.periodEnd, item.defaultUnitRateLkr);
      return {
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.name,
        sectionCode: item.sectionCode,
        sectionName: item.sectionName,
        billingCategoryCode: item.billingCategoryCode,
        rate: resolved.rate,
        rateSource: resolved.source,
        effectiveFrom: resolved.record?.effectiveFrom ?? null,
        rateStatus: resolved.rate === null ? 'missing_rate' : 'configured',
      };
    });
    res.json({ monthKey: query.month, label: monthLabel(query.month), rows });
  }),
);

inventoryRouter.post(
  '/rates',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        itemId: z.string().min(1),
        unitRateLkr: z.number().min(0).max(1_000_000),
        effectiveFrom: serviceDateSchema,
        note: z.string().max(300).optional(),
      }),
      req.body,
    );
    const rate = await createRate({ ...body, userId: req.user!.id });
    await writeAudit({
      req,
      action: 'RATE_CREATED',
      entityType: 'item_rate_history',
      entityId: rate._id,
      description: `Rate LKR ${body.unitRateLkr} for ${body.itemId} effective ${body.effectiveFrom}.`,
    });
    res.status(201).json({ rate });
  }),
);

inventoryRouter.patch(
  '/rates/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        unitRateLkr: z.number().min(0).max(1_000_000).optional(),
        effectiveFrom: serviceDateSchema.optional(),
        note: z.string().max(300).optional(),
      }),
      req.body,
    );
    const rate = await updateFutureRate(req.params.id, body);
    res.json({ rate });
  }),
);

inventoryRouter.delete(
  '/rates/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteFutureRate(req.params.id);
    res.json({ ok: true });
  }),
);

/**
 * Resolve existing missing-rate entries for one item in one month.
 * This is an explicit correction and is audited. Historical line amounts are
 * written once and remain snapshots thereafter.
 */
inventoryRouter.post(
  '/rates/resolve-missing',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        itemId: z.string().min(1),
        monthKey: monthKeySchema,
        unitRateLkr: z.number().min(0).max(1_000_000),
        effectiveFrom: serviceDateSchema,
        createRateRecord: z.boolean().default(true),
        reason: z.string().trim().min(5).max(300),
      }),
      req.body,
    );
    const item = await InventoryItem.findById(body.itemId);
    if (!item) throw notFound('Inventory item not found.');
    if (!isValidMonthKey(body.monthKey)) throw badRequest('Invalid month.');

    if (body.createRateRecord) {
      const existing = await ItemRateHistory.findOne({
        itemId: item._id,
        effectiveFrom: body.effectiveFrom,
      });
      if (!existing) {
        await createRate({
          itemId: item._id,
          unitRateLkr: body.unitRateLkr,
          effectiveFrom: body.effectiveFrom,
          note: body.reason,
          userId: req.user!.id,
        });
      }
    }

    const entries = await DailyInventoryEntry.find({
      itemId: item._id,
      pricingStatus: 'missing_rate',
      serviceDate: { $regex: `^${body.monthKey}-` },
      quantity: { $gt: 0 },
    });
    for (const entry of entries) {
      entry.unitRateLkr = body.unitRateLkr;
      entry.lineAmountLkr = Number((entry.quantity * body.unitRateLkr).toFixed(2));
      entry.pricingStatus = 'priced';
      entry.updatedBy = req.user!.id;
      entry.updatedAt = new Date();
      await entry.save();
    }
    await rebuildSummary(body.monthKey, { id: req.user!.id, name: req.user!.name });
    await writeAudit({
      req,
      action: 'MISSING_RATES_RESOLVED',
      entityType: 'inventory_item',
      entityId: item._id,
      description: `Resolved ${entries.length} missing-rate entr${entries.length === 1 ? 'y' : 'ies'} for ${item.name} at LKR ${body.unitRateLkr}.`,
      changes: { monthKey: body.monthKey, reason: body.reason },
    });
    res.json({ updatedEntries: entries.length });
  }),
);

/** Explicitly waive unpriced quantity. The quantity stays visible, amount is zero. */
inventoryRouter.post(
  '/rates/waive-quantity',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(
      z.object({
        itemId: z.string().min(1),
        monthKey: monthKeySchema,
        reason: z.string().trim().min(5).max(300),
      }),
      req.body,
    );
    const item = await InventoryItem.findById(body.itemId);
    if (!item) throw notFound('Inventory item not found.');
    const result = await DailyInventoryEntry.updateMany(
      {
        itemId: item._id,
        serviceDate: { $regex: `^${body.monthKey}-` },
        pricingStatus: 'missing_rate',
        quantity: { $gt: 0 },
      },
      {
        $set: {
          pricingStatus: 'waived',
          lineAmountLkr: 0,
          updatedAt: new Date(),
          updatedBy: req.user!.id,
        },
      },
    );
    await rebuildSummary(body.monthKey, { id: req.user!.id, name: req.user!.name });
    await writeAudit({
      req,
      action: 'QUANTITY_WAIVED',
      entityType: 'inventory_item',
      entityId: item._id,
      description: `Waived ${result.modifiedCount} unpriced entries for ${item.name}. Reason: ${body.reason}`,
    });
    res.json({ waivedEntries: result.modifiedCount });
  }),
);

// Fix unused import for older TS versions.
void newId;
