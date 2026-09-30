import { COMPANY } from '../../config/company'
import {
  transactionsApi,
  expensesApi,
  employeesApi,
  salaryApi,
  companySettingsApi,
  attendanceApi,
  mgmtApi,
} from '../management/api/management-api'
import billsApi from '../../api/bills-api'
import type {
  AttendanceRecord,
  BillRecord,
  CompanyBrief,
  DailyReportSnapshot,
  DeliveryRecord,
  ExpenseRecord,
  GatePassRecord,
  IncomeRecord,
  LegacyInvoiceRecord,
  LinenStatusCount,
  PaymentRecord,
  ReturnRecord,
  SalarySlipRecord,
  ShopBillRecord,
} from './types'
import { formatISODate, getDateParts } from '../../lib/time'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDay(d: Date): string {
  return formatISODate(getDateParts(d))
}

/** Extracts a local date (YYYY-MM-DD) from a string / Date / timestamp, or undefined. */
export function dayOf(value: unknown): string | undefined {
  if (value == null) return undefined
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : toDay(value)
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
    const iso = new Date(value)
    if (!Number.isNaN(iso.getTime())) return toDay(iso)
    return undefined
  }
  if (typeof value === 'number') {
    const ts = new Date(value)
    return Number.isNaN(ts.getTime()) ? undefined : toDay(ts)
  }
  return undefined
}

export function toAmount(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function toStringValue(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return value.toISOString()
  return undefined
}

/** Picks the first defined candidate field from a record. */
export function pick(record: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of candidates) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function arrayRows(response: unknown): Record<string, unknown>[] {
  const data = (response as { data?: unknown } | undefined)?.data ?? response
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['items', 'results', 'records', 'rows', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[]
    }
  }
  return []
}

/**
 * Month-wide server query window (start = first of month, end = first of next
 * month). Backends filter date fields as STRINGS, so an equal start/end range
 * (startDate === endDate === 'YYYY-MM-DD') wrongly excludes stored datetime
 * values later that day. Fetching the full month sidesteps that while still
 * letting us pick the exact day client-side.
 */
export function monthWindow(date: string): { start_date: string; end_date: string } {
  const [y, m] = date.split('-').map(Number)
  return {
    start_date: `${y}-${pad(m || 1)}-01`,
    end_date: toDay(new Date(y, m || 1, 1)),
  }
}

/** Client-side filter: keep only rows whose date field matches the target day. */
export function onDay(rows: Record<string, unknown>[], date: string, candidates: string[]): Record<string, unknown>[] {
  return rows.filter(r => dayOf(pick(r, candidates)) === date)
}

/** Client-side filter: keep only rows whose date field falls inside the month. */
export function onMonth(rows: Record<string, unknown>[], period: string, candidates: string[]): Record<string, unknown>[] {
  return rows.filter(r => {
    const day = dayOf(pick(r, candidates))
    return !!day && day.startsWith(period)
  })
}

/**
 * Fetches several pages of a list endpoint.
 *
 * Stops early once a short page proves the end was reached; otherwise it keeps
 * going to a hard page ceiling. Hitting that ceiling is reported back as
 * `truncated` rather than silently swallowed — a report that quietly omits
 * records is worse than one that admits it hit a cap.
 */
export async function fetchAll(
  fetchPage: (offset: number, limit: number) => Promise<unknown>,
  pageSize: number,
  maxPages = 60,
): Promise<{ rows: Record<string, unknown>[]; truncated: boolean }> {
  const all: Record<string, unknown>[] = []
  for (let page = 0; page < maxPages; page++) {
    const rows = arrayRows(await fetchPage(page * pageSize, pageSize))
    all.push(...rows)
    if (rows.length < pageSize) return { rows: all, truncated: false }
  }
  return { rows: all, truncated: true }
}

export interface SourceOutput<T> {
  key: string
  label: string
  ok: boolean
  error?: string
  /** Raw rows returned by the API before date/day filtering. */
  fetched: number
  records: T[]
  /** True when a page ceiling was hit and records may be missing. */
  truncated?: boolean
}

