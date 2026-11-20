import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const laundrySchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    currency: { type: String, default: 'LKR' },
    timezone: { type: String, default: 'Asia/Colombo' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

laundrySchema.index({ code: 1 }, { unique: true, name: 'uq_laundry_code' });

export type LaundryDoc = InferSchemaType<typeof laundrySchema> & { _id: string };
export const Laundry = model('Laundry', laundrySchema, 'laundries');
