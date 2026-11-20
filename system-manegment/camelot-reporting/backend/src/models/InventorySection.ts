import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const inventorySectionSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdFrom: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

inventorySectionSchema.index(
  { organizationId: 1, code: 1 },
  { unique: true, name: 'uq_section_code_per_laundry' },
);

export type InventorySectionDoc = InferSchemaType<typeof inventorySectionSchema> & { _id: string };
export const InventorySection = model('InventorySection', inventorySectionSchema, 'inventory_sections');
