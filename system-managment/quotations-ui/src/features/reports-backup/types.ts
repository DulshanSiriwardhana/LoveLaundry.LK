export interface SourceStatus {
  key: string
  label: string
  ok: boolean
  error?: string
  fetched: number
  count: number
  /** True when a page ceiling was hit and records may be missing. */
  truncated?: boolean
}

export interface CompanyBrief {
  name: string
  tagline?: string
  address?: string
  phone?: string
  email?: string
  registration_no?: string
}

export interface IncomeRecord {
  id: string
  date: string
  customer?: string
  description?: string
  source?: string
  payment_method?: string
  amount: number
}

export interface ExpenseRecord {
  id: string
  date: string
  category?: string
  description?: string
  payee?: string
  payment_method?: string
  amount: number
}

export interface AttendanceRecord {
  employee_id: string
  employee_name: string
  date: string
  status: string
  overtime_hours: number
}

export interface SalarySlipRecord {
  slip_id: string
  employee_name: string
  period_start: string
  period_end: string
  gross: number
  deductions: number
  net: number
  status: string
  paid_date?: string
}

export interface BillRecord {
  bill_id: string
  client_name: string
  date: string
  gate_pass_id?: string
  items_count: number
  total: number
  balance: number
  payment_status: string
}

export interface PaymentRecord {
  id: string
  customer?: string
  date: string
  method?: string
  ref?: string
  amount: number
}

export interface ShopBillRecord {
  bill_id: string
  client_name: string
  date: string
  total: number
  balance: number
  status: string
}

export interface LegacyInvoiceRecord {
  invoice_id: string
  client_name: string
  date: string
  total: number
  status?: string
}

export interface GatePassRecord {
  gp_id: string
  customer: string
  receiving_date: string
  delivered: boolean
  delivered_date?: string
  marked_delivered?: boolean
  total_pieces: number
  items: { name: string; quantity: number }[]
}

export interface DeliveryRecord {
  delivery_id: string
  gp_id?: string
  customer: string
  delivery_date: string
  total_pieces: number
  items: { name: string; quantity: number }[]
}

export interface ReturnRecord {
  return_id: string
  gp_id?: string
  customer: string
  date: string
  items: { name: string; quantity: number }[]
}

export interface LinenStatusCount {
  in_stock: number
  in_use: number
  in_wash: number
  retired: number
  lost: number
  unknown: number
  total: number
  truncated: boolean
}

export interface DailyReportSnapshot {
  meta: {
    backup_version: number
    report_date: string
    generated_at: string
    generator: string
    api_bases: {
      mgmt_api: string
      bills_api: string
    }
  }
  company: CompanyBrief
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
  linen_status?: LinenStatusCount
  sources: SourceStatus[]
  totals: {
    income: number
    expenses: number
    net: number
  }
}

export interface WrittenFile {
  name: string
  size: number
  overwritten: boolean
}

export interface MonthDayAggregate {
  date: string
  income: number
  expenses: number
  bills: number
  bill_balance: number
  payments: number
  salary_paid: number
  gatepass_pieces: number
  deliveries_pieces: number
  present: number
  leave: number
}

export interface MonthlyReportSnapshot {
  meta: {
    backup_version: number
    report_type: 'monthly'
    period: string
    month_name: string
    generated_at: string
    generator: string
    api_bases: {
      mgmt_api: string
      bills_api: string
    }
  }
  company: CompanyBrief
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
  linen_status?: LinenStatusCount
  daily: MonthDayAggregate[]
  sources: SourceStatus[]
  totals: {
    income: number
    expenses: number
    net: number
    bills: number
    bill_balance: number
    payments: number
    salary_paid: number
    gatepass_pieces: number
    deliveries_pieces: number
    work_days: number
  }
}

export interface BackupResult {
  report_date: string
  started_at: string
  finished_at: string
  folder_name: string
  files: WrittenFile[]
  snapshot: DailyReportSnapshot
  modes: ('pdf' | 'json')[]
}