export interface IncomeOutput extends SourceOutput<IncomeRecord> {
  total: number
}
export interface ExpenseOutput extends SourceOutput<ExpenseRecord> {
  total: number
}

export const REPORT_SOURCES: { key: string; label: string }[] = [
  { key: 'company', label: 'Company settings' },
  { key: 'income', label: 'Income (ledger)' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'salary', label: 'Salary slips (payments)' },
  { key: 'bills', label: 'Bills' },
  { key: 'payments', label: 'Payments received' },
  { key: 'shop_bills', label: 'Shop bills' },
  { key: 'legacy_invoices', label: 'Legacy invoices' },
  { key: 'gatepasses', label: 'Gate passes' },
  { key: 'deliveries', label: 'Deliveries' },
  { key: 'returns', label: 'Returns' },
  { key: 'linen_status', label: 'Linen stock status' },
]

export function statusOf(output: SourceOutput<unknown> & { count?: number }) {
  return {
    key: output.key,
    label: output.label,
    ok: output.ok,
    error: output.error,
    fetched: output.fetched,
    count: output.records.length,
  }
}

export async function fetchCompany(): Promise<CompanyBrief> {
  const fallback = {
    name: COMPANY.name,
    tagline: `${COMPANY.tagline}`,
    address: `${COMPANY.address.line1}, ${COMPANY.address.line2}`,
    phone: `${COMPANY.phone.primary}${COMPANY.phone.secondary ? ` / ${COMPANY.phone.secondary}` : ''}`,
    email: COMPANY.email,
    registration_no: COMPANY.registrationNo,
  }
  try {
    const res = await companySettingsApi.get()
    const settings = res?.data ?? res
    if (!settings || typeof settings !== 'object') return fallback
    const obj = settings as Record<string, unknown>
    const name = toStringValue(pick(obj, ['company_name', 'business_name', 'name']))
    const address = toStringValue(pick(obj, ['address', 'address_text']))
    const phone = toStringValue(pick(obj, ['contact_phone', 'phone_no', 'telephone', 'phone']))
    const email = toStringValue(pick(obj, ['contact_email', 'email']))
    const registration = toStringValue(pick(obj, ['registration_no', 'registration_number', 'reg_no']))
    const tagline = toStringValue(pick(obj, ['tagline', 'slogan']))
    return {
      name: name ?? fallback.name,
      tagline: tagline ?? fallback.tagline,
      address: address ?? fallback.address,
      phone: phone ?? fallback.phone,
      email: email ?? fallback.email,
      registration_no: registration ?? fallback.registration_no,
    }
  } catch {
    return fallback
  }
}

async function fetchIncome(date: string): Promise<IncomeOutput> {
  try {
    const { start_date, end_date } = monthWindow(date)
    const { rows, truncated } = await fetchAll(
      (offset, limit) => transactionsApi.list({ start_date, end_date, limit, offset }),
      1000
    )
    const fetched = rows.length
    const records = onDay(rows, date, ['transaction_date', 'date', 'created_at'])
      .map<IncomeRecord>(r => ({
        id: String(pick(r, ['id', '_id', 'transaction_id']) ?? ''),
        date,
        customer: toStringValue(pick(r, ['customer_name', 'customer', 'client_name', 'payee'])),
        description: toStringValue(pick(r, ['description', 'particulars', 'notes'])),
        source: toStringValue(pick(r, ['source'])),
        payment_method: toStringValue(pick(r, ['payment_method', 'method'])),
        amount: toAmount(pick(r, ['total_amount', 'amount', 'total', 'value'])),
      }))
    const total = records.reduce((sum, r) => sum + r.amount, 0)
    return { key: 'income', label: 'Income (ledger)', ok: true, fetched, records, truncated, total }
  } catch (err: unknown) {
    return {
      key: 'income',
      label: 'Income (ledger)',
      ok: false,
      error: errorText(err),
      fetched: 0,
      records: [],
      total: 0,
    }
  }
}

