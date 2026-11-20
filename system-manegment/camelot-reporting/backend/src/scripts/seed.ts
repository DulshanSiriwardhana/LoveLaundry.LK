/**
 * Seed the application with the supplied October 2026 Camelot dataset and the
 * bootstrap users / settings. Safe to run repeatedly: documents are inserted
 * by stable _id and never overwritten.
 *
 *   npm run seed
 */
import bcrypt from 'bcryptjs';
import { readFile } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db/connect';
import { env } from '../config/env';
import { newId } from '../lib/ids';
import { AppSettings, SETTINGS_ID } from '../models/AppSettings';
import { BillingCategory } from '../models/BillingCategory';
import { Customer } from '../models/Customer';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { InventoryItem } from '../models/InventoryItem';
import { InventorySection } from '../models/InventorySection';
import { ItemRateHistory } from '../models/ItemRateHistory';
import { Laundry } from '../models/Laundry';
import { MonthlyReport } from '../models/MonthlyReport';
import { MonthlyReportSummary } from '../models/MonthlyReportSummary';
import { User } from '../models/User';
import { Invoice } from '../models/Invoice';
import { ImportExportHistory } from '../models/ImportExportHistory';
import { AuditLog } from '../models/AuditLog';
import { Counter } from '../models/Counter';
import { rebuildSummary } from '../services/reportService';

const SEED_DIR = path.resolve(process.cwd(), 'seed-data');
const REPORT_MONTH = '2026-10';

async function readCollection<T>(name: string): Promise<T[]> {
  const text = await readFile(path.join(SEED_DIR, 'collections', `${name}.json`), 'utf8');
  return JSON.parse(text) as T[];
}

