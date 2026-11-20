import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const itemRateHistorySchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    itemId: { type: String, required: true, index: true },
    itemCode: { type: String, default: '' },
    unitRateLkr: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LKR' },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null },
    status: { type: String, enum: ['active', 'superseded'], default: 'active' },
    source: { type: String, default: '' },
    createdBy: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

itemRateHistorySchema.index(
  { itemId: 1, effectiveFrom: 1 },
  { unique: true, name: 'uq_item_rate_effective_date' },
);
itemRateHistorySchema.index({ organizationId: 1, itemId: 1, effectiveFrom: -1 }, { name: 'ix_item_rate_lookup' });

export type ItemRateHistoryDoc = InferSchemaType<typeof itemRateHistorySchema> & { _id: string };
export const ItemRateHistory = model('ItemRateHistory', itemRateHistorySchema, 'item_rate_history');
