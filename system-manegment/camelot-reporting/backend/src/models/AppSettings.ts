import { Schema, model, InferSchemaType } from 'mongoose';
import { baseOptions, timestampsDefinition } from './common';

export const SETTINGS_ID = 'app-settings';

const appSettingsSchema = new Schema(
  {
    _id: { type: String, default: SETTINGS_ID },
    organizationId: { type: String, required: true },
    serviceProvider: {
      name: { type: String, default: 'Love Laundry' },
      address: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      website: { type: String, default: '' },
      taxNumber: { type: String, default: '' },
      logoUrl: { type: String, default: '' },
    },
    customer: {
      name: { type: String, default: 'Camelot Beach Hotel' },
      address: { type: String, default: '' },
      city: { type: String, default: 'Negombo' },
      country: { type: String, default: 'Sri Lanka' },
      contactPerson: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      taxNumber: { type: String, default: '' },
    },
    bank: {
      bankName: { type: String, default: '' },
      branch: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      swiftCode: { type: String, default: '' },
    },
    invoice: {
      prefix: { type: String, default: 'CBH' },
      paymentTermsDays: { type: Number, default: 30, min: 0, max: 365 },
      defaultNotes: { type: String, default: 'Thank you for your business.' },
      paymentTermsText: { type: String, default: 'Payment due within 30 days of invoice date.' },
    },
    tax: {
      enabled: { type: Boolean, default: false },
      label: { type: String, default: 'Tax' },
      ratePercent: { type: Number, default: 0, min: 0, max: 100 },
    },
    reporting: {
      timezone: { type: String, default: 'Asia/Colombo' },
      currency: { type: String, default: 'LKR' },
      requireAllDaysForInvoice: { type: Boolean, default: false },
    },
    seededOctoberDataset: { type: Boolean, default: false },
    ...timestampsDefinition,
  },
  baseOptions,
);

export type AppSettingsDoc = InferSchemaType<typeof appSettingsSchema> & { _id: string };
export const AppSettings = model('AppSettings', appSettingsSchema, 'app_settings');
