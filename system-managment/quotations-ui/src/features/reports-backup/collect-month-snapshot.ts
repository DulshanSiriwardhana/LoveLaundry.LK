import {
  transactionsApi,
  expensesApi,
  employeesApi,
  salaryApi,
  mgmtApi,
} from '../management/api/management-api'
import billsApi from '../../api/bills-api'
import {
  arrayRows,
  customerFrom,
  dayOf,
  errorText,
  fetchAll,
  fetchCompany,
  itemRows,
  monthWindow,
  onMonth,
  pick,
  statusOf,
  toAmount,
  toStringValue,
  totalPieces,
  type SourceOutput,
} from './collect-snapshot'
import type {
  AttendanceRecord,
  BillRecord,
  DeliveryRecord,
  ExpenseRecord,
  GatePassRecord,
  IncomeRecord,
  LegacyInvoiceRecord,
  LinenStatusCount,
  MonthlyReportSnapshot,
  PaymentRecord,
  ReturnRecord,
  SalarySlipRecord,
  ShopBillRecord,
} from './types'
import { monthName as monthNameOf } from '../../lib/time'

function monthName(period: string): string {
  return monthNameOf(period)
}

async function fetchMonthIncome(period: string): Promise<SourceOutput<IncomeRecord> & { total: number }> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const { rows, truncated } = await fetchAll((offset, limit) => transactionsApi.list({ start_date, end_date, limit, offset }), 1000)
    const fetched = rows.length
    const records = onMonth(rows, period, ['transaction_date', 'date', 'created_at']).map<IncomeRecord>(r => {
      const on = dayOf(pick(r, ['transaction_date', 'date', 'created_at'])) ?? period
      return {
        id: String(pick(r, ['id', '_id', 'transaction_id']) ?? ''),
        date: on,
        customer: toStringValue(pick(r, ['customer_name', 'customer', 'client_name', 'payee'])),
        description: toStringValue(pick(r, ['description', 'particulars', 'notes'])),
        source: toStringValue(pick(r, ['source'])),
        payment_method: toStringValue(pick(r, ['payment_method', 'method'])),
        amount: toAmount(pick(r, ['total_amount', 'amount', 'total', 'value'])),
      }
    })
    const total = records.reduce((sum, r) => sum + r.amount, 0)
    return { key: 'income', label: 'Income (ledger)', ok: true, fetched, records, truncated, total }
  } catch (err: unknown) {
    return { key: 'income', label: 'Income (ledger)', ok: false, error: errorText(err), fetched: 0, records: [], total: 0 }
  }
}

async function fetchMonthExpenses(period: string): Promise<SourceOutput<ExpenseRecord> & { total: number }> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const { rows, truncated } = await fetchAll((offset, limit) => expensesApi.list({ start_date, end_date, limit, offset }), 500)
    const fetched = rows.length
    const records = onMonth(rows, period, ['date', 'expense_date', 'created_at', 'paid_date']).map<ExpenseRecord>(r => ({
      id: String(pick(r, ['id', '_id', 'expense_id']) ?? ''),
      date: dayOf(pick(r, ['date', 'expense_date', 'created_at', 'paid_date'])) ?? period,
      category: toStringValue(pick(r, ['category_name', 'category', 'category_id'])),
      description: toStringValue(pick(r, ['description', 'particulars', 'notes'])),
      payee: toStringValue(pick(r, ['payee', 'expense_for', 'paid_to', 'vendor'])),
      payment_method: toStringValue(pick(r, ['payment_method', 'method'])),
      amount: toAmount(pick(r, ['amount', 'total', 'value'])),
    }))
    const total = records.reduce((sum, r) => sum + r.amount, 0)
    return { key: 'expenses', label: 'Expenses', ok: true, fetched, records, truncated, total }
  } catch (err: unknown) {
    return { key: 'expenses', label: 'Expenses', ok: false, error: errorText(err), fetched: 0, records: [], total: 0 }
  }
}

async function fetchMonthEmployees(): Promise<Record<string, string>> {
  try {
    const map: Record<string, string> = {}
    for (const r of arrayRows(await employeesApi.list())) {
      const id = String(pick(r, ['id', '_id', 'employee_id']) ?? '')
      const name = toStringValue(pick(r, ['full_name', 'name', 'employee_name']))
      if (id && name) map[id] = name
    }
    return map
  } catch {
    return {}
  }
}

