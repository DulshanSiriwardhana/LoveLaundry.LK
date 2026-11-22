/**
 * Consolidated invoice records.
 *
 * The invoice generator prints a document but the platform has no persisted
 * invoice resource yet. Until there is a server endpoint, generated invoices
 * are recorded in this browser so the Invoices list can show what was created.
 * The record stores a snapshot of the bill rows that were on the invoice, so a
 * saved invoice can be reopened and reprinted without depending on live bill
 * data (which changes as payments come in).
 */
import type { Bill } from '../types/bill'

/** Full bill snapshot: the print templates need line items and addresses too. */
export type ConsolidatedInvoiceBill = Bill

export interface ConsolidatedInvoiceRecord {
  id: string
  invoiceNo: string
  createdAt: string
  dateFrom: string
  dateTo: string
  bills: ConsolidatedInvoiceBill[]
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  /** Print-template metadata kept so a saved invoice reprints identically. */
  clientAddress?: string
  managerSignature?: string
  includePrefix?: boolean
  bankDetails?: {
    bankName: string
    branch: string
    accountName: string
    accountNumber: string
  }
}

const STORAGE_KEY = 'lovelaundry.consolidated-invoices.v1'

const isRecord = (value: unknown): value is ConsolidatedInvoiceRecord => {
  if (!value || typeof value !== 'object') return false
  const r = value as Partial<ConsolidatedInvoiceRecord>
  return typeof r.id === 'string' && typeof r.invoiceNo === 'string' &&
    typeof r.createdAt === 'string' && Array.isArray(r.bills)
}

function readAll(): ConsolidatedInvoiceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord)
  } catch {
    return []
  }
}

/** Newest first. */
export function listConsolidatedInvoices(): ConsolidatedInvoiceRecord[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getConsolidatedInvoice(id: string): ConsolidatedInvoiceRecord | undefined {
  return readAll().find(r => r.id === id)
}

export function saveConsolidatedInvoice(record: ConsolidatedInvoiceRecord): void {
  const existing = readAll().filter(r => r.id !== record.id)
  existing.push(record)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    window.dispatchEvent(new Event('lovelaundry:consolidated-invoices'))
  } catch {
    // Browser storage can be unavailable (private mode / quota). Printing must
    // still work when the record cannot be kept.
  }
}

export function totalOf(record: ConsolidatedInvoiceRecord): number {
  return record.totalOutstanding
}

export function customersOf(record: ConsolidatedInvoiceRecord): string {
  const names = [...new Set(record.bills.map(b => b.client_name).filter(Boolean))]
  if (names.length === 0) return '—'
  return names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]} +${names.length - 2}`
}

/** Build a record from the current generator state. */
export function recordFromBills(input: {
  dateFrom: string
  dateTo: string
  bills: ConsolidatedInvoiceBill[]
  invoiceNo: string
  clientAddress?: string
  managerSignature?: string
  includePrefix?: boolean
  bankDetails?: ConsolidatedInvoiceRecord['bankDetails']
}): ConsolidatedInvoiceRecord {
  const totalBilled = input.bills.reduce((s, b) => s + (b.grand_total ?? b.total_amount ?? 0), 0)
  const totalPaid = input.bills.reduce((s, b) => s + (b.paid_amount ?? 0), 0)
  const totalOutstanding = input.bills.reduce(
    (s, b) => s + (b.outstanding_amount ?? (b.grand_total ?? b.total_amount) ?? 0), 0,
  )
  return {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    invoiceNo: input.invoiceNo,
    createdAt: new Date().toISOString(),
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    bills: input.bills,
    totalBilled,
    totalPaid,
    totalOutstanding,
    clientAddress: input.clientAddress,
    managerSignature: input.managerSignature,
    includePrefix: input.includePrefix,
    bankDetails: input.bankDetails,
  }
}