async function fetchExpenses(date: string): Promise<ExpenseOutput> {
  try {
    const { start_date, end_date } = monthWindow(date)
    const { rows, truncated } = await fetchAll(
      (offset, limit) => expensesApi.list({ start_date, end_date, limit, offset }),
      500
    )
    const fetched = rows.length
    const records = onDay(rows, date, ['date', 'expense_date', 'created_at', 'paid_date'])
      .map<ExpenseRecord>(r => ({
        id: String(pick(r, ['id', '_id', 'expense_id']) ?? ''),
        date,
        category: toStringValue(pick(r, ['category_name', 'category', 'category_id'])),
        description: toStringValue(pick(r, ['description', 'particulars', 'notes'])),
        payee: toStringValue(pick(r, ['payee', 'expense_for', 'paid_to', 'vendor'])),
        payment_method: toStringValue(pick(r, ['payment_method', 'method'])),
        amount: toAmount(pick(r, ['amount', 'total', 'value'])),
      }))
    const total = records.reduce((sum, r) => sum + r.amount, 0)
    return { key: 'expenses', label: 'Expenses', ok: true, fetched, records, truncated, total }
  } catch (err: unknown) {
    return {
      key: 'expenses',
      label: 'Expenses',
      ok: false,
      error: errorText(err),
      fetched: 0,
      records: [],
      total: 0,
    }
  }
}

async function fetchEmployees(): Promise<Record<string, string>> {
  try {
    const res = await employeesApi.list()
    const map: Record<string, string> = {}
    for (const r of arrayRows(res)) {
      const id = String(pick(r, ['id', '_id', 'employee_id']) ?? '')
      const name = toStringValue(pick(r, ['full_name', 'name', 'employee_name']))
      if (id && name) map[id] = name
    }
    return map
  } catch {
    return {}
  }
}

