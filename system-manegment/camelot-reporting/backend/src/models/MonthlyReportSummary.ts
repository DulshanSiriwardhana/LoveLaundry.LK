import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

const dailyTotalSchema = new Schema(
  {
    serviceDate: { type: String, required: true },
    dayOfMonth: { type: Number, required: true },
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },
    status: { type: String, enum: ['complete', 'incomplete', 'empty'], default: 'empty' },
  },
  { _id: false },
);

const sectionTotalSchema = new Schema(
  {
    sectionCode: { type: String, required: true },
    sectionName: { type: String, default: '' },
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const categoryTotalSchema = new Schema(
  {
    billingCategoryCode: { type: String, default: null },
    billingCategoryName: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    hasActivity: { type: Boolean, default: false },
    includeOnInvoice: { type: Boolean, default: true },
    weightedAverageRateLkr: { type: Number, default: null },
  },
  { _id: false },
);

const itemTotalSchema = new Schema(
  {
    itemId: { type: String, required: true },
    itemCode: { type: String, default: '' },
    itemName: { type: String, default: '' },
    sectionCode: { type: String, default: '' },
    sectionName: { type: String, default: '' },
    billingCategoryCode: { type: String, default: null },
    billingCategoryName: { type: String, default: '' },
    unitOfMeasure: { type: String, default: 'piece' },
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    unitRateLkr: { type: Number, default: null },
    recordedDays: { type: Number, default: 0 },
  },
  { _id: false },
);

const monthlyReportSummarySchema = new Schema(
  {
    _id: { type: String, required: true },
    organizationId: { type: String, required: true, index: true },
    reportId: { type: String, required: true },
    monthKey: { type: String, required: true },
    currency: { type: String, default: 'LKR' },
    totalQuantity: { type: Number, default: 0 },
    totalAmountLkr: { type: Number, default: 0 },
    unpricedQuantity: { type: Number, default: 0 },
    pricedQuantity: { type: Number, default: 0 },
    entryCount: { type: Number, default: 0 },
    activeDayCount: { type: Number, default: 0 },
    dailyTotals: { type: [dailyTotalSchema], default: [] },
    sectionTotals: { type: [sectionTotalSchema], default: [] },
    billingCategoryTotals: { type: [categoryTotalSchema], default: [] },
    itemTotals: { type: [itemTotalSchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
    sourceEntryCount: { type: Number, default: 0 },
    sourceChecksum: { type: String, default: '' },
    ...timestampsDefinition,
  },
  baseOptions,
);

monthlyReportSummarySchema.index({ reportId: 1 }, { unique: true, name: 'uq_report_summary' });
monthlyReportSummarySchema.index({ monthKey: 1 }, { name: 'ix_summary_month' });

export type MonthlyReportSummaryDoc = InferSchemaType<typeof monthlyReportSummarySchema> & { _id: string };
export const MonthlyReportSummary = model(
  'MonthlyReportSummary',
  monthlyReportSummarySchema,
  'monthly_report_summaries',
);
