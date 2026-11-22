import { addDays, format, parseISO } from 'date-fns';
import { env } from '../config/env';
import { todayInColombo } from '../lib/dates';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors';
import { newId } from '../lib/ids';
import { addMoney, percentOf, subtractMoney } from '../lib/money';
import { Counter } from '../models/Counter';
import { Invoice, InvoiceDoc } from '../models/Invoice';
import { MonthlyReport } from '../models/MonthlyReport';
import { assertInvoiceReady, ensureCustomer, loadReportContext, rebuildSummary, resolveSettings } from './reportService';
import { AuditActor, writeAudit } from './auditService';

const ACTIVE_INVOICE_STATUSES = ['draft', 'reviewed', 'finalized', 'paid'] as const;

async function nextInvoiceNumber(prefix: string, monthKey: string): Promise<string> {
  const year = monthKey.slice(0, 4);
  const key = `invoice-${prefix}-${year}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `${prefix}-${monthKey.replace('-', '')}-${String(counter.seq).padStart(4, '0')}`;
}

function buildLines(context: Awaited<ReturnType<typeof loadReportContext>>) {
  const byCategory = new Map<string, typeof context.entries>();
  for (const entry of context.entries) {
    if (entry.quantity <= 0) continue;
    const code = entry.billingCategoryCode ?? 'UNCATEGORISED';
    const list = byCategory.get(code) ?? [];
    list.push(entry);
    byCategory.set(code, list);
  }
  const ordered = context.calculation.categoryTotals.filter(
    (c) => c.billingCategoryCode && byCategory.has(c.billingCategoryCode) && c.totalQuantity > 0,
  );
  const known = new Set(ordered.map((c) => c.billingCategoryCode));
  for (const code of byCategory.keys()) {
    if (!known.has(code)) {
      ordered.push({
        billingCategoryCode: code,
        billingCategoryName: code === 'UNCATEGORISED' ? 'Uncategorised' : code,
        sortOrder: 9999,
        totalQuantity: byCategory.get(code)!.reduce((s, e) => s + e.quantity, 0),
        totalAmountLkr: addMoney(...byCategory.get(code)!.map((e) => e.lineAmountLkr ?? 0)),
        unpricedQuantity: byCategory
          .get(code)!
          .filter((e) => e.unitRateLkr === null)
          .reduce((s, e) => s + e.quantity, 0),
        itemCount: 0,
        hasActivity: true,
        includeOnInvoice: true,
        weightedAverageRateLkr: null,
      });
    }
  }
  return ordered.map((category, index) => {
    const categoryEntries = byCategory.get(category.billingCategoryCode!) ?? [];
    const items = new Map<string, typeof categoryEntries>();
    for (const entry of categoryEntries) {
      const list = items.get(entry.itemId) ?? [];
      list.push(entry);
      items.set(entry.itemId, list);
    }
    return {
      lineNumber: index + 1,
      billingCategoryCode: category.billingCategoryCode,
      billingCategoryName: category.billingCategoryName,
      description: category.billingCategoryName,
      quantity: category.totalQuantity,
      unitRateLkr: category.weightedAverageRateLkr,
      subtotalLkr: category.totalAmountLkr,
      unpricedQuantity: category.unpricedQuantity,
      itemBreakdown: [...items.entries()].map(([itemId, list]) => {
        const first = list[0];
        const quantity = list.reduce((s, e) => s + e.quantity, 0);
        const amount = addMoney(...list.map((e) => e.lineAmountLkr ?? 0));
        return {
          itemId,
          itemCode: first.itemCode,
          itemName: first.itemName,
          quantity,
          unitRateLkr: quantity > 0 ? Number((amount / quantity).toFixed(4)) : first.unitRateLkr,
          amountLkr: amount,
          pricingStatus: list.every((e) => e.pricingStatus === 'priced') ? 'priced' : 'missing_rate',
        };
      }),
    };
  });
}

async function buildInvoicePayload(
  monthKey: string,
  actor?: AuditActor,
  options: { parentInvoiceId?: string | null; revisionNumber?: number; revisionReason?: string } = {},
) {
  const context = await loadReportContext(monthKey);
  await rebuildSummary(monthKey, actor);
  assertInvoiceReady(context.calculation, context.report);
  const settings = await resolveSettings();
  const customer = await ensureCustomer();
  const lines = buildLines(context);
  const subtotal = addMoney(...lines.map((l) => l.subtotalLkr));
  let adjustments: Array<{
    type: 'discount' | 'surcharge' | 'credit' | 'rounding';
    description: string;
    amountLkr: number;
    createdAt: Date;
    createdBy: string;
  }> = [];

  if (options.parentInvoiceId) {
    const parent = await Invoice.findById(options.parentInvoiceId).lean();
    if (!parent) throw notFound('Original invoice not found.');
    adjustments = [
      {
        type: 'credit',
        description: `Credit for ${parent.invoiceNumber} (superseded by this revision)`,
        amountLkr: -Math.abs(parent.totals.totalLkr ?? 0),
        createdAt: new Date(),
        createdBy: actor?.id ?? '',
      },
    ];
  }

  const adjustmentsTotal = addMoney(...adjustments.map((a) => a.amountLkr));
  const taxableAmount = addMoney(subtotal, adjustmentsTotal);
  const taxEnabled = Boolean(settings.tax?.enabled);
  const taxRate = taxEnabled ? Number(settings.tax?.ratePercent ?? 0) : 0;
  const taxAmount = taxEnabled ? percentOf(Math.max(taxableAmount, 0), taxRate) : 0;
  const total = addMoney(taxableAmount, taxAmount);
  const invoiceDate = todayInColombo();
  const termsDays = Number(settings.invoice?.paymentTermsDays ?? 30);
  const prefix = (settings.invoice?.prefix || 'CBH').toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const invoiceNumber = await nextInvoiceNumber(prefix, monthKey);

  return {
    _id: newId('invoice'),
    organizationId: env.organisationId,
    invoiceNumber,
    customerId: customer._id,
    customerName: customer.name,
    customerSnapshot: {
      name: customer.name,
      address: customer.address,
      city: customer.city,
      country: customer.country,
      contactPerson: customer.contactPerson,
      phone: customer.phone,
      email: customer.email,
      taxNumber: customer.taxNumber,
    },
    serviceProviderSnapshot: {
      name: settings.serviceProvider?.name || 'Love Laundry',
      address: settings.serviceProvider?.address ?? '',
      phone: settings.serviceProvider?.phone ?? '',
      email: settings.serviceProvider?.email ?? '',
      website: settings.serviceProvider?.website ?? '',
      taxNumber: settings.serviceProvider?.taxNumber ?? '',
      logoUrl: settings.serviceProvider?.logoUrl ?? '',
    },
    reportId: context.report._id,
    monthKey,
    periodStart: context.report.periodStart,
    periodEnd: context.report.periodEnd,
    invoiceDate,
    dueDate: format(addDays(parseISO(invoiceDate), termsDays), 'yyyy-MM-dd'),
    currency: 'LKR',
    status: 'draft' as const,
    revisionNumber: options.revisionNumber ?? 0,
    parentInvoiceId: options.parentInvoiceId ?? null,
    revisionReason: options.revisionReason ?? '',
    lines,
    adjustments,
    payment: {
      bankName: settings.bank?.bankName ?? '',
      branch: settings.bank?.branch ?? '',
      accountName: settings.bank?.accountName ?? '',
      accountNumber: settings.bank?.accountNumber ?? '',
      swiftCode: settings.bank?.swiftCode ?? '',
      terms: settings.invoice?.paymentTermsText ?? '',
    },
    notes: settings.invoice?.defaultNotes ?? '',
    totals: {
      subtotalLkr: subtotal,
      adjustmentsTotalLkr: adjustmentsTotal,
      taxableAmountLkr: taxableAmount,
      taxRatePercent: taxRate,
      taxLabel: taxEnabled ? settings.tax?.label || 'Tax' : '',
      taxAmountLkr: taxAmount,
      totalLkr: total,
      unpricedQuantity: context.calculation.totals.unpricedQuantity,
    },
    snapshot: {
      reportTotals: context.report.totals,
      sectionTotals: context.calculation.sectionTotals,
      categoryTotals: context.calculation.categoryTotals,
      checksum: context.calculation.checksum,
      entryCount: context.calculation.totals.entryCount,
      customerId: customer._id,
      reportStatus: context.report.status,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: actor?.id ?? '',
    reviewedAt: null,
    reviewedBy: null,
    finalizedAt: null,
    finalizedBy: null,
    paidAt: null,
    paidBy: null,
    voidedAt: null,
    voidReason: '',
  };
}

export async function createInvoice(monthKey: string, actor?: AuditActor): Promise<InvoiceDoc> {
  const existing = await Invoice.findOne({
    organizationId: env.organisationId,
    monthKey,
    status: { $in: ACTIVE_INVOICE_STATUSES },
    parentInvoiceId: null,
  }).lean();
  if (existing) {
    throw conflict(`An invoice already exists for ${monthKey}: ${existing.invoiceNumber}.`, {
      invoiceId: existing._id,
      invoiceNumber: existing.invoiceNumber,
    });
  }
  const payload = await buildInvoicePayload(monthKey, actor);
  const invoice = await Invoice.create(payload);
  const report = await MonthlyReport.findById(payload.reportId);
  if (report) {
    report.invoiceStatus = 'draft';
    report.updatedAt = new Date();
    await report.save();
  }
  await writeAudit({
    actor,
    action: 'INVOICE_CREATED',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `Draft invoice ${invoice.invoiceNumber} created for ${monthKey}.`,
  });
  return invoice;
}

export async function refreshInvoice(invoiceId: string, actor?: AuditActor): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (!['draft', 'reviewed'].includes(invoice.status)) {
    throw conflict('Only draft or reviewed invoices can be refreshed.');
  }
  if (invoice.parentInvoiceId) {
    throw conflict('Revision drafts must be recreated from the original invoice.');
  }
  const payload = await buildInvoicePayload(invoice.monthKey, actor);
  const preservedId = invoice._id;
  const preservedNumber = invoice.invoiceNumber;
  const preservedCreatedAt = invoice.createdAt;
  const preservedCreatedBy = invoice.createdBy;
  const preservedStatus = invoice.status;
  Object.assign(invoice, payload, {
    _id: preservedId,
    invoiceNumber: preservedNumber,
    createdAt: preservedCreatedAt,
    createdBy: preservedCreatedBy,
    status: preservedStatus,
  });
  invoice.updatedAt = new Date();
  await invoice.save();
  return invoice;
}

export async function reviewInvoice(invoiceId: string, actor?: AuditActor): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status !== 'draft') throw conflict('Only a draft invoice can be marked as reviewed.');
  if (invoice.totals.unpricedQuantity > 0) {
    throw unprocessable('The invoice contains unpriced quantities. Resolve missing rates first.');
  }
  invoice.status = 'reviewed';
  invoice.reviewedAt = new Date();
  invoice.reviewedBy = actor?.id ?? '';
  invoice.updatedAt = new Date();
  await invoice.save();
  const report = await MonthlyReport.findById(invoice.reportId);
  if (report && !invoice.parentInvoiceId) {
    report.invoiceStatus = 'reviewed';
    report.updatedAt = new Date();
    await report.save();
  }
  await writeAudit({
    actor,
    action: 'INVOICE_REVIEWED',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `${invoice.invoiceNumber} marked reviewed.`,
  });
  return invoice;
}

export async function finalizeInvoice(invoiceId: string, actor?: AuditActor): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status !== 'reviewed') throw conflict('Only a reviewed invoice can be finalized.');
  // Re-validate the report at finalization time so a rate cannot be removed
  // between review and finalization.
  const context = await loadReportContext(invoice.monthKey);
  assertInvoiceReady(context.calculation, context.report);
  invoice.status = 'finalized';
  invoice.finalizedAt = new Date();
  invoice.finalizedBy = actor?.id ?? '';
  invoice.updatedAt = new Date();
  invoice.snapshot = {
    ...(invoice.snapshot as Record<string, unknown>),
    finalizedChecksum: context.calculation.checksum,
    finalizedEntryCount: context.calculation.totals.entryCount,
    finalizedAt: new Date().toISOString(),
  };
  await invoice.save();
  if (!invoice.parentInvoiceId) {
    const report = await MonthlyReport.findById(invoice.reportId);
    if (report) {
      report.invoiceStatus = 'finalized';
      if (report.status !== 'closed') report.status = 'invoiced';
      report.updatedAt = new Date();
      await report.save();
    }
  }
  await writeAudit({
    actor,
    action: 'INVOICE_FINALIZED',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `${invoice.invoiceNumber} finalized for LKR ${invoice.totals.totalLkr}.`,
  });
  return invoice;
}

export async function markInvoicePaid(
  invoiceId: string,
  input: { paidAt?: string; note?: string },
  actor?: AuditActor,
): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (invoice.status !== 'finalized') throw conflict('Only a finalized invoice can be marked paid.');
  const paidDate = input.paidAt ?? todayInColombo();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) throw badRequest('paidAt must be YYYY-MM-DD.');
  invoice.status = 'paid';
  invoice.paidAt = parseISO(paidDate);
  invoice.paidBy = actor?.id ?? '';
  if (input.note) invoice.notes = `${invoice.notes ? `${invoice.notes}\n` : ''}${input.note}`;
  invoice.updatedAt = new Date();
  await invoice.save();
  if (!invoice.parentInvoiceId) {
    const report = await MonthlyReport.findById(invoice.reportId);
    if (report) {
      report.invoiceStatus = 'paid';
      report.updatedAt = new Date();
      await report.save();
    }
  }
  await writeAudit({
    actor,
    action: 'INVOICE_PAID',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `${invoice.invoiceNumber} marked paid on ${paidDate}.`,
  });
  return invoice;
}

export async function voidInvoice(invoiceId: string, reason: string, actor?: AuditActor): Promise<InvoiceDoc> {
  if (!reason || reason.trim().length < 5) throw badRequest('A void reason of at least 5 characters is required.');
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (!['draft', 'reviewed', 'finalized', 'paid'].includes(invoice.status)) {
    throw conflict('This invoice cannot be voided.');
  }
  invoice.status = 'void';
  invoice.voidedAt = new Date();
  invoice.voidReason = reason.trim();
  invoice.updatedAt = new Date();
  await invoice.save();
  if (!invoice.parentInvoiceId) {
    const report = await MonthlyReport.findById(invoice.reportId);
    if (report) {
      report.invoiceStatus = 'void';
      if (report.status === 'invoiced' || report.status === 'closed') report.status = 'reviewed';
      report.updatedAt = new Date();
      await report.save();
    }
  }
  await writeAudit({
    actor,
    action: 'INVOICE_VOIDED',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `${invoice.invoiceNumber} voided: ${reason}`,
  });
  return invoice;
}

export async function createRevision(
  invoiceId: string,
  reason: string,
  actor?: AuditActor,
): Promise<InvoiceDoc> {
  if (!reason || reason.trim().length < 5) throw badRequest('A revision reason of at least 5 characters is required.');
  const parent = await Invoice.findById(invoiceId);
  if (!parent) throw notFound('Invoice not found.');
  if (!['finalized', 'paid'].includes(parent.status)) {
    throw conflict('Only a finalized or paid invoice can be revised.');
  }
  const existingDraft = await Invoice.findOne({
    parentInvoiceId: parent._id,
    status: { $in: ['draft', 'reviewed'] },
  });
  if (existingDraft) {
    throw conflict(`A revision draft already exists: ${existingDraft.invoiceNumber}.`, {
      invoiceId: existingDraft._id,
    });
  }
  const payload = await buildInvoicePayload(parent.monthKey, actor, {
    parentInvoiceId: parent._id,
    revisionNumber: (parent.revisionNumber ?? 0) + 1,
    revisionReason: reason.trim(),
  });
  const revision = await Invoice.create(payload);
  await writeAudit({
    actor,
    action: 'INVOICE_REVISION_CREATED',
    entityType: 'invoice',
    entityId: revision._id,
    description: `Revision ${revision.invoiceNumber} created for ${parent.invoiceNumber}: ${reason}`,
  });
  return revision;
}

export async function updateInvoiceDraft(
  invoiceId: string,
  input: {
    notes?: string;
    dueDate?: string | null;
    adjustments?: Array<{ type: 'discount' | 'surcharge' | 'credit' | 'rounding'; description: string; amountLkr: number }>;
  },
  actor?: AuditActor,
): Promise<InvoiceDoc> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw notFound('Invoice not found.');
  if (!['draft', 'reviewed'].includes(invoice.status)) {
    throw conflict('Only draft or reviewed invoices can be edited. Finalized invoices are immutable.');
  }
  if (!['draft', 'reviewed'].includes(invoice.status)) throw conflict('Invoice is locked.');
  if (input.notes !== undefined) invoice.notes = input.notes;
  if (input.dueDate !== undefined) invoice.dueDate = input.dueDate;
  if (input.adjustments) {
    for (const adjustment of input.adjustments) {
      if (!Number.isFinite(adjustment.amountLkr)) throw badRequest('Adjustment amounts must be numbers.');
      if (!adjustment.description?.trim()) throw badRequest('Each adjustment needs a description.');
    }
    const preservedCredits = invoice.adjustments.filter((a) => a.type === 'credit');
    invoice.set('adjustments', [
      ...preservedCredits,
      ...input.adjustments.map((a) => ({
        type: a.type,
        description: a.description.trim(),
        amountLkr: a.amountLkr,
        createdAt: new Date(),
        createdBy: actor?.id ?? '',
      })),
    ]);
    const adjustmentsTotal = addMoney(...invoice.adjustments.map((a) => a.amountLkr));
    const taxable = addMoney(invoice.totals.subtotalLkr, adjustmentsTotal);
    const tax = invoice.totals.taxRatePercent > 0 ? percentOf(Math.max(taxable, 0), invoice.totals.taxRatePercent) : 0;
    invoice.totals.adjustmentsTotalLkr = adjustmentsTotal;
    invoice.totals.taxableAmountLkr = taxable;
    invoice.totals.taxAmountLkr = tax;
    invoice.totals.totalLkr = addMoney(taxable, tax);
  }
  invoice.updatedAt = new Date();
  await invoice.save();
  await writeAudit({
    actor,
    action: 'INVOICE_DRAFT_UPDATED',
    entityType: 'invoice',
    entityId: invoice._id,
    description: `Draft ${invoice.invoiceNumber} updated.`,
  });
  return invoice;
}

export async function listInvoices(filters: { monthKey?: string; status?: string } = {}) {
  const query: Record<string, unknown> = { organizationId: env.organisationId };
  if (filters.monthKey) query.monthKey = filters.monthKey;
  if (filters.status) query.status = filters.status;
  return Invoice.find(query).sort({ invoiceDate: -1, createdAt: -1 }).lean();
}

export async function getInvoice(invoiceId: string) {
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw notFound('Invoice not found.');
  return invoice;
}

export function invoiceSummaryTotals(invoice: InvoiceDoc) {
  return {
    subtotal: invoice.totals.subtotalLkr,
    adjustments: invoice.totals.adjustmentsTotalLkr,
    tax: invoice.totals.taxAmountLkr,
    total: invoice.totals.totalLkr,
    balance: subtractMoney(invoice.totals.totalLkr, 0),
  };
}
