import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const inventoryItemSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    sectionId: { type: String, required: true },
    sectionCode: { type: String, required: true, uppercase: true },
    sectionName: { type: String, default: '' },
    itemCode: { type: String, required: true, trim: true, uppercase: true },
    itemNo: { type: Number, default: 0 },
    name: { type: String, required: true, trim: true },
    unitOfMeasure: { type: String, default: 'piece' },
    currency: { type: String, default: 'LKR' },
    defaultUnitRateLkr: { type: Number, default: null },
    rateStatus: { type: String, enum: ['configured', 'missing_rate'], default: 'configured' },
    billingCategoryCode: { type: String, default: null },
    billingCategoryName: { type: String, default: null },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    sourceSheet: { type: String, default: '' },
    sourceExcelRow: { type: Number, default: null },
    sourceMonthlyQuantity: { type: Number, default: null },
    sourceMonthlyCostLkr: { type: Number, default: null },
    notes: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

inventoryItemSchema.index(
  { organizationId: 1, itemCode: 1 },
  { unique: true, name: 'uq_item_code_per_laundry' },
);
inventoryItemSchema.index({ organizationId: 1, sectionCode: 1, sortOrder: 1 }, { name: 'ix_items_by_section' });
inventoryItemSchema.index({ organizationId: 1, name: 1 }, { name: 'ix_items_by_name' });
inventoryItemSchema.index({ organizationId: 1, rateStatus: 1 }, { name: 'ix_items_rate_status' });

export type InventoryItemDoc = InferSchemaType<typeof inventoryItemSchema> & { _id: string };
export const InventoryItem = model('InventoryItem', inventoryItemSchema, 'inventory_items');
