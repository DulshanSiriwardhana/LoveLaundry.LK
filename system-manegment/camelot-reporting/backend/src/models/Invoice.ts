import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const invoiceItemLineSchema = new Schema(
  {
    itemId: { type: String, default: '' },
    itemCode: { type: String, default: '' },
    itemName: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unitRateLkr: { type: Number, default: null },
    amountLkr: { type: Number, default: 0 },
    pricingStatus: { type: String, default: 'priced' },
  },
  { _id: false },
);

const invoiceLineSchema = new Schema(
  {
    lineNumber: { type: Number, default: 0 },
    billingCategoryCode: { type: String, default: null },
    billingCategoryName: { type: String, default: '' },
    description: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    unitRateLkr: { type: Number, default: null },
    subtotalLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    itemBreakdown: { type: [invoiceItemLineSchema], default: [] },
  },
  { _id: false },
);

const adjustmentSchema = new Schema(
  {
    type: { type: String, enum: ['discount', 'surcharge', 'credit', 'rounding'], default: 'discount' },
    description: { type: String, required: true },
    amountLkr: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: '' },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerSnapshot: { type: Schema.Types.Mixed, default: {} },
    serviceProviderSnapshot: { type: Schema.Types.Mixed, default: {} },
    reportId: { type: String, required: true },
    monthKey: { type: String, required: true, index: true },
    periodStart: { type: String, default: '' },
    periodEnd: { type: String, default: '' },
    invoiceDate: { type: String, required: true },
    dueDate: { type: String, default: null },
    currency: { type: String, default: 'LKR' },
    status: {
      type: String,
      enum: ['draft', 'reviewed', 'finalized', 'paid', 'void'],
      default: 'draft',
    },
    revisionNumber: { type: Number, default: 0 },
    parentInvoiceId: { type: String, default: null },
    revisionReason: { type: String, default: '' },
    lines: { type: [invoiceLineSchema], default: [] },
    adjustments: { type: [adjustmentSchema], default: [] },
    payment: {
      bankName: { type: String, default: '' },
      branch: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      swiftCode: { type: String, default: '' },
      terms: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
    totals: {
      subtotalLkr: { type: Number, default: 0 },
      adjustmentsTotalLkr: { type: Number, default: 0 },
      taxableAmountLkr: { type: Number, default: 0 },
      taxRatePercent: { type: Number, default: 0 },
      taxLabel: { type: String, default: '' },
      taxAmountLkr: { type: Number, default: 0 },
      totalLkr: { type: Number, default: 0 },
      unpricedQuantity: { type: Number, default: 0 },
    },
    snapshot: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: String, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: String, default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: '' },
  },
  baseOptions,
);

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true, name: 'uq_invoice_number_per_laundry' });
invoiceSchema.index({ organizationId: 1, customerId: 1, invoiceDate: -1 }, { name: 'ix_customer_invoice_history' });
invoiceSchema.index({ reportId: 1, status: 1 }, { name: 'ix_invoice_report_status' });

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { _id: string };
export const Invoice = model('Invoice', invoiceSchema, 'invoices');
