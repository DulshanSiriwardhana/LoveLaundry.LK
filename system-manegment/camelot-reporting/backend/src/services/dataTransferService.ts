import AdmZip from 'adm-zip';
import { createHash } from 'crypto';
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { parse as parseCsv } from 'csv-parse/sync';
import { Model } from 'mongoose';
import { env } from '../config/env';
import { getMonthMeta, isValidMonthKey, isValidServiceDate } from '../lib/dates';
import { badRequest, notFound, unprocessable } from '../lib/errors';
import { newId } from '../lib/ids';
import { AuditLog } from '../models/AuditLog';
import { AppSettings } from '../models/AppSettings';
import { BillingCategory } from '../models/BillingCategory';
import { Counter } from '../models/Counter';
import { Customer } from '../models/Customer';
import { DailyInventoryEntry } from '../models/DailyInventoryEntry';
import { ImportExportHistory } from '../models/ImportExportHistory';
import { InventoryItem } from '../models/InventoryItem';
import { InventorySection } from '../models/InventorySection';
import { Invoice } from '../models/Invoice';
import { ItemRateHistory } from '../models/ItemRateHistory';
import { Laundry } from '../models/Laundry';
import { MonthlyReport } from '../models/MonthlyReport';
import { MonthlyReportSummary } from '../models/MonthlyReportSummary';
import { User } from '../models/User';
import { AuditActor, writeAudit } from './auditService';
import { rebuildSummary } from './reportService';
import { buildReportExcel, buildReportPdf } from './reportDocumentService';
import { buildInvoiceExcel, buildInvoicePdf } from './invoiceDocumentService';

const APP_VERSION = '1.0.0';
const SCHEMA_VERSION = 1;

export const COLLECTION_MODELS: Record<string, Model<any>> = {
  laundries: Laundry,
  inventory_sections: InventorySection,
  inventory_items: InventoryItem,
  billing_categories: BillingCategory,
  item_rate_history: ItemRateHistory,
  monthly_reports: MonthlyReport,
  daily_inventory_entries: DailyInventoryEntry,
  monthly_report_summaries: MonthlyReportSummary,
  customers: Customer,
  invoices: Invoice,
  users: User,
  app_settings: AppSettings,
  import_export_history: ImportExportHistory,
  audit_logs: AuditLog,
  counters: Counter,
};

export const ALLOWED_COLLECTIONS = Object.keys(COLLECTION_MODELS);

const REQUIRED_FIELDS: Record<string, string[]> = {
  laundries: ['name', 'code'],
  inventory_sections: ['organizationId', 'code', 'name'],
  inventory_items: ['organizationId', 'itemCode', 'name', 'sectionCode'],
  billing_categories: ['organizationId', 'code', 'name'],
  item_rate_history: ['organizationId', 'itemId', 'unitRateLkr', 'effectiveFrom'],
  monthly_reports: ['organizationId', 'monthKey', 'reportName', 'year', 'month'],
  daily_inventory_entries: [
    'organizationId',
    'reportId',
    'serviceDate',
    'itemId',
    'itemCode',
    'itemName',
    'quantity',
  ],
  monthly_report_summaries: ['organizationId', 'reportId', 'monthKey'],
  customers: ['organizationId', 'name'],
  invoices: ['organizationId', 'invoiceNumber', 'customerId', 'reportId', 'monthKey'],
  users: ['email', 'passwordHash', 'role'],
  app_settings: ['organizationId'],
  import_export_history: ['organizationId', 'operation'],
  audit_logs: ['organizationId', 'action'],
  counters: ['seq'],
};

interface ParsedCollection {
  name: string;
  documents: Array<Record<string, any>>;
}

export interface ParsedImport {
  filename: string;
  format: string;
  collections: ParsedCollection[];
  manifest?: Record<string, any> | null;
  rawFormat?: 'zip' | 'json' | 'csv' | 'xlsx' | 'extended-json' | 'ndjson';
}

export interface ImportPreview {
  filename: string;
  format: string;
  mode: string;
  collections: Array<{
    name: string;
    documentCount: number;
    existingCount: number;
    newCount: number;
    duplicateIds: number;
    invalidDocuments: number;
    sample: Array<Record<string, unknown>>;
    issues: string[];
  }>;
  totals: {
    documents: number;
    newDocuments: number;
    duplicateDocuments: number;
    invalidDocuments: number;
    missingRates: number;
    invalidQuantities: number;
  };
  warnings: string[];
  errors: string[];
  canImport: boolean;
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function toPlainJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(toPlainJson);
  if (typeof value === 'object') {
    const maybeId = value as { _bsontype?: string; toHexString?: () => string };
    if (maybeId._bsontype === 'ObjectId' && typeof maybeId.toHexString === 'function') {
      return { $oid: maybeId.toHexString() };
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) out[key] = toPlainJson(v);
    return out;
  }
  return value;
}