async function ensureUsers(): Promise<void> {
  const count = await User.countDocuments({});
  if (count > 0) {
    console.log(`Users already exist (${count}); leaving credentials untouched.`);
    return;
  }
  const adminHash = await bcrypt.hash(env.admin.password, 12);
  const operatorHash = await bcrypt.hash(env.operator.password, 12);
  await User.create([
    {
      _id: newId('user'),
      name: env.admin.name,
      email: env.admin.email,
      passwordHash: adminHash,
      role: 'admin',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: newId('user'),
      name: env.operator.name,
      email: env.operator.email,
      passwordHash: operatorHash,
      role: 'operator',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  console.log(`Created bootstrap users: ${env.admin.email} (admin), ${env.operator.email} (operator).`);
  console.log('Change the bootstrap passwords immediately after first login.');
}

async function seedOctoberDataset(): Promise<void> {
  const [laundries, sections, items, categories, rates, reports, entries] = await Promise.all([
    readCollection<Record<string, unknown>>('laundries'),
    readCollection<Record<string, unknown>>('inventory_sections'),
    readCollection<Record<string, unknown>>('inventory_items'),
    readCollection<Record<string, unknown>>('billing_categories'),
    readCollection<Record<string, unknown>>('item_rate_history'),
    readCollection<Record<string, unknown>>('monthly_reports'),
    readCollection<Record<string, unknown>>('daily_inventory_entries'),
  ]);

  const upsertAll = async (model: mongoose.Model<any>, docs: Array<Record<string, any>>, label: string) => {
    if (docs.length === 0) return { inserted: 0, existing: 0 };
    const ops = docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    }));
    const result = await model.bulkWrite(ops, { ordered: false });
    const inserted = result.upsertedCount ?? 0;
    console.log(`${label}: ${inserted} inserted, ${docs.length - inserted} already present.`);
    return { inserted, existing: docs.length - inserted };
  };

  await upsertAll(Laundry, laundries, 'laundries');
  await upsertAll(InventorySection, sections, 'inventory_sections');
  await upsertAll(InventoryItem, items, 'inventory_items');
  await upsertAll(BillingCategory, categories, 'billing_categories');
  await upsertAll(ItemRateHistory, rates, 'item_rate_history');
  await upsertAll(MonthlyReport, reports, 'monthly_reports');
  await upsertAll(DailyInventoryEntry, entries, 'daily_inventory_entries');

  // The hotel identity is fixed in this application.
  const customer = await Customer.findById(env.customerId);
  if (!customer) {
    await Customer.create({
      _id: env.customerId,
      organizationId: env.organisationId,
      customerCode: 'CAMELOT',
      name: 'Camelot Beach Hotel',
      city: 'Negombo',
      country: 'Sri Lanka',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Created fixed customer: Camelot Beach Hotel.');
  }

  const report = await MonthlyReport.findOne({ monthKey: REPORT_MONTH });
  if (report) {
    const missingRateDates = new Set(
      entries
        .filter((e: any) => e.quantity > 0 && (e.unitRateLkr === null || e.unitRateLkr === undefined))
        .map((e: any) => String(e.serviceDate)),
    );
    const recordedDates = [...new Set(entries.map((e: any) => String(e.serviceDate)))].sort();
    report.customerId = env.customerId;
    report.customerName = 'Camelot Beach Hotel';
    report.completedDates = recordedDates.filter((d) => !missingRateDates.has(d));
    if (!report.validation || typeof report.validation !== 'object') report.validation = {};
    report.updatedAt = new Date();
    await report.save();
    console.log(
      `October report linked to Camelot Beach Hotel; ${report.completedDates.length} day(s) marked complete.`,
    );
  }

  // Recompute summaries from daily entries (the source of truth). The seeded
  // summary file is not trusted as a calculation source.
  const rebuilt = await rebuildSummary(REPORT_MONTH);
  await MonthlyReportSummary.findOneAndUpdate(
    { reportId: rebuilt.report._id },
    { $set: { 'reconciliation.source': 'rebuilt_from_daily_inventory_entries' } },
  );
  console.log(
    `Rebuilt ${REPORT_MONTH} summary: ${rebuilt.calculation.totals.totalQuantity} qty / LKR ${rebuilt.calculation.totals.totalAmountLkr.toFixed(2)}.`,
  );
}

async function ensureSettings(): Promise<void> {
  const existing = await AppSettings.findById(SETTINGS_ID);
  if (existing) {
    if (!existing.seededOctoberDataset) {
      existing.seededOctoberDataset = true;
      existing.updatedAt = new Date();
      await existing.save();
    }
    return;
  }
  await AppSettings.create({
    _id: SETTINGS_ID,
    organizationId: env.organisationId,
    serviceProvider: { name: 'Love Laundry', address: '', phone: '', email: '', website: '', taxNumber: '' },
    customer: {
      name: 'Camelot Beach Hotel',
      address: '',
      city: 'Negombo',
      country: 'Sri Lanka',
      contactPerson: '',
      phone: '',
      email: '',
      taxNumber: '',
    },
    bank: { bankName: '', branch: '', accountName: '', accountNumber: '', swiftCode: '' },
    invoice: { prefix: 'CBH', paymentTermsDays: 30, defaultNotes: 'Thank you for your business.', paymentTermsText: 'Payment due within 30 days of invoice date.' },
    tax: { enabled: false, label: 'Tax', ratePercent: 0 },
    reporting: { timezone: env.timezone, currency: env.currency, requireAllDaysForInvoice: false },
    seededOctoberDataset: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('Created application settings (tax disabled, no bank details invented).');
}

async function ensureIndexes(): Promise<void> {
  const models = [
    Laundry,
    InventorySection,
    InventoryItem,
    BillingCategory,
    ItemRateHistory,
    MonthlyReport,
    DailyInventoryEntry,
    MonthlyReportSummary,
    Customer,
    User,
    AppSettings,
    Invoice,
    ImportExportHistory,
    AuditLog,
    Counter,
  ];
  for (const model of models) {
    await model.createIndexes();
  }
  console.log(`Indexes ensured for ${models.length} models.`);
}

async function main(): Promise<void> {
  console.log(`Seeding Camelot reporting database: ${env.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
  await connectDatabase();
  await ensureIndexes();
  await seedOctoberDataset();
  await ensureSettings();
  await ensureUsers();
  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
