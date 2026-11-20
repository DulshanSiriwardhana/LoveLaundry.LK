import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const billingCategorySchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    itemIds: { type: [String], default: [] },
    aggregationMethod: { type: String, default: 'sum_quantity_and_line_amount' },
    includeOnInvoice: { type: Boolean, default: true },
    showWhenZero: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    source: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

billingCategorySchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, name: 'uq_billing_category_per_laundry' },
);

export type BillingCategoryDoc = InferSchemaType<typeof billingCategorySchema> & { _id: string };
export const BillingCategory = model('BillingCategory', billingCategorySchema, 'billing_categories');
