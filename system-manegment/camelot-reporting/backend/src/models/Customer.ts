import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const customerSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    customerCode: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: 'Sri Lanka' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    taxNumber: { type: String, default: '' },
    active: { type: Boolean, default: true },
    ...timestampsDefinition,
  },
  baseOptions,
);

customerSchema.index(
  { organizationId: 1, customerCode: 1 },
  {
    unique: true,
    name: 'uq_customer_code_per_laundry',
    partialFilterExpression: { customerCode: { $type: 'string' } },
  },
);
customerSchema.index({ organizationId: 1, name: 1 }, { name: 'ix_customers_by_name' });

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: string };
export const Customer = model('Customer', customerSchema, 'customers');
