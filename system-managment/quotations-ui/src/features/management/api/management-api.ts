import axios from 'axios'
import { installOfflineAdapter } from '../../../cache/offline-adapter'
import { attachResponseInterceptor } from '../../../api/interceptors'

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export const mgmtApi = axios.create({
  baseURL: import.meta.env.VITE_MGMT_API_URL ?? 'http://localhost:8001',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

mgmtApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Without this, a 401 from the management backend would neither clear the
// session nor redirect, and the raw Axios error would skip extractMessage() —
// so "[object Object]" could surface across the whole management surface.
attachResponseInterceptor(mgmtApi)

installOfflineAdapter(mgmtApi, 'management')

// ── Customers ─────────────────────────────────────────────────────────────
export const customersApi = {
  list: (search = '', limit?: number, offset?: number) => {
    const q = new URLSearchParams()
    if (search) q.set('search', search)
    if (limit != null) q.set('limit', String(limit))
    if (offset != null) q.set('offset', String(offset))
    return mgmtApi.get(`/api/customers?${q}`)
  },
  summary: () => mgmtApi.get('/api/customers/summary'),
  get: (id: string) => mgmtApi.get(`/api/customers/${id}`),
  create: (data: any) => mgmtApi.post('/api/customers', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/customers/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/customers/${id}`),
  rates: (id: string) => mgmtApi.get(`/api/customers/${id}/rates`),
  addRate: (id: string, data: any) => mgmtApi.post(`/api/customers/${id}/rates`, data),
  removeRate: (id: string, rid: string) => mgmtApi.delete(`/api/customers/${id}/rates/${rid}`),
}

// ── Items & Categories ────────────────────────────────────────────────────
export const itemsApi = {
  list: (params?: { category_id?: string; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams()
    if (params?.category_id) q.set('category_id', params.category_id)
    if (params?.search) q.set('search', params.search)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/items?${q}`)
  },
  get: (id: string) => mgmtApi.get(`/api/items/${id}`),
  create: (data: any) => mgmtApi.post('/api/items', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/items/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/items/${id}`),
  categories: () => mgmtApi.get('/api/items/categories'),
  createCategory: (data: any) => mgmtApi.post('/api/items/categories', data),
  updateCategory: (id: string, data: any) => mgmtApi.put(`/api/items/categories/${id}`, data),
  removeCategory: (id: string) => mgmtApi.delete(`/api/items/categories/${id}`),
}

// ── Transactions ──────────────────────────────────────────────────────────
/**
 * Forces a list endpoint's payload into the `{items, total, limit, offset}`
 * envelope the pages are written against.
 *
 * `GET /api/transactions` shipped as a bare array while every sibling paginated
 * route used the envelope, so the page's `data.items` was `undefined` and
 * `items.reduce(...)` threw. The backend now answers with the envelope; this
 * keeps the page correct during a rolling deploy, where the frontend can be
 * newer than the API. A bare array is not "broken" — it is wrapped, with
 * `total` set to the rows actually returned so paging degrades to a single
 * full page instead of an empty pager.
 */
function asPage<T>(data: unknown, limit: number, offset: number): Paginated<T> {
  if (Array.isArray(data)) {
    return { items: data as T[], total: data.length, limit, offset }
  }
  const obj = (data ?? {}) as Partial<Paginated<T>>
  return {
    items: Array.isArray(obj.items) ? obj.items : [],
    total: typeof obj.total === 'number' ? obj.total : 0,
    limit: typeof obj.limit === 'number' ? obj.limit : limit,
    offset: typeof obj.offset === 'number' ? obj.offset : offset,
  }
}

export const transactionsApi = {
  list: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    if (params?.customer_id) q.set('customer_id', params.customer_id)
    if (params?.search) q.set('search', params.search)
    if (params?.source) q.set('source', params.source)
    const limit = params?.limit ?? 200
    const offset = params?.offset ?? 0
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    return mgmtApi
      .get(`/api/transactions?${q}`)
      .then((r) => ({ ...r, data: asPage<any>(r.data, limit, offset) }))
  },
  get: (id: string) => mgmtApi.get(`/api/transactions/${id}`),
  create: (data: any) => mgmtApi.post('/api/transactions', data),
  bulkCreate: (data: any) => mgmtApi.post('/api/transactions/bulk', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/transactions/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/transactions/${id}`),
}

// ── Expenses ──────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    if (params?.category_id) q.set('category_id', params.category_id)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/expenses?${q}`)
  },
  summary: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    return mgmtApi.get(`/api/expenses/summary?${q}`)
  },
  create: (data: any) => mgmtApi.post('/api/expenses', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/expenses/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/expenses/${id}`),
  categories: () => mgmtApi.get('/api/expenses/categories'),
  createCategory: (data: any) => mgmtApi.post('/api/expenses/categories', data),
  removeCategory: (id: string) => mgmtApi.delete(`/api/expenses/categories/${id}`),
}

// ── Employees ─────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (search = '') => mgmtApi.get(`/api/employees?search=${search}`),
  get: (id: string) => mgmtApi.get(`/api/employees/${id}`),
  create: (data: any) => mgmtApi.post('/api/employees', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/employees/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/employees/${id}`),
  activate: (id: string) => mgmtApi.post(`/api/employees/${id}/activate`),
  salaries: (empId: string, year?: number) =>
    mgmtApi.get(`/api/employees/${empId}/salaries${year ? `?year=${year}` : ''}`),
  createSalary: (empId: string, data: any) => mgmtApi.post(`/api/employees/${empId}/salaries`, data),
  updateSalary: (empId: string, salId: string, data: any) =>
    mgmtApi.put(`/api/employees/${empId}/salaries/${salId}`, data),
  attendance: (empId: string, params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    return mgmtApi.get(`/api/employees/${empId}/attendance?${q}`)
  },
  createAttendance: (empId: string, data: any) => mgmtApi.post(`/api/employees/${empId}/attendance`, data),
}

