import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const monthlyTotalsSchema = new Schema(
  {
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    pricedQuantity: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },
    activeDayCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const blockingIssueSchema = new Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['blocking', 'warning'], default: 'blocking' },
    itemId: { type: String, default: null },
    serviceDate: { type: String, default: null },
  },
  { _id: false },
);

const monthlyReportSchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    customerId: { type: String, default: null },
    customerName: { type: String, default: null },
    siteId: { type: String, default: null },
    siteName: { type: String, default: null },
    reportName: { type: String, required: true },
    reportType: { type: String, default: 'monthly_inventory' },
    monthKey: { type: String, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    timezone: { type: String, default: 'Asia/Colombo' },
    currency: { type: String, default: 'LKR' },
    status: {
      type: String,
      enum: ['draft', 'reviewed', 'approved', 'invoiced', 'closed'],
      default: 'draft',
    },
    invoiceStatus: {
      type: String,
      enum: ['not_generated', 'draft', 'reviewed', 'finalized', 'paid', 'void'],
      default: 'not_generated',
    },
    source: { type: Schema.Types.Mixed, default: {} },
    totals: { type: monthlyTotalsSchema, default: () => ({}) },
    validation: { type: Schema.Types.Mixed, default: {} },
    completedDates: { type: [String], default: [] },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: String, default: null },
    ...timestampsDefinition,
  },
  baseOptions,
);

monthlyReportSchema.index(
  { organizationId: 1, monthKey: 1 },
  { unique: true, name: 'uq_report_period' },
);
monthlyReportSchema.index({ organizationId: 1, status: 1, monthKey: -1 }, { name: 'ix_report_status_month' });

export type MonthlyReportDoc = InferSchemaType<typeof monthlyReportSchema> & { _id: string };
export const MonthlyReport = model('MonthlyReport', monthlyReportSchema, 'monthly_reports');