async function fetchAttendance(date: string): Promise<SourceOutput<AttendanceRecord>> {
  try {
    const employeeNames = await fetchEmployees()
    const res = await attendanceApi.listForDate(date)
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onDay(rows, date, ['date', 'attendance_date', 'created_at'])
      .map<AttendanceRecord>(r => {
        const empId = String(pick(r, ['employee_id', 'employee', 'id', '_id']) ?? '')
        return {
          employee_id: empId,
          employee_name:
            toStringValue(pick(r, ['employee_name', 'name', 'full_name'])) ??
            employeeNames[empId] ??
            (empId || 'Unknown'),
          date,
          status: String(pick(r, ['status']) ?? 'PRESENT').toUpperCase(),
          overtime_hours: toAmount(pick(r, ['overtime_hours', 'ot_hours'])),
        }
      })
    return { key: 'attendance', label: 'Attendance', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'attendance', label: 'Attendance', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchSalarySlips(date: string): Promise<SourceOutput<SalarySlipRecord>> {
  try {
    const [year, month] = date.split('-').map(Number)
    const res = await salaryApi.listSlips({ year, month, limit: 500 })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = rows
      .filter(r => dayOf(pick(r, ['paid_date', 'date', 'created_at', 'settled_date'])) === date)
      .map<SalarySlipRecord>(r => ({
        slip_id: String(pick(r, ['id', '_id', 'slip_id']) ?? ''),
        employee_name: toStringValue(pick(r, ['employee_name', 'name', 'full_name'])) ?? 'Unknown',
        period_start: toStringValue(pick(r, ['period_start', 'start_date'])) ?? '',
        period_end: toStringValue(pick(r, ['period_end', 'end_date'])) ?? '',
        gross: toAmount(pick(r, ['total_earnings', 'gross', 'gross_salary'])),
        deductions: toAmount(pick(r, ['total_deductions', 'deductions', 'deduction_total'])),
        net: toAmount(pick(r, ['net_salary', 'net', 'net_pay', 'take_home'])),
        status: String(pick(r, ['status']) ?? 'FINALIZED').toUpperCase(),
        paid_date: toStringValue(pick(r, ['paid_date'])),
      }))
    return { key: 'salary', label: 'Salary slips (payments)', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'salary', label: 'Salary slips (payments)', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchBills(date: string): Promise<SourceOutput<BillRecord>> {
  try {
    const { start_date, end_date } = monthWindow(date)
    const res = await billsApi.get('/bills', {
      params: {
        date_from: `${start_date}T00:00:00`,
        date_to: `${end_date}T00:00:00`,
        limit: 5000,
      },
    })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onDay(rows, date, ['created_at', 'issue_date', 'bill_date', 'date'])
      .map<BillRecord>(r => {
        const items = pick(r, ['items'])
        const itemsCount =
          toAmount(pick(r, ['total_quantity', 'num_items', 'items_count'])) ||
          (Array.isArray(items) ? items.length : 0)
        return {
          bill_id: String(pick(r, ['id', '_id', 'bill_id', 'quotation_id']) ?? ''),
          client_name: toStringValue(pick(r, ['client_name', 'customer_name', 'client', 'name'])) ?? 'Unknown',
          date,
          gate_pass_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
          items_count: itemsCount,
          total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
          balance: toAmount(pick(r, ['outstanding_amount', 'balance', 'balance_due', 'amount_due'])),
          payment_status: String(pick(r, ['payment_status', 'status']) ?? '').toUpperCase(),
        }
      })
    return { key: 'bills', label: 'Bills', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'bills', label: 'Bills', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMgmtPayments(date: string): Promise<SourceOutput<PaymentRecord>> {
  try {
    const { start_date, end_date } = monthWindow(date)
    const { rows, truncated } = await fetchAll(
      (offset, limit) => mgmtApi.get('/api/payments', { params: { start_date, end_date, limit, offset } }),
      500
    )
    const fetched = rows.length
    const records = onDay(rows, date, ['payment_date', 'date', 'created_at'])
      .map<PaymentRecord>(r => ({
        id: String(pick(r, ['id', '_id', 'payment_id']) ?? ''),
        customer: toStringValue(pick(r, ['customer_name', 'customer', 'client_name', 'name'])),
        date,
        method: toStringValue(pick(r, ['payment_method', 'method'])),
        ref: toStringValue(pick(r, ['reference', 'ref_no', 'receipt_no'])),
        amount: toAmount(pick(r, ['amount', 'total', 'value'])),
      }))
    return { key: 'payments', label: 'Payments received', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'payments', label: 'Payments received', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchShopBills(date: string): Promise<SourceOutput<ShopBillRecord>> {
  try {
    const { rows, truncated } = await fetchAll(
      (skip, limit) => billsApi.get('/shop-bills', { params: { skip, limit } }),
      500
    )
    const fetched = rows.length
    const records = onDay(rows, date, ['created_at', 'date', 'bill_date', 'issue_date'])
      .map<ShopBillRecord>(r => ({
        bill_id: String(pick(r, ['id', '_id', 'bill_id']) ?? ''),
        client_name: toStringValue(pick(r, ['client_name', 'customer_name', 'name'])) ?? 'Unknown',
        date,
        total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
        balance: toAmount(pick(r, ['outstanding_amount', 'balance', 'balance_due', 'amount_due'])),
        status: String(pick(r, ['status', 'payment_status']) ?? '').toUpperCase(),
      }))
    return { key: 'shop_bills', label: 'Shop bills', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'shop_bills', label: 'Shop bills', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchLegacyInvoices(date: string): Promise<SourceOutput<LegacyInvoiceRecord>> {
  try {
    const { rows, truncated } = await fetchAll(
      (skip, limit) => billsApi.get('/shop-bills/legacy', { params: { skip, limit } }),
      200
    )
    const fetched = rows.length
    const records = onDay(rows, date, ['created_at', 'date', 'issue_date', 'invoice_date'])
      .map<LegacyInvoiceRecord>(r => ({
        invoice_id: String(pick(r, ['invoice_number', 'id', '_id', 'invoice_id']) ?? ''),
        client_name: toStringValue(pick(r, ['shop_name', 'client_name', 'customer_name', 'name'])) ?? 'Unknown',
        date,
        total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
        status: toStringValue(pick(r, ['status', 'payment_status'])),
      }))
    return { key: 'legacy_invoices', label: 'Legacy invoices', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'legacy_invoices', label: 'Legacy invoices', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

export function itemRows(value: unknown): { name: string; quantity: number }[] {
  if (!Array.isArray(value)) return []
  return value.map((item: Record<string, unknown>) => ({
    name:
      toStringValue(pick(item, ['item_name', 'name', 'linen_type', 'linen_category', 'description'])) ?? '—',
    quantity: toAmount(pick(item, ['received_qty', 'quantity', 'qty', 'count', 'pieces'])),
  }))
}

export function totalPieces(items: { name: string; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

export function customerFrom(r: Record<string, unknown>): string {
  return (
    toStringValue(pick(r, ['client_name', 'guest_name', 'customer_name', 'customer', 'name', 'guest'])) ?? 'Unknown'
  )
}

async function fetchGatePasses(date: string): Promise<SourceOutput<GatePassRecord>> {
  try {
    const { start_date, end_date } = monthWindow(date)
    // Unfiltered, this endpoint returns the WHOLE lifetime history: slow, and
    // silently lossy once the collection is large. It supports date_from/date_to
    // on receiving_date, so bound the query to the month and still pick the
    // exact day client-side.
    const res = await billsApi.get('/gatepasses', {
      params: { date_from: `${start_date}T00:00:00`, date_to: `${end_date}T00:00:00` },
    })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onDay(rows, date, ['receiving_date', 'date', 'created_at'])
      .map<GatePassRecord>(r => {
        const items = itemRows(pick(r, ['items', 'linen']))
        const marked = Boolean(pick(r, ['marked_delivered']))
        return {
          gp_id: String(pick(r, ['gate_pass_id', 'id', '_id', 'gp_id']) ?? ''),
          customer: customerFrom(r),
          receiving_date: date,
          delivered:
            Boolean(pick(r, ['is_delivered', 'delivered'])) ||
            toStringValue(pick(r, ['status'])) === 'DELIVERED' ||
            marked,
          delivered_date:
            toStringValue(pick(r, ['delivered_date'])) ||
            toStringValue((pick(r, ['marked_delivered']) as { delivered_date?: unknown } | null)?.delivered_date),
          marked_delivered: marked,
          total_pieces: totalPieces(items),
          items,
        }
      })
    return { key: 'gatepasses', label: 'Gate passes', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'gatepasses', label: 'Gate passes', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchDeliveries(date: string): Promise<SourceOutput<DeliveryRecord>> {
  try {
    const { start_date, end_date } = monthWindow(date)
    // include_cancelled defaults to FALSE server-side, which dropped every
    // cancelled delivery from the report without saying so. A report is meant
    // to show what happened, so ask for them explicitly. Same month-bounded
    // window as gate passes.
    const res = await billsApi.get('/deliveries', {
      params: {
        date_from: `${start_date}T00:00:00`,
        date_to: `${end_date}T00:00:00`,
        include_cancelled: true,
      },
    })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onDay(rows, date, ['delivery_date', 'date', 'created_at'])
      .map<DeliveryRecord>(r => {
        const items = itemRows(pick(r, ['items', 'linen', 'deliveries']))
        return {
          delivery_id: String(pick(r, ['delivery_id', 'id', '_id']) ?? ''),
          gp_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
          customer: customerFrom(r),
          delivery_date: date,
          total_pieces: totalPieces(items),
          items,
        }
      })
    return { key: 'deliveries', label: 'Deliveries', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'deliveries', label: 'Deliveries', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchReturns(date: string): Promise<SourceOutput<ReturnRecord>> {
  try {
    const res = await billsApi.get('/returns')
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onDay(rows, date, ['date', 'return_date', 'created_at'])
      .map<ReturnRecord>(r => ({
        return_id: String(pick(r, ['return_id', 'id', '_id']) ?? ''),
        gp_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
        customer: customerFrom(r),
        date,
        items: itemRows(pick(r, ['items', 'linen'])),
      }))
    return { key: 'returns', label: 'Returns', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'returns', label: 'Returns', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchLinenStatus(): Promise<SourceOutput<LinenStatusCount> & { counts: LinenStatusCount | null }> {
  try {
    const res = await billsApi.get('/linens', { params: { limit: 5000 } })
    const data = (res?.data ?? res) as Record<string, unknown>
    const rows = arrayRows(res)
    const fetched = rows.length
    const totalFromApi = toAmount(pick(data, ['total']))
    const truncated = totalFromApi > rows.length
    const counts = {
      in_stock: 0,
      in_use: 0,
      in_wash: 0,
      retired: 0,
      lost: 0,
      unknown: 0,
      total: rows.length,
      truncated,
    }
    for (const r of rows) {
      const status = String(pick(r, ['status']) ?? '').toUpperCase()
      if (['IN_STOCK', 'INVENTORY'].includes(status)) counts.in_stock += 1
      else if (['IN_USE', 'CONSUMER', 'WITH_CUSTOMER', 'ISSUED'].includes(status)) counts.in_use += 1
      else if (['IN_WASH', 'WASHING', 'DRY_CLEAN', 'IN_PROCESS'].includes(status)) counts.in_wash += 1
      else if (['RETIRED', 'RETIRED_RETIRED', 'DISCARDED'].includes(status)) counts.retired += 1
      else if (['LOST', 'WASTE', 'MISSING'].includes(status)) counts.lost += 1
      else counts.unknown += 1
    }
    return {
      key: 'linen_status',
      label: 'Linen stock status',
      ok: true,
      fetched,
      records: [counts as unknown as LinenStatusCount],
      counts,
    }
  } catch (err: unknown) {
    return {
      key: 'linen_status',
      label: 'Linen stock status',
      ok: false,
      error: errorText(err),
      fetched: 0,
      records: [],
      counts: null,
    }
  }
}

export function errorText(err: unknown): string {
  const response = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  const message = typeof response === 'string' ? response : undefined
  return message ?? (err instanceof Error ? err.message : 'Request failed')
}

export async function collectDaySnapshot(date: string): Promise<DailyReportSnapshot> {
  const [company, income, expenses, attendance, salary, bills, payments, shopBills, legacy, gatepasses, deliveries, returns, linenStatus] =
    await Promise.all([
      fetchCompany(),
      fetchIncome(date),
      fetchExpenses(date),
      fetchAttendance(date),
      fetchSalarySlips(date),
      fetchBills(date),
      fetchMgmtPayments(date),
      fetchShopBills(date),
      fetchLegacyInvoices(date),
      fetchGatePasses(date),
      fetchDeliveries(date),
      fetchReturns(date),
      fetchLinenStatus(),
    ])

  const totals = {
    income: income.total,
    expenses: expenses.total,
    net: income.total - expenses.total,
  }

  const sources = [
    statusOf({ ...income, records: income.records }),
    statusOf({ ...expenses, records: expenses.records }),
    statusOf({ ...attendance, records: attendance.records }),
    statusOf({ ...salary, records: salary.records }),
    statusOf({ ...bills, records: bills.records }),
    statusOf({ ...payments, records: payments.records }),
    statusOf({ ...shopBills, records: shopBills.records }),
    statusOf({ ...legacy, records: legacy.records }),
    statusOf({ ...gatepasses, records: gatepasses.records }),
    statusOf({ ...deliveries, records: deliveries.records }),
    statusOf({ ...returns, records: returns.records }),
    statusOf({ ...linenStatus, records: linenStatus.records }),
    {
      key: 'company',
      label: 'Company settings',
      ok: true,
      fetched: 1,
      count: 1,
    },
  ]

  return {
    meta: {
      backup_version: 1,
      report_date: date,
      generated_at: new Date().toISOString(),
      generator: 'Lovelaundry Manager (quotations-ui)',
      api_bases: {
        mgmt_api: import.meta.env.VITE_MGMT_API_URL ?? 'http://localhost:8001',
        bills_api: import.meta.env.VITE_BILLS_API_URL ?? 'http://localhost:8001',
      },
    },
    company,
    income: income.records,
    expenses: expenses.records,
    attendance: attendance.records,
    salary_slips: salary.records,
    bills: bills.records,
    payments: payments.records,
    shop_bills: shopBills.records,
    legacy_invoices: legacy.records,
    gatepasses: gatepasses.records,
    deliveries: deliveries.records,
    returns: returns.records,
    linen_status: linenStatus.counts ?? undefined,
    sources,
    totals,
  }
}