// ── Payments ──────────────────────────────────────────────────────────────
export const paymentsApi = {
  list: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.customer_id) q.set('customer_id', params.customer_id)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/payments?${q}`)
  },
  create: (data: any) => mgmtApi.post('/api/payments', data),
  remove: (id: string) => mgmtApi.delete(`/api/payments/${id}`),
}

// ── Reports ───────────────────────────────────────────────────────────────
export const reportsApi = {
  profitLoss: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    if (params?.customer_id) q.set('customer_id', params.customer_id)
    return mgmtApi.get(`/api/reports/profit-loss?${q}`)
  },
  daily: (date?: string) => mgmtApi.get(`/api/reports/daily${date ? `?report_date=${date}` : ''}`),
  monthly: (year?: number, month?: number) => {
    const q = new URLSearchParams()
    if (year) q.set('year', String(year))
    if (month) q.set('month', String(month))
    return mgmtApi.get(`/api/reports/monthly?${q}`)
  },
  outstanding: () => mgmtApi.get('/api/reports/outstanding'),
}

// ── Import ────────────────────────────────────────────────────────────────
export const importApi = {
  downloadTemplate: () => mgmtApi.get('/api/import/template', { responseType: 'blob' }),
  preview: (formData: FormData) =>
    mgmtApi.post('/api/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  execute: (formData: FormData) =>
    mgmtApi.post('/api/import/execute', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  history: () => mgmtApi.get('/api/import/history'),
}

// ── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => mgmtApi.get('/api/dashboard'),
}

// ── Salary Management ────────────────────────────────────────────────────
export const salaryApi = {
  calculate: (employeeId: string, year: number, month: number) =>
    mgmtApi.get(`/api/salary/calculate?employee_id=${employeeId}&year=${year}&month=${month}`),
  calculatePeriod: (employeeId: string, periodStart: string, periodEnd: string, periodType: string = 'MONTHLY') =>
    mgmtApi.post(`/api/salary/calculate-period?employee_id=${employeeId}&period_start=${periodStart}&period_end=${periodEnd}&period_type=${periodType}`),
  createSlip: (data: any) => mgmtApi.post('/api/salary/slip', data),
  listSlips: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.employee_id) q.set('employee_id', params.employee_id)
    if (params?.status) q.set('status', params.status)
    if (params?.year) q.set('year', String(params.year))
    if (params?.month) q.set('month', String(params.month))
    if (params?.deleted) q.set('deleted', String(params.deleted))
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/salary/slips?${q}`)
  },
  getSlip: (slipId: string) => mgmtApi.get(`/api/salary/slips/${slipId}`),
  updateSlip: (slipId: string, data: any) => mgmtApi.put(`/api/salary/slips/${slipId}`, data),
  finalizeSlip: (slipId: string) => mgmtApi.post(`/api/salary/slips/${slipId}/finalize`),
  cancelSlip: (slipId: string) => mgmtApi.post(`/api/salary/slips/${slipId}/cancel`),
  deleteSlip: (slipId: string) => mgmtApi.delete(`/api/salary/slips/${slipId}`),
  paySlip: (slipId: string, amount: number) =>
    mgmtApi.post(`/api/salary/slips/${slipId}/pay?amount=${amount}`),
  employeeHistory: (empId: string) => mgmtApi.get(`/api/employees/${empId}/salary-history`),
  payrollPreview: (year: number, month: number) =>
    mgmtApi.get(`/api/salary/payroll-preview?year=${year}&month=${month}`),
  payrollRun: (year: number, month: number) =>
    mgmtApi.post(`/api/salary/payroll-run?year=${year}&month=${month}`),
}