async function fetchMonthAttendance(period: string): Promise<SourceOutput<AttendanceRecord>> {
  try {
    const employeeNames = await fetchMonthEmployees()
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const res = await mgmtApi.get('/api/attendance', { params: { start_date, end_date, limit: 2000 } })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onMonth(rows, period, ['date', 'attendance_date', 'created_at']).map<AttendanceRecord>(r => {
      const empId = String(pick(r, ['employee_id', 'employee', 'id', '_id']) ?? '')
      return {
        employee_id: empId,
        employee_name:
          toStringValue(pick(r, ['employee_name', 'name', 'full_name'])) ??
          employeeNames[empId] ??
          (empId || 'Unknown'),
        date: dayOf(pick(r, ['date', 'attendance_date', 'created_at'])) ?? period,
        status: String(pick(r, ['status']) ?? 'PRESENT').toUpperCase(),
        overtime_hours: toAmount(pick(r, ['overtime_hours', 'ot_hours'])),
      }
    })
    return { key: 'attendance', label: 'Attendance', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'attendance', label: 'Attendance', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthSalary(period: string): Promise<SourceOutput<SalarySlipRecord> & { total: number }> {
  try {
    const [year, month] = period.split('-').map(Number)
    const rows = arrayRows(await salaryApi.listSlips({ year, month, limit: 500 }))
    const fetched = rows.length
    const records = onMonth(rows, period, ['paid_date', 'date', 'created_at', 'settled_date']).map<SalarySlipRecord>(r => ({
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
    const total = records.reduce((sum, r) => sum + r.net, 0)
    return { key: 'salary', label: 'Salary slips (payments)', ok: true, fetched, records, total }
  } catch (err: unknown) {
    return { key: 'salary', label: 'Salary slips (payments)', ok: false, error: errorText(err), fetched: 0, records: [], total: 0 }
  }
}

async function fetchMonthBills(period: string): Promise<SourceOutput<BillRecord>> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const { rows, truncated } = await fetchAll(
      (skip, limit) =>
        billsApi.get('/bills', {
          params: { date_from: `${start_date}T00:00:00`, date_to: `${end_date}T00:00:00`, skip, limit },
        }),
      5000,
      2
    )
    const fetched = rows.length
    const records = onMonth(rows, period, ['created_at', 'issue_date', 'bill_date', 'date']).map<BillRecord>(r => {
      const items = pick(r, ['items'])
      const itemsCount =
        toAmount(pick(r, ['total_quantity', 'num_items', 'items_count'])) || (Array.isArray(items) ? items.length : 0)
      return {
        bill_id: String(pick(r, ['id', '_id', 'bill_id', 'quotation_id']) ?? ''),
        client_name: toStringValue(pick(r, ['client_name', 'customer_name', 'client', 'name'])) ?? 'Unknown',
        date: dayOf(pick(r, ['created_at', 'issue_date', 'bill_date', 'date'])) ?? period,
        gate_pass_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
        items_count: itemsCount,
        total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
        balance: toAmount(pick(r, ['outstanding_amount', 'balance', 'balance_due', 'amount_due'])),
        payment_status: String(pick(r, ['payment_status', 'status']) ?? '').toUpperCase(),
      }
    })
    return { key: 'bills', label: 'Bills', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'bills', label: 'Bills', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthPayments(period: string): Promise<SourceOutput<PaymentRecord>> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const { rows, truncated } = await fetchAll(
      (offset, limit) => mgmtApi.get('/api/payments', { params: { start_date, end_date, limit, offset } }),
      500
    )
    const fetched = rows.length
    const records = onMonth(rows, period, ['payment_date', 'date', 'created_at']).map<PaymentRecord>(r => ({
      id: String(pick(r, ['id', '_id', 'payment_id']) ?? ''),
      customer: toStringValue(pick(r, ['customer_name', 'customer', 'client_name', 'name'])),
      date: dayOf(pick(r, ['payment_date', 'date', 'created_at'])) ?? period,
      method: toStringValue(pick(r, ['payment_method', 'method'])),
      ref: toStringValue(pick(r, ['reference', 'ref_no', 'receipt_no'])),
      amount: toAmount(pick(r, ['amount', 'total', 'value'])),
    }))
    return { key: 'payments', label: 'Payments received', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'payments', label: 'Payments received', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthShopBills(period: string): Promise<SourceOutput<ShopBillRecord>> {
  try {
    const { rows, truncated } = await fetchAll((skip, limit) => billsApi.get('/shop-bills', { params: { skip, limit } }), 500)
    const fetched = rows.length
    const records = onMonth(rows, period, ['created_at', 'date', 'bill_date', 'issue_date']).map<ShopBillRecord>(r => ({
      bill_id: String(pick(r, ['id', '_id', 'bill_id']) ?? ''),
      client_name: toStringValue(pick(r, ['client_name', 'customer_name', 'name'])) ?? 'Unknown',
      date: dayOf(pick(r, ['created_at', 'date', 'bill_date', 'issue_date'])) ?? period,
      total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
      balance: toAmount(pick(r, ['outstanding_amount', 'balance', 'balance_due', 'amount_due'])),
      status: String(pick(r, ['status', 'payment_status']) ?? '').toUpperCase(),
    }))
    return { key: 'shop_bills', label: 'Shop bills', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'shop_bills', label: 'Shop bills', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthLegacy(period: string): Promise<SourceOutput<LegacyInvoiceRecord>> {
  try {
    const { rows, truncated } = await fetchAll((skip, limit) => billsApi.get('/shop-bills/legacy', { params: { skip, limit } }), 200)
    const fetched = rows.length
    const records = onMonth(rows, period, ['created_at', 'date', 'issue_date', 'invoice_date']).map<LegacyInvoiceRecord>(
      r => ({
        invoice_id: String(pick(r, ['invoice_number', 'id', '_id', 'invoice_id']) ?? ''),
        client_name: toStringValue(pick(r, ['shop_name', 'client_name', 'customer_name', 'name'])) ?? 'Unknown',
        date: dayOf(pick(r, ['created_at', 'date', 'issue_date', 'invoice_date'])) ?? period,
        total: toAmount(pick(r, ['grand_total', 'total_amount', 'total', 'amount'])),
        status: toStringValue(pick(r, ['status', 'payment_status'])),
      })
    )
    return { key: 'legacy_invoices', label: 'Legacy invoices', ok: true, fetched, records, truncated }
  } catch (err: unknown) {
    return { key: 'legacy_invoices', label: 'Legacy invoices', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthGatePasses(period: string): Promise<SourceOutput<GatePassRecord>> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const res = await billsApi.get('/gatepasses', {
      params: { date_from: `${start_date}T00:00:00`, date_to: `${end_date}T00:00:00` },
    })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onMonth(rows, period, ['receiving_date', 'date', 'created_at']).map<GatePassRecord>(r => {
      const items = itemRows(pick(r, ['items', 'linen']))
      const marked = Boolean(pick(r, ['marked_delivered']))
      return {
        gp_id: String(pick(r, ['gate_pass_id', 'id', '_id', 'gp_id']) ?? ''),
        customer: customerFrom(r),
        receiving_date: dayOf(pick(r, ['receiving_date', 'date', 'created_at'])) ?? period,
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

async function fetchMonthDeliveries(period: string): Promise<SourceOutput<DeliveryRecord>> {
  try {
    const { start_date, end_date } = monthWindow(`${period}-01`)
    const res = await billsApi.get('/deliveries', {
      params: {
        date_from: `${start_date}T00:00:00`,
        date_to: `${end_date}T00:00:00`,
        include_cancelled: true,
      },
    })
    const rows = arrayRows(res)
    const fetched = rows.length
    const records = onMonth(rows, period, ['delivery_date', 'date', 'created_at']).map<DeliveryRecord>(r => {
      const items = itemRows(pick(r, ['items', 'linen', 'deliveries']))
      return {
        delivery_id: String(pick(r, ['delivery_id', 'id', '_id']) ?? ''),
        gp_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
        customer: customerFrom(r),
        delivery_date: dayOf(pick(r, ['delivery_date', 'date', 'created_at'])) ?? period,
        total_pieces: totalPieces(items),
        items,
      }
    })
    return { key: 'deliveries', label: 'Deliveries', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'deliveries', label: 'Deliveries', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthReturns(period: string): Promise<SourceOutput<ReturnRecord>> {
  try {
    const rows = arrayRows(await billsApi.get('/returns'))
    const fetched = rows.length
    const records = onMonth(rows, period, ['date', 'return_date', 'created_at']).map<ReturnRecord>(r => ({
      return_id: String(pick(r, ['return_id', 'id', '_id']) ?? ''),
      gp_id: toStringValue(pick(r, ['gate_pass_id', 'gp_id'])),
      customer: customerFrom(r),
      date: dayOf(pick(r, ['date', 'return_date', 'created_at'])) ?? period,
      items: itemRows(pick(r, ['items', 'linen'])),
    }))
    return { key: 'returns', label: 'Returns', ok: true, fetched, records }
  } catch (err: unknown) {
    return { key: 'returns', label: 'Returns', ok: false, error: errorText(err), fetched: 0, records: [] }
  }
}

async function fetchMonthLinenStatus(): Promise<SourceOutput<LinenStatusCount> & { counts: LinenStatusCount | null }> {
  try {
    const res = await billsApi.get('/linens', { params: { limit: 5000 } })
    const data = (res?.data ?? res) as Record<string, unknown>
    const rows = arrayRows(res)
    const fetched = rows.length
    const totalFromApi = toAmount(pick(data, ['total']))
    const truncated = totalFromApi > rows.length
    const counts: LinenStatusCount = { in_stock: 0, in_use: 0, in_wash: 0, retired: 0, lost: 0, unknown: 0, total: rows.length, truncated }
    for (const r of rows) {
      const status = String(pick(r, ['status']) ?? '').toUpperCase()
      if (['IN_STOCK', 'INVENTORY'].includes(status)) counts.in_stock += 1
      else if (['IN_USE', 'CONSUMER', 'WITH_CUSTOMER', 'ISSUED'].includes(status)) counts.in_use += 1
      else if (['IN_WASH', 'WASHING', 'DRY_CLEAN', 'IN_PROCESS'].includes(status)) counts.in_wash += 1
      else if (['RETIRED', 'RETIRED_RETIRED', 'DISCARDED'].includes(status)) counts.retired += 1
      else if (['LOST', 'WASTE', 'MISSING'].includes(status)) counts.lost += 1
      else counts.unknown += 1
    }
    return { key: 'linen_status', label: 'Linen stock status', ok: true, fetched, records: [counts as unknown as LinenStatusCount], counts }
  } catch (err: unknown) {
    return { key: 'linen_status', label: 'Linen stock status', ok: false, error: errorText(err), fetched: 0, records: [], counts: null }
  }
}

interface MonthlyData {
  income: IncomeRecord[]
  expenses: ExpenseRecord[]
  attendance: AttendanceRecord[]
  salary_slips: SalarySlipRecord[]
  bills: BillRecord[]
  payments: PaymentRecord[]
  shop_bills: ShopBillRecord[]
  legacy_invoices: LegacyInvoiceRecord[]
  gatepasses: GatePassRecord[]
  deliveries: DeliveryRecord[]
  returns: ReturnRecord[]
}

function buildDaily(data: MonthlyData): MonthlyReportSnapshot['daily'] {
  const map = new Map<string, Record<string, number>>()
  const bump = (date: string, key: string, value: number) => {
    if (!date) return
    const cur = map.get(date) ?? { income: 0, expenses: 0, bills: 0, bill_balance: 0, payments: 0, salary_paid: 0, gatepass_pieces: 0, deliveries_pieces: 0, present: 0, leave: 0 }
    cur[key] = (cur[key] ?? 0) + value
    map.set(date, cur)
  }
  for (const r of data.income) bump(r.date, 'income', r.amount)
  for (const r of data.expenses) bump(r.date, 'expenses', r.amount)
  for (const r of data.bills) {
    bump(r.date, 'bills', r.total)
    bump(r.date, 'bill_balance', r.balance)
  }
  for (const r of data.payments) bump(r.date, 'payments', r.amount)
  for (const r of data.salary_slips) bump(r.paid_date ?? '', 'salary_paid', r.net)
  for (const r of data.gatepasses) bump(r.receiving_date, 'gatepass_pieces', r.total_pieces)
  for (const r of data.deliveries) bump(r.delivery_date, 'deliveries_pieces', r.total_pieces)
  // Mark-delivered gate passes count as delivered, but only add the pieces that
  // were not already recorded against that same gate pass (no double counting).
  const recordedByGp = new Map<string, number>()
  for (const d of data.deliveries) recordedByGp.set(d.gp_id ?? '', (recordedByGp.get(d.gp_id ?? '') ?? 0) + d.total_pieces)
  for (const r of data.gatepasses) {
    if (!r.marked_delivered) continue
    const extra = Math.max(0, r.total_pieces - (recordedByGp.get(r.gp_id ?? '') ?? 0))
    if (extra > 0) bump(r.receiving_date, 'deliveries_pieces', extra)
  }
  for (const r of data.attendance) {
    bump(r.date, 'present', r.status.includes('PRESENT') || ['HALF_DAY', 'HALFDAY', 'HALF'].includes(r.status) ? 1 : 0)
    bump(r.date, 'leave', r.status.includes('LEAVE') ? 1 : 0)
  }
  return [...map.entries()].map(([date, v]) => ({
    date,
    income: v.income ?? 0,
    expenses: v.expenses ?? 0,
    bills: v.bills ?? 0,
    bill_balance: v.bill_balance ?? 0,
    payments: v.payments ?? 0,
    salary_paid: v.salary_paid ?? 0,
    gatepass_pieces: v.gatepass_pieces ?? 0,
    deliveries_pieces: v.deliveries_pieces ?? 0,
    present: v.present ?? 0,
    leave: v.leave ?? 0,
  })).sort((a, b) => (a.date < b.date ? -1 : 1))
}

export async function collectMonthSnapshot(period: string): Promise<MonthlyReportSnapshot> {
  const [
    company,
    income,
    expenses,
    attendance,
    salary,
    bills,
    payments,
    shopBills,
    legacy,
    gatepasses,
    deliveries,
    returns,
    linenStatus,
  ] = await Promise.all([
    fetchCompany(),
    fetchMonthIncome(period),
    fetchMonthExpenses(period),
    fetchMonthAttendance(period),
    fetchMonthSalary(period),
    fetchMonthBills(period),
    fetchMonthPayments(period),
    fetchMonthShopBills(period),
    fetchMonthLegacy(period),
    fetchMonthGatePasses(period),
    fetchMonthDeliveries(period),
    fetchMonthReturns(period),
    fetchMonthLinenStatus(),
  ])

  const data: MonthlyData = {
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
  }

  const daily = buildDaily(data)
  const incomeTotal = income.total
  const expensesTotal = expenses.total
  const billsTotal = bills.records.reduce((s, b) => s + b.total, 0)
  const billBalance = bills.records.reduce((s, b) => s + b.balance, 0)
  const paymentsTotal = payments.records.reduce((s, p) => s + p.amount, 0)
  const salaryPaid = salary.total
  const gpPieces = gatepasses.records.reduce((s, g) => s + g.total_pieces, 0)
  const recordedByGp = new Map<string, number>()
  for (const d of deliveries.records) recordedByGp.set(d.gp_id ?? '', (recordedByGp.get(d.gp_id ?? '') ?? 0) + d.total_pieces)
  const delPieces =
    deliveries.records.reduce((s, d) => s + d.total_pieces, 0) +
    gatepasses.records.reduce((s, g) => s + (g.marked_delivered ? Math.max(0, g.total_pieces - (recordedByGp.get(g.gp_id ?? '') ?? 0)) : 0), 0)

  const sources = [
    statusOf(income),
    statusOf(expenses),
    statusOf(attendance),
    statusOf(salary),
    statusOf(bills),
    statusOf(payments),
    statusOf(shopBills),
    statusOf(legacy),
    statusOf(gatepasses),
    statusOf(deliveries),
    statusOf(returns),
    statusOf(linenStatus),
    { key: 'company', label: 'Company settings', ok: true, fetched: 1, count: 1 },
  ]

  return {
    meta: {
      backup_version: 1,
      report_type: 'monthly',
      period,
      month_name: monthName(period),
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
    daily,
    sources,
    totals: {
      income: incomeTotal,
      expenses: expensesTotal,
      net: incomeTotal - expensesTotal,
      bills: billsTotal,
      bill_balance: billBalance,
      payments: paymentsTotal,
      salary_paid: salaryPaid,
      gatepass_pieces: gpPieces,
      deliveries_pieces: delPieces,
      work_days: daily.filter(d => d.income > 0 || d.expenses > 0 || d.bills > 0 || d.gatepass_pieces > 0 || d.present > 0).length,
    },
  }
}