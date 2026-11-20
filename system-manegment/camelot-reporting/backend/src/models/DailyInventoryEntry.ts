import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const dailyInventoryEntrySchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    reportId: { type: String, required: true, index: true },
    customerId: { type: String, default: null },
    sectionId: { type: String, default: '' },
    sectionCode: { type: String, required: true },
    sectionName: { type: String, default: '' },
    itemId: { type: String, required: true },
    itemCode: { type: String, required: true },
    itemName: { type: String, required: true },
    billingCategoryCode: { type: String, default: null },
    billingCategoryName: { type: String, default: null },
    serviceDate: { type: String, required: true },
    dayOfMonth: { type: Number, required: true, min: 1, max: 31 },
    quantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    unitOfMeasure: { type: String, default: 'piece' },
    unitRateLkr: { type: Number, default: null },
    lineAmountLkr: { type: Number, default: 0 },
    pricingStatus: { type: String, enum: ['priced', 'missing_rate', 'waived'], default: 'priced' },
    entrySource: { type: String, default: 'manual' },
    sourceSheet: { type: String, default: '' },
    sourceExcelRow: { type: Number, default: null },
    createdBy: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  baseOptions,
);

dailyInventoryEntrySchema.index(
  { reportId: 1, serviceDate: 1, itemId: 1 },
  { unique: true, name: 'uq_daily_item_entry' },
);
dailyInventoryEntrySchema.index({ organizationId: 1, reportId: 1, serviceDate: 1 }, { name: 'ix_daily_report_date' });
dailyInventoryEntrySchema.index({ reportId: 1, itemId: 1, serviceDate: 1 }, { name: 'ix_daily_item_history' });
dailyInventoryEntrySchema.index({ reportId: 1, billingCategoryCode: 1 }, { name: 'ix_daily_invoice_categories' });

export type DailyInventoryEntryDoc = InferSchemaType<typeof dailyInventoryEntrySchema> & { _id: string };
export const DailyInventoryEntry = model(
  'DailyInventoryEntry',
  dailyInventoryEntrySchema,
  'daily_inventory_entries',
);