// ── Salary Packages (per-month arrangement overrides) ───────────────────────
export const salaryPackagesApi = {
  list: (params?: { employee_id?: string; month?: string }) => {
    const q = new URLSearchParams()
    if (params?.employee_id) q.set('employee_id', params.employee_id)
    if (params?.month) q.set('month', params.month)
    return mgmtApi.get(`/api/salary/packages?${q}`)
  },
  upsert: (data: any) => mgmtApi.post('/api/salary/packages', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/salary/packages/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/salary/packages/${id}`),
}

// ── Advances ─────────────────────────────────────────────────────────────
export const advancesApi = {
  list: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.employee_id) q.set('employee_id', params.employee_id)
    if (params?.status) q.set('status', params.status)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/advances?${q}`)
  },
  get: (id: string) => mgmtApi.get(`/api/advances/${id}`),
  create: (data: any) => mgmtApi.post('/api/advances', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/advances/${id}`, data),
  cancel: (id: string) => mgmtApi.delete(`/api/advances/${id}`),
  employeeAdvances: (empId: string, status?: string) =>
    mgmtApi.get(`/api/employees/${empId}/advances${status ? `?status=${status}` : ''}`),
  employeeSummary: (empId: string) => mgmtApi.get(`/api/employees/${empId}/advances/summary`),
}

// ── Holidays ─────────────────────────────────────────────────────────────
export const holidaysApi = {
  list: (year?: number) => mgmtApi.get(`/api/holidays${year ? `?year=${year}` : ''}`),
  get: (id: string) => mgmtApi.get(`/api/holidays/${id}`),
  create: (data: any) => mgmtApi.post('/api/holidays', data),
  update: (id: string, data: any) => mgmtApi.put(`/api/holidays/${id}`, data),
  remove: (id: string) => mgmtApi.delete(`/api/holidays/${id}`),
  check: (date: string) => mgmtApi.get(`/api/holidays/check/${date}`),
}

// ── Extra Work ───────────────────────────────────────────────────────────
export const extraWorkApi = {
  categories: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.is_active !== undefined) q.set('is_active', String(params.is_active))
    return mgmtApi.get(`/api/extra-work/categories?${q}`)
  },
  getCategory: (id: string) => mgmtApi.get(`/api/extra-work/categories/${id}`),
  createCategory: (data: any) => mgmtApi.post('/api/extra-work/categories', data),
  updateCategory: (id: string, data: any) => mgmtApi.put(`/api/extra-work/categories/${id}`, data),
  deleteCategory: (id: string) => mgmtApi.delete(`/api/extra-work/categories/${id}`),
  records: (params?: any) => {
    const q = new URLSearchParams()
    if (params?.employee_id) q.set('employee_id', params.employee_id)
    if (params?.category_id) q.set('category_id', params.category_id)
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    if (params?.limit != null) q.set('limit', String(params.limit))
    if (params?.offset != null) q.set('offset', String(params.offset))
    return mgmtApi.get(`/api/extra-work/records?${q}`)
  },
  createRecord: (data: any) => mgmtApi.post('/api/extra-work/records', data),
  updateRecord: (id: string, data: any) => mgmtApi.put(`/api/extra-work/records/${id}`, data),
  deleteRecord: (id: string) => mgmtApi.delete(`/api/extra-work/records/${id}`),
}

// ── Company Settings ─────────────────────────────────────────────────────
export const companySettingsApi = {
  get: () => mgmtApi.get('/api/company-settings'),
  update: (data: any) => mgmtApi.put('/api/company-settings', data),
}

// ── Attendance (Enhanced) ────────────────────────────────────────────────
export const attendanceApi = {
  list: (empId: string, params?: any) => {
    const q = new URLSearchParams()
    if (params?.start_date) q.set('start_date', params.start_date)
    if (params?.end_date) q.set('end_date', params.end_date)
    return mgmtApi.get(`/api/employees/${empId}/attendance?${q}`)
  },
  summary: (empId: string, startDate: string, endDate: string) =>
    mgmtApi.get(`/api/attendance/summary?employee_id=${empId}&start_date=${startDate}&end_date=${endDate}`),
  create: (empId: string, data: any) => mgmtApi.post(`/api/employees/${empId}/attendance`, data),
  update: (attendanceId: string, data: any) => mgmtApi.put(`/api/attendance/${attendanceId}`, data),
  remove: (attendanceId: string) => mgmtApi.delete(`/api/attendance/${attendanceId}`),
  bulkSet: (empId: string, dates: string[], status: string, overtimeHours?: number) =>
    mgmtApi.post(`/api/attendance/bulk?employee_id=${empId}&status=${status}${overtimeHours ? `&overtime_hours=${overtimeHours}` : ''}&${dates.map(d => `dates=${d}`).join('&')}`),
  listForDate: (date: string) => mgmtApi.get(`/api/attendance?start_date=${date}&end_date=${date}`),
  listRange: (startDate: string, endDate: string) =>
    mgmtApi.get(`/api/attendance?start_date=${startDate}&end_date=${endDate}`),
  bulkDay: (data: { date: string; records: { employee_id: string; status: string; overtime_hours: number }[] }) =>
    mgmtApi.post('/api/attendance/bulk-day', data),
}

export default mgmtApi