function fromExtendedJson(value: unknown): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(fromExtendedJson);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('$oid' in obj && typeof obj.$oid === 'string') return obj.$oid;
    if ('$date' in obj) {
      const d = obj.$date;
      if (typeof d === 'string') return d;
      if (d && typeof d === 'object' && '$numberLong' in (d as object)) {
        return new Date(Number((d as { $numberLong: string }).$numberLong)).toISOString();
      }
    }
    if ('$numberDecimal' in obj) return Number(obj.$numberDecimal);
    if ('$numberDouble' in obj) return Number(obj.$numberDouble);
    if ('$numberInt' in obj) return Number(obj.$numberInt);
    if ('$numberLong' in obj) return Number(obj.$numberLong);
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) out[key] = fromExtendedJson(v);
    return out;
  }
  return value;
}

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function coerceDocuments(raw: unknown, collection: string): Array<Record<string, any>> {
  if (raw === null || raw === undefined) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .filter((doc) => doc && typeof doc === 'object' && !Array.isArray(doc))
    .map((doc) => {
      const revived = fromExtendedJson(doc) as Record<string, any>;
      if (!revived._id) revived._id = newId(collection.replace(/s$/, ''));
      return revived;
    });
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

export async function parseImportBuffer(buffer: Buffer, filename: string): Promise<ParsedImport> {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.zip')) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const collectionEntries = entries.filter((e) => {
      const name = e.entryName.replace(/\\/g, '/');
      return /(^|\/)collections\/[^/]+\.json$/i.test(name);
    });
    const parseEntry = (entry: AdmZip.IZipEntry): Record<string, any>[] => {
      const text = entry.getData().toString('utf8');
      const parsed = JSON.parse(text);
      return coerceDocuments(parsed, path.basename(entry.entryName, '.json'));
    };

    if (collectionEntries.length > 0) {
      const manifestEntry = entries.find((e) => /(^|\/)manifest\.json$/i.test(e.entryName));
      const manifest = manifestEntry ? JSON.parse(manifestEntry.getData().toString('utf8')) : null;
      const collections = collectionEntries.map((entry) => {
        const name = path.basename(entry.entryName, '.json');
        if (manifest?.checksums) {
          const data = entry.getData();
          const expected =
            manifest.checksums[`collections/${name}.json`] ??
            manifest.checksums[name] ??
            manifest.checksums[entry.entryName];
          if (expected && sha256(data) !== expected) {
            throw badRequest(`Checksum verification failed for collection ${name}.`);
          }
        }
        return { name, documents: parseEntry(entry) };
      });
      return {
        filename,
        format: manifest?.fullBackup ? 'Application backup ZIP' : 'MongoDB ZIP package',
        collections: dedupeCollections(collections),
        manifest,
        rawFormat: 'zip',
      };
    }

    // Full application backup: collections/<name>.json with manifest checksums.
    const backupEntries = entries.filter((e) => /(^|\/)collections\/[^/]+\.json$/i.test(e.entryName));
    if (backupEntries.length > 0) {
      const manifestEntry = entries.find((e) => /(^|\/)manifest\.json$/i.test(e.entryName));
      if (!manifestEntry) throw badRequest('The ZIP does not contain a manifest.json. It cannot be validated.');
      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
      const collections = backupEntries.map((entry) => {
        const name = path.basename(entry.entryName, '.json');
        const data = entry.getData();
        const expected = manifest.checksums?.[`collections/${name}.json`] ?? manifest.checksums?.[name];
        if (expected && sha256(data) !== expected) {
          throw badRequest(`Checksum verification failed for collection ${name}.`);
        }
        return { name, documents: coerceDocuments(JSON.parse(data.toString('utf8')), name) };
      });
      return { filename, format: 'Application backup ZIP', collections: dedupeCollections(collections), manifest, rawFormat: 'zip' };
    }
    throw badRequest('The ZIP does not contain a recognised collections/ folder.');
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const collections: ParsedCollection[] = [];
    for (const sheet of workbook.worksheets) {
      const name = sheet.name.trim();
      const headers: string[] = [];
      const rows: Array<Record<string, any>> = [];
      sheet.eachRow((row, rowNumber) => {
        const values = (row.values as unknown[]).slice(1);
        if (rowNumber === 1) {
          values.forEach((v) => headers.push(String(v ?? '').trim()));
          return;
        }
        const obj: Record<string, any> = {};
        values.forEach((v, index) => {
          if (headers[index]) obj[headers[index]] = v instanceof Date ? v.toISOString() : v;
        });
        if (Object.keys(obj).length > 0) rows.push(obj);
      });
      collections.push({ name, documents: coerceDocuments(rows, name) });
    }
    return { filename, format: 'Excel workbook', collections: dedupeCollections(collections), rawFormat: 'xlsx' };
  }

  if (lower.endsWith('.csv')) {
    const records = parseCsv(buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
    }) as Array<Record<string, string>>;
    const documents = records.map((row) => {
      const obj: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value === '' || value === undefined) continue;
        obj[key] = /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : value;
      }
      return fromExtendedJson(obj);
    });
    const base = path.basename(filename, '.csv').toLowerCase();
    const collectionName = ALLOWED_COLLECTIONS.find((c) => base === c || base.startsWith(c)) ?? base;
    if (!COLLECTION_MODELS[collectionName]) {
      throw badRequest(
        `Cannot determine the collection for ${filename}. Name the CSV after a collection: ${ALLOWED_COLLECTIONS.join(', ')}.`,
      );
    }
    return {
      filename,
      format: 'CSV',
      collections: [{ name: collectionName, documents: coerceDocuments(documents, collectionName) }],
      rawFormat: 'csv',
    };
  }

  const text = buffer.toString('utf8').trim();
  if (!text) throw badRequest('The uploaded file is empty.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const lines = text.split(/\r?\n/).filter(Boolean);
    try {
      parsed = { __collection: null, documents: lines.map((l) => JSON.parse(l)) };
    } catch {
      throw badRequest('The file is not valid JSON or NDJSON.');
    }
  }

  const asRecord = parsed as Record<string, any>;
  if (Array.isArray(parsed)) {
    throw badRequest(
      'A top-level JSON array needs a collection name. Use a ZIP package, an XLSX sheet, or a CSV named after the collection.',
    );
  }
  if (asRecord.collections && typeof asRecord.collections === 'object') {
    const collections = Object.entries(asRecord.collections as Record<string, unknown>).map(([name, docs]) => ({
      name,
      documents: coerceDocuments(docs, name),
    }));
    return { filename, format: 'JSON', collections: dedupeCollections(collections), manifest: asRecord.manifest ?? null, rawFormat: 'json' };
  }
  if (asRecord.__collection) {
    const name = String(asRecord.__collection);
    return {
      filename,
      format: 'JSON',
      collections: [{ name, documents: coerceDocuments(asRecord.documents, name) }],
      rawFormat: 'json',
    };
  }
  if (asRecord.collection && asRecord.documents) {
    const name = String(asRecord.collection);
    return {
      filename,
      format: 'JSON',
      collections: [{ name, documents: coerceDocuments(asRecord.documents, name) }],
      rawFormat: 'json',
    };
  }
  // Single document: infer collection from fields when possible.
  const inferred = inferCollection(asRecord);
  if (!inferred) {
    throw badRequest('Could not determine the collection for this JSON document.');
  }
  return {
    filename,
    format: 'JSON',
    collections: [{ name: inferred, documents: coerceDocuments([asRecord], inferred) }],
    rawFormat: 'json',
  };
}

function dedupeCollections(collections: ParsedCollection[]): ParsedCollection[] {
  const map = new Map<string, Record<string, any>[]>();
  for (const collection of collections) {
    const list = map.get(collection.name) ?? [];
    list.push(...collection.documents);
    map.set(collection.name, list);
  }
  return [...map.entries()].map(([name, documents]) => ({ name, documents }));
}

function inferCollection(doc: Record<string, any>): string | null {
  if ('serviceDate' in doc && 'itemId' in doc && 'reportId' in doc) return 'daily_inventory_entries';
  if ('itemCode' in doc && 'sectionCode' in doc && 'billingCategoryCode' in doc) return 'inventory_items';
  if ('effectiveFrom' in doc && 'itemId' in doc) return 'item_rate_history';
  if ('invoiceNumber' in doc) return 'invoices';
  if ('monthKey' in doc && 'reportName' in doc) return 'monthly_reports';
  if ('monthKey' in doc && 'reportId' in doc) return 'monthly_report_summaries';
  if ('passwordHash' in doc) return 'users';
  if ('customerCode' in doc) return 'customers';
  if ('code' in doc && 'sortOrder' in doc && 'isActive' in doc) return 'inventory_sections';
  if ('code' in doc && 'itemIds' in doc) return 'billing_categories';
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function uniqueKey(collection: string, doc: Record<string, any>): string | null {
  switch (collection) {
    case 'inventory_sections':
      return `${doc.organizationId}::${doc.code}`;
    case 'inventory_items':
      return `${doc.organizationId}::${doc.itemCode}`;
    case 'billing_categories':
      return `${doc.organizationId}::${doc.code}`;
    case 'item_rate_history':
      return `${doc.itemId}::${doc.effectiveFrom}`;
    case 'daily_inventory_entries':
      return `${doc.reportId}::${doc.serviceDate}::${doc.itemId}`;
    case 'monthly_reports':
      return `${doc.organizationId}::${doc.monthKey}`;
    case 'invoices':
      return `${doc.organizationId}::${doc.invoiceNumber}`;
    case 'users':
      return String(doc.email ?? '').toLowerCase();
    default:
      return null;
  }
}

async function existingIdsFor(collection: string, ids: string[]): Promise<Set<string>> {
  const model = COLLECTION_MODELS[collection];
  const result = new Set<string>();
  for (const idsChunk of chunk(ids, 1000)) {
    const docs = await model.find({ _id: { $in: idsChunk } }).select({ _id: 1 }).lean();
    docs.forEach((d: any) => result.add(String(d._id)));
  }
  return result;
}

async function existingUniqueKeys(collection: string, keys: string[]): Promise<Set<string>> {
  const model = COLLECTION_MODELS[collection];
  const result = new Set<string>();
  for (const keyChunk of chunk(keys, 500)) {
    const ors = keyChunk.map((key) => {
      const [a, b, c] = key.split('::');
      switch (collection) {
        case 'inventory_sections':
          return { organizationId: a, code: b };
        case 'inventory_items':
          return { organizationId: a, itemCode: b };
        case 'billing_categories':
          return { organizationId: a, code: b };
        case 'item_rate_history':
          return { itemId: a, effectiveFrom: b };
        case 'daily_inventory_entries':
          return { reportId: a, serviceDate: b, itemId: c };
        case 'monthly_reports':
          return { organizationId: a, monthKey: b };
        case 'invoices':
          return { organizationId: a, invoiceNumber: b };
        case 'users':
          return { email: a };
        default:
          return { _id: '__none__' };
      }
    });
    const docs = await model
      .find({ $or: ors })
      .select(
        collection === 'users'
          ? { email: 1 }
          : collection === 'inventory_items'
            ? { organizationId: 1, itemCode: 1 }
            : collection === 'inventory_sections'
              ? { organizationId: 1, code: 1 }
              : collection === 'billing_categories'
                ? { organizationId: 1, code: 1 }
                : collection === 'item_rate_history'
                  ? { itemId: 1, effectiveFrom: 1 }
                  : collection === 'daily_inventory_entries'
                    ? { reportId: 1, serviceDate: 1, itemId: 1 }
                    : collection === 'monthly_reports'
                      ? { organizationId: 1, monthKey: 1 }
                      : collection === 'invoices'
                        ? { organizationId: 1, invoiceNumber: 1 }
                        : { _id: 1 },
      )
      .lean();
    for (const d of docs as any[]) {
      const key = uniqueKey(collection, d);
      if (key) result.add(key);
    }
  }
  return result;
}

function validateDocument(collection: string, doc: Record<string, any>): string[] {
  const issues: string[] = [];
  for (const field of REQUIRED_FIELDS[collection] ?? []) {
    if (doc[field] === undefined || doc[field] === null || doc[field] === '') {
      issues.push(`Missing required field "${field}"`);
    }
  }
  if (collection === 'daily_inventory_entries') {
    if (!Number.isInteger(doc.quantity)) issues.push('Quantity must be a whole number.');
    else if (doc.quantity < 0) issues.push('Quantity cannot be negative.');
    if (doc.serviceDate && !isValidServiceDate(String(doc.serviceDate))) {
      issues.push(`Invalid serviceDate "${doc.serviceDate}"`);
    }
    if (doc.pricingStatus === 'missing_rate' || doc.unitRateLkr === null || doc.unitRateLkr === undefined) {
      if (doc.quantity > 0) issues.push('Positive quantity has a missing rate.');
    }
    if (
      doc.unitRateLkr !== null &&
      doc.unitRateLkr !== undefined &&
      (!Number.isFinite(Number(doc.unitRateLkr)) || Number(doc.unitRateLkr) < 0)
    ) {
      issues.push('unitRateLkr must be a non-negative number.');
    }
  }
  if (collection === 'item_rate_history') {
    if (!isValidServiceDate(String(doc.effectiveFrom))) issues.push('effectiveFrom must be a valid date.');
    if (!Number.isFinite(Number(doc.unitRateLkr)) || Number(doc.unitRateLkr) < 0) {
      issues.push('unitRateLkr must be a non-negative number.');
    }
  }
  if (collection === 'monthly_reports') {
    if (!isValidMonthKey(String(doc.monthKey))) issues.push('monthKey must be YYYY-MM.');
    if (!Number.isInteger(Number(doc.year)) || !Number.isInteger(Number(doc.month))) {
      issues.push('year and month must be integers.');
    }
  }
  return issues;
}

export async function inspectImport(parsed: ParsedImport, mode: string): Promise<ImportPreview> {
  const preview: ImportPreview = {
    filename: parsed.filename,
    format: parsed.format,
    mode,
    collections: [],
    totals: {
      documents: 0,
      newDocuments: 0,
      duplicateDocuments: 0,
      invalidDocuments: 0,
      missingRates: 0,
      invalidQuantities: 0,
    },
    warnings: [],
    errors: [],
    canImport: true,
  };

  for (const collection of parsed.collections) {
    if (!COLLECTION_MODELS[collection.name]) {
      preview.errors.push(
        `Collection "${collection.name}" is not allow-listed and will not be imported. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}.`,
      );
      preview.canImport = false;
      continue;
    }
    const byId = new Set<string>();
    const byUnique = new Set<string>();
    const existingIds = await existingIdsFor(
      collection.name,
      collection.documents.map((d) => String(d._id ?? '')),
    );
    const keys = collection.documents
      .map((d) => uniqueKey(collection.name, d))
      .filter((k): k is string => Boolean(k));
    const existingKeys = await existingUniqueKeys(collection.name, keys);

    let existingCount = 0;
    let newCount = 0;
    let duplicateIds = 0;
    let invalidDocuments = 0;
    const issues: string[] = [];

    for (const doc of collection.documents) {
      const id = String(doc._id ?? '');
      const docIssues = validateDocument(collection.name, doc);
      if (docIssues.length > 0) {
        invalidDocuments += 1;
        if (issues.length < 25) issues.push(`${id}: ${docIssues.join('; ')}`);
        if (collection.name === 'daily_inventory_entries') {
          if (doc.quantity !== undefined && (!Number.isInteger(doc.quantity) || doc.quantity < 0)) {
            preview.totals.invalidQuantities += 1;
          }
          if (doc.pricingStatus === 'missing_rate' && doc.quantity > 0) preview.totals.missingRates += 1;
        }
      }
      if (byId.has(id)) {
        duplicateIds += 1;
        if (issues.length < 25) issues.push(`Duplicate _id within file: ${id}`);
      }
      byId.add(id);
      const key = uniqueKey(collection.name, doc);
      if (key && byUnique.has(key)) {
        duplicateIds += 1;
        if (issues.length < 25) issues.push(`Duplicate unique record within file: ${key}`);
      }
      if (key) byUnique.add(key);

      const isExisting = existingIds.has(id) || (key ? existingKeys.has(key) : false);
      if (isExisting) existingCount += 1;
      else newCount += 1;
    }

    preview.collections.push({
      name: collection.name,
      documentCount: collection.documents.length,
      existingCount,
      newCount,
      duplicateIds,
      invalidDocuments,
      sample: collection.documents.slice(0, 3).map((doc) => {
        const clone = { ...doc };
        delete clone.passwordHash;
        return clone;
      }),
      issues,
    });
    preview.totals.documents += collection.documents.length;
    preview.totals.newDocuments += newCount;
    preview.totals.duplicateDocuments += existingCount + duplicateIds;
    preview.totals.invalidDocuments += invalidDocuments;
  }

  if (parsed.manifest?.schemaVersion && Number(parsed.manifest.schemaVersion) > SCHEMA_VERSION) {
    preview.errors.push(
      `Backup schema version ${parsed.manifest.schemaVersion} is newer than this application (${SCHEMA_VERSION}).`,
    );
    preview.canImport = false;
  }
  if (mode === 'replace') {
    preview.warnings.push(
      'Replace mode permanently deletes existing documents in the selected collections after confirmation.',
    );
  }
  if (preview.totals.invalidDocuments > 0) {
    preview.warnings.push(`${preview.totals.invalidDocuments} document(s) have validation issues.`);
  }
  if (preview.totals.missingRates > 0) {
    preview.warnings.push(
      `${preview.totals.missingRates} imported daily entries have positive quantities with missing rates. Invoice readiness will remain false.`,
    );
  }
  preview.canImport = preview.canImport && preview.errors.length === 0;
  return preview;
}

// ---------------------------------------------------------------------------
// Execute import / restore
// ---------------------------------------------------------------------------

export type ImportMode = 'insert' | 'update' | 'merge' | 'replace';

export async function executeImport(input: {
  parsed: ParsedImport;
  mode: ImportMode;
  dryRun: boolean;
  selectedCollections?: string[];
  actor?: AuditActor;
  operation?: 'import' | 'restore';
  replaceConfirmed?: boolean;
}): Promise<Record<string, any>> {
  const { parsed, mode, dryRun } = input;
  const started = Date.now();
  const selected = new Set(input.selectedCollections?.length ? input.selectedCollections : parsed.collections.map((c) => c.name));
  const collections = parsed.collections.filter((c) => selected.has(c.name));
  if (collections.length === 0) throw badRequest('No importable collections were selected.');
  if (mode === 'replace' && !input.replaceConfirmed && !dryRun) {
    throw badRequest('Replace mode requires explicit confirmation.');
  }
  for (const c of collections) {
    if (!COLLECTION_MODELS[c.name]) throw badRequest(`Collection "${c.name}" is not allow-listed.`);
  }

  const history = dryRun
    ? null
    : await ImportExportHistory.create({
        _id: newId('io'),
        organizationId: env.organisationId,
        operation: input.operation ?? 'import',
        format: parsed.format,
        filename: parsed.filename,
        mode,
        status: 'running',
        startedAt: new Date(),
        collections: collections.map((c) => c.name),
        userId: input.actor?.id ?? '',
        userName: input.actor?.name ?? '',
        summary: {},
      });

  const summary: Record<string, any> = {
    dryRun,
    mode,
    filename: parsed.filename,
    format: parsed.format,
    collections: {},
    totals: { processed: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, deleted: 0 },
    errors: [] as Array<Record<string, unknown>>,
  };

  try {
    for (const collection of collections) {
      const model = COLLECTION_MODELS[collection.name];
      const stats = { processed: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, deleted: 0 };
      const docs = collection.documents;

      if (dryRun) {
        const preview = await inspectImport({ ...parsed, collections: [collection] }, mode);
        summary.collections[collection.name] = {
          ...stats,
          processed: docs.length,
          inserted: mode === 'insert' || mode === 'merge' ? preview.totals.newDocuments : 0,
          updated: mode === 'update' || mode === 'merge' ? preview.totals.documents - preview.totals.newDocuments : 0,
          skipped: mode === 'insert' ? preview.totals.documents - preview.totals.newDocuments : 0,
          preview: preview.collections[0],
        };
        summary.totals.processed += docs.length;
        continue;
      }

      if (mode === 'replace') {
        // Validate the whole collection before deleting anything so a bad file
        // can never leave an empty collection behind.
        const invalid = docs
          .map((doc) => ({ doc, issues: validateDocument(collection.name, doc) }))
          .filter((entry) => entry.issues.length > 0);
        if (invalid.length > 0) {
          throw unprocessable(
            `Replace aborted: ${invalid.length} document(s) in "${collection.name}" failed validation. No data was deleted.`,
            invalid.slice(0, 20).map((entry) => ({
              documentId: entry.doc._id,
              issues: entry.issues,
            })),
          );
        }
        const deleted = await model.deleteMany({}).exec();
        stats.deleted = deleted.deletedCount ?? 0;
      }

      const ids = docs.map((d) => String(d._id));
      const existingIds = mode === 'replace' ? new Set<string>() : await existingIdsFor(collection.name, ids);
      const operations: any[] = [];

      for (const doc of docs) {
        const validation = validateDocument(collection.name, doc);
        if (validation.length > 0) {
          stats.failed += 1;
          if (summary.errors.length < 200) {
            summary.errors.push({ collection: collection.name, documentId: doc._id, message: validation.join('; ') });
          }
          continue;
        }
        const exists = existingIds.has(String(doc._id));
        if (mode === 'insert' && exists) {
          stats.skipped += 1;
          continue;
        }
        if (mode === 'update' && !exists) {
          stats.skipped += 1;
          continue;
        }
        const payload = { ...doc };
        delete payload.passwordHash; // never overwrite credentials through bulk import
        if (collection.name === 'users') {
          // Users require passwordHash for creation; existing users keep theirs.
          if (exists) {
            delete payload.passwordHash;
          } else if (!doc.passwordHash) {
            stats.failed += 1;
            summary.errors.push({
              collection: collection.name,
              documentId: doc._id,
              message: 'A new user requires passwordHash.',
            });
            continue;
          } else {
            payload.passwordHash = doc.passwordHash;
          }
        }
        operations.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: { ...payload, updatedAt: new Date() },
              $setOnInsert: { _id: doc._id, createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date() },
            },
            upsert: mode !== 'update',
          },
        });
      }

      for (const ops of chunk(operations, 500)) {
        try {
          const result = await model.bulkWrite(ops, { ordered: false });
          stats.inserted += result.upsertedCount ?? 0;
          stats.updated += result.modifiedCount ?? 0;
          stats.processed += result.matchedCount + (result.upsertedCount ?? 0);
        } catch (error: any) {
          // A duplicate key on one document must not hide the rest.
          const writeErrors = error?.writeErrors ?? error?.result?.writeErrors ?? [];
          if (Array.isArray(writeErrors) && writeErrors.length > 0) {
            stats.failed += writeErrors.length;
            for (const writeError of writeErrors.slice(0, 20)) {
              summary.errors.push({
                collection: collection.name,
                message: writeError.errmsg ?? writeError.message ?? String(writeError),
              });
            }
            const successful = ops.length - writeErrors.length;
            stats.processed += successful;
          } else {
            throw error;
          }
        }
      }
      summary.collections[collection.name] = stats;
      summary.totals.processed += stats.processed;
      summary.totals.inserted += stats.inserted;
      summary.totals.updated += stats.updated;
      summary.totals.skipped += stats.skipped;
      summary.totals.failed += stats.failed;
      summary.totals.deleted += stats.deleted;
    }

    // Rebuild derived monthly summaries for every month touched. Summaries in
    // the import are informational only; entries remain the source of truth.
    const touchedMonths = new Set<string>();
    for (const collection of collections) {
      if (collection.name === 'daily_inventory_entries' || collection.name === 'monthly_reports') {
        for (const doc of collection.documents) {
          if (doc.monthKey) touchedMonths.add(String(doc.monthKey));
          if (doc.serviceDate) touchedMonths.add(String(doc.serviceDate).slice(0, 7));
        }
      }
    }
    if (!dryRun) {
      for (const monthKey of touchedMonths) {
        if (!isValidMonthKey(monthKey)) continue;
        try {
          await rebuildSummary(monthKey, input.actor);
        } catch (error: any) {
          summary.errors.push({ collection: 'monthly_reports', message: `Failed to rebuild ${monthKey}: ${error.message}` });
        }
      }
      // Verify persisted counts where possible.
      summary.verification = {};
      for (const collection of collections) {
        const count = await COLLECTION_MODELS[collection.name].countDocuments({});
        summary.verification[collection.name] = { databaseCount: count };
      }
    }

    summary.monthsRebuilt = [...touchedMonths].sort();
    summary.durationMs = Date.now() - started;
    summary.status = summary.totals.failed > 0 ? 'partial' : 'success';

    if (history) {
      history.status = summary.status;
      history.completedAt = new Date();
      history.durationMs = Date.now() - started;
      history.recordsProcessed = summary.totals.processed;
      history.recordsInserted = summary.totals.inserted;
      history.recordsUpdated = summary.totals.updated;
      history.recordsSkipped = summary.totals.skipped;
      history.recordsDeleted = summary.totals.deleted;
      history.recordsFailed = summary.totals.failed;
      history.errors = summary.errors.slice(0, 200).map((e: any) => ({
        collection: e.collection ?? '',
        message: e.message ?? String(e),
        documentId: e.documentId ?? null,
      }));
      history.summary = summary;
      await history.save();
    }

    await writeAudit({
      actor: input.actor,
      action: dryRun ? 'IMPORT_DRY_RUN' : 'IMPORT_EXECUTED',
      entityType: 'import_export',
      entityId: history?._id ?? '',
      description: `${dryRun ? 'Dry run' : 'Import'} ${parsed.filename}: ${summary.totals.processed} processed, ${summary.totals.failed} failed.`,
      changes: { mode, collections: collections.map((c) => c.name) },
    });
    return summary;
  } catch (error: any) {
    if (history) {
      history.status = 'failed';
      history.completedAt = new Date();
      history.durationMs = Date.now() - started;
      history.errors = [{ collection: '', message: error.message ?? String(error) }];
      history.summary = summary;
      await history.save();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Full backup
// ---------------------------------------------------------------------------

export async function createBackup(
  actor?: AuditActor,
  options: { operation?: 'backup' | 'restore'; reason?: string } = {},
): Promise<{ buffer: Buffer; filename: string; manifest: Record<string, any>; path?: string }> {
  const started = Date.now();
  const zip = new AdmZip();
  const manifest: Record<string, any> = {
    application: 'Camelot Beach Hotel Laundry Reporting',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportDate: new Date().toISOString(),
    database: env.mongoUri.replace(/\/\/[^@]*@/, '//***@').split('?')[0],
    timezone: env.timezone,
    currency: env.currency,
    fullBackup: true,
    collections: {},
    checksums: {},
  };

  for (const name of ALLOWED_COLLECTIONS) {
    const docs = await COLLECTION_MODELS[name].find({}).lean();
    // Never export password hashes in a human-downloadable backup? They are
    // required for a faithful restore, so they are included. The archive is
    // protected by authentication and should be stored securely.
    const serialized = docs.map((doc) => toPlainJson(doc));
    const text = JSON.stringify(serialized, null, 2);
    const entryName = `collections/${name}.json`;
    zip.addFile(entryName, Buffer.from(text, 'utf8'));
    manifest.collections[name] = docs.length;
    manifest.checksums[entryName] = sha256(text);
  }

  manifest.totalDocuments = Object.values(manifest.collections).reduce((s: number, v) => s + Number(v), 0);
  const manifestText = JSON.stringify(manifest, null, 2);
  zip.addFile('manifest.json', Buffer.from(manifestText, 'utf8'));
  zip.addFile(
    'README.txt',
    Buffer.from(
      [
        'Camelot Beach Hotel — Laundry Reporting database backup',
        `Exported: ${manifest.exportDate}`,
        `Application version: ${APP_VERSION}`,
        `Schema version: ${SCHEMA_VERSION}`,
        '',
        'Restore through the application Import / Export page.',
        'Collections are stored as JSON arrays under collections/.',
        'manifest.json contains document counts and SHA-256 checksums.',
      ].join('\n'),
      'utf8',
    ),
  );

  const buffer = zip.toBuffer();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${options.operation === 'restore' ? 'safety' : 'backup'}-camelot-${stamp}.zip`;

  let savedPath: string | undefined;
  try {
    await mkdir(env.backupDir, { recursive: true });
    savedPath = path.join(env.backupDir, filename);
    await writeFile(savedPath, buffer);
  } catch {
    savedPath = undefined;
  }

  if (options.operation !== 'restore') {
    await ImportExportHistory.create({
      _id: newId('io'),
      organizationId: env.organisationId,
      operation: options.operation ?? 'backup',
      format: 'Application backup ZIP',
      filename,
      mode: 'full',
      status: 'success',
      startedAt: new Date(started),
      completedAt: new Date(),
      durationMs: Date.now() - started,
      collections: ALLOWED_COLLECTIONS,
      recordsProcessed: manifest.totalDocuments,
      userId: actor?.id ?? '',
      userName: actor?.name ?? '',
      summary: { totalDocuments: manifest.totalDocuments, savedPath, reason: options.reason ?? '' },
      manifest,
    });
  }

  return { buffer, filename, manifest, path: savedPath };
}

export async function inspectBackup(buffer: Buffer, filename: string) {
  const parsed = await parseImportBuffer(buffer, filename);
  if (!parsed.manifest || parsed.rawFormat !== 'zip') {
    throw badRequest('This is not a valid application backup archive.');
  }
  const preview = await inspectImport(parsed, 'restore');
  return { parsed, preview, manifest: parsed.manifest };
}

export async function restoreBackup(input: {
  buffer: Buffer;
  filename: string;
  mode: 'merge' | 'replace';
  confirm: boolean;
  actor?: AuditActor;
}): Promise<Record<string, any>> {
  if (!input.confirm) throw badRequest('Restore requires explicit confirmation.');
  const inspected = await inspectBackup(input.buffer, input.filename);
  if (!inspected.preview.canImport) {
    throw badRequest('The backup failed validation and was not restored.', inspected.preview.errors);
  }

  const safety = await createBackup(input.actor, { operation: 'restore', reason: 'Automatic safety backup before restore' });
  try {
    const result = await executeImport({
      parsed: inspected.parsed,
      mode: input.mode,
      dryRun: false,
      actor: input.actor,
      operation: 'restore',
      replaceConfirmed: input.mode === 'replace',
    });
    return {
      ...result,
      safetyBackup: { filename: safety.filename, path: safety.path ?? null },
      manifest: inspected.manifest,
    };
  } catch (error: any) {
    // Best-effort rollback to the safety backup.
    let rolledBack = false;
    try {
      const parsedSafety = await parseImportBuffer(safety.buffer, safety.filename);
      await executeImport({
        parsed: parsedSafety,
        mode: 'replace',
        dryRun: false,
        actor: input.actor,
        operation: 'restore',
        replaceConfirmed: true,
      });
      rolledBack = true;
    } catch {
      rolledBack = false;
    }
    await ImportExportHistory.create({
      _id: newId('io'),
      organizationId: env.organisationId,
      operation: 'restore',
      format: 'Application backup ZIP',
      filename: input.filename,
      mode: input.mode,
      status: 'failed',
      startedAt: new Date(),
      completedAt: new Date(),
      recordsProcessed: 0,
      errors: [{ message: error.message ?? String(error), collection: '' }],
      userId: input.actor?.id ?? '',
      userName: input.actor?.name ?? '',
      summary: {
        safetyBackup: safety.filename,
        rolledBack,
        recovery:
          'A safety backup was created before the restore. If the rollback did not complete, restore the safety backup from the Import / Export page.',
      },
    });
    throw unprocessable(
      rolledBack
        ? 'Restore failed and the previous data was restored from the automatic safety backup.'
        : 'Restore failed. Restore the automatic safety backup to recover the previous data.',
      { safetyBackup: safety.filename, rolledBack, cause: error.message },
    );
  }
}

// ---------------------------------------------------------------------------
// Selective exports
// ---------------------------------------------------------------------------

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))].join('\n');
}

export async function exportCollection(
  collection: string,
  format: 'json' | 'csv' | 'xlsx',
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  if (!COLLECTION_MODELS[collection]) throw badRequest(`Collection "${collection}" is not allow-listed.`);
  const docs = await COLLECTION_MODELS[collection].find({}).lean();
  const filenameBase = `${collection}-${new Date().toISOString().slice(0, 10)}`;
  if (format === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(docs.map(toPlainJson), null, 2)),
      filename: `${filenameBase}.json`,
      contentType: 'application/json',
    };
  }
  if (format === 'csv') {
    return {
      buffer: Buffer.from(toCsv(docs as Array<Record<string, unknown>>)),
      filename: `${filenameBase}.csv`,
      contentType: 'text/csv',
    };
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(collection.slice(0, 31));
  const headers = [...new Set(docs.flatMap((d: any) => Object.keys(d)))];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  for (const doc of docs as any[]) {
    sheet.addRow(headers.map((h) => {
      const value = doc[h];
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    }));
  }
  sheet.columns?.forEach((col) => (col.width = 20));
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    filename: `${filenameBase}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportMonth(
  monthKey: string,
  format: 'json' | 'csv' | 'xlsx' | 'pdf',
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  if (!isValidMonthKey(monthKey)) throw badRequest('Month must be YYYY-MM.');
  getMonthMeta(monthKey);
  const base = `camelot-${monthKey}`;
  if (format === 'pdf') {
    return {
      buffer: await buildReportPdf(monthKey),
      filename: `${base}-report.pdf`,
      contentType: 'application/pdf',
    };
  }
  if (format === 'xlsx') {
    return {
      buffer: await buildReportExcel(monthKey),
      filename: `${base}-report.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  const report = await MonthlyReport.findOne({ monthKey }).lean();
  const entries = report
    ? await DailyInventoryEntry.find({ reportId: report._id }).select({ _id: 0 }).lean()
    : [];
  const summary = await MonthlyReportSummary.findOne({ monthKey }).lean();
  if (format === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(toPlainJson({ monthKey, report, entries, summary }), null, 2)),
      filename: `${base}.json`,
      contentType: 'application/json',
    };
  }
  return {
    buffer: Buffer.from(toCsv(entries as Array<Record<string, unknown>>)),
    filename: `${base}-entries.csv`,
    contentType: 'text/csv',
  };
}

export async function exportSection(
  sectionCode: string,
  format: 'json' | 'csv' | 'xlsx',
  monthKey?: string,
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const entries = await DailyInventoryEntry.find({
    sectionCode,
    ...(monthKey ? { serviceDate: { $regex: `^${monthKey}-` } } : {}),
  }).lean();
  const base = `section-${sectionCode.toLowerCase()}-${monthKey ?? 'all'}`;
  if (format === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(toPlainJson(entries), null, 2)),
      filename: `${base}.json`,
      contentType: 'application/json',
    };
  }
  if (format === 'csv') {
    return {
      buffer: Buffer.from(toCsv(entries as Array<Record<string, unknown>>)),
      filename: `${base}.csv`,
      contentType: 'text/csv',
    };
  }
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sectionCode.slice(0, 31));
  sheet.columns = [
    { header: 'Date', key: 'serviceDate', width: 13 },
    { header: 'Item Code', key: 'itemCode', width: 16 },
    { header: 'Item', key: 'itemName', width: 30 },
    { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Rate (LKR)', key: 'unitRateLkr', width: 13 },
    { header: 'Amount (LKR)', key: 'lineAmountLkr', width: 15 },
    { header: 'Pricing Status', key: 'pricingStatus', width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const entry of entries as any[]) sheet.addRow(entry);
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    filename: `${base}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportInvoices(format: 'json' | 'csv' | 'xlsx' | 'pdf', invoiceId?: string) {
  if (invoiceId) {
    const invoice = await Invoice.findById(invoiceId).lean();
    if (!invoice) throw notFound('Invoice not found.');
    if (format === 'pdf') {
      return {
        buffer: await buildInvoicePdf(invoice as any),
        filename: `${invoice.invoiceNumber}.pdf`,
        contentType: 'application/pdf',
      };
    }
    if (format === 'xlsx') {
      return {
        buffer: await buildInvoiceExcel(invoice as any),
        filename: `${invoice.invoiceNumber}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    if (format === 'json') {
      return {
        buffer: Buffer.from(JSON.stringify(toPlainJson(invoice), null, 2)),
        filename: `${invoice.invoiceNumber}.json`,
        contentType: 'application/json',
      };
    }
    return {
      buffer: Buffer.from(toCsv([invoice as Record<string, unknown>])),
      filename: `${invoice.invoiceNumber}.csv`,
      contentType: 'text/csv',
    };
  }
  const invoices = await Invoice.find({}).lean();
  if (format === 'json') {
    return {
      buffer: Buffer.from(JSON.stringify(toPlainJson(invoices), null, 2)),
      filename: 'invoices.json',
      contentType: 'application/json',
    };
  }
  if (format === 'csv') {
    return {
      buffer: Buffer.from(toCsv(invoices as Array<Record<string, unknown>>)),
      filename: 'invoices.csv',
      contentType: 'text/csv',
    };
  }
  return exportCollection('invoices', 'xlsx');
}

export async function getOperationHistory(limit = 100) {
  return ImportExportHistory.find({ organizationId: env.organisationId })
    .sort({ startedAt: -1 })
    .limit(Math.min(limit, 500))
    .lean();
}
