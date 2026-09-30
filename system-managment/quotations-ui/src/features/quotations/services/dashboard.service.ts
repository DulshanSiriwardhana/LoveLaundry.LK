import billsApi from '../../../api/bills-api'
import type { DashboardSummaryResponse } from '../hooks/useBusinessDashboard'

export interface ActivityEntry {
  id: string
  user_id: string
  action: string
  entity: string
  entity_id: string
  details: Record<string, unknown>
  timestamp: string | null
}

export interface OutstandingAging {
  current: number
  '30_day': number
  '60_day': number
  '90_day': number
  over_90: number
}

export interface YearlyTrendPoint {
  key: string
  label: string
  revenue: number
  collected: number
  bills: number
}

export const dashboardApi = {
  getSummary: (period: string) =>
    billsApi
      .get<DashboardSummaryResponse>('/dashboard/summary', { params: { period } })
      .then((r) => r.data),

  getRecentActivity: (limit = 10) =>
    billsApi
      .get<ActivityEntry[]>('/dashboard/recent-activity', { params: { limit } })
      .then((r) => r.data),

  getOutstandingAging: () =>
    billsApi
      .get<OutstandingAging>('/dashboard/outstanding-aging')
      .then((r) => r.data),

  getYearlyTrend: () =>
    billsApi
      .get<YearlyTrendPoint[]>('/dashboard/yearly-trend')
      .then((r) => r.data),

  getClientWise: () =>
    billsApi
      .get<{ client_name: string; total_received: number; total_delivered: number; total_pending: number; total_mismatches: number; total_billed: number; paid_amount: number; outstanding: number; gate_pass_count: number; items: { item_name: string; specification: string; category: string; received: number; delivered: number; pending: number }[]; gate_passes: { gate_pass_number: string; receiving_date: string; items: { item_name: string; specification: string; received: number }[] }[] }[]>('/reports/client-wise')
      .then((r) => r.data),

  getItemWise: () =>
    billsApi
      .get<{ item_name: string; total_received: number; total_delivered: number; pending: number; mismatch_count: number; client_count: number }[]>('/reports/item-wise')
      .then((r) => r.data),

  getTodayDeliveries: () =>
    billsApi
      .get<{ client_name: string; delivered_items: { item_name: string; specification: string; quantity: number }[]; total_qty: number; gate_pass_count: number; outstanding: number; pending_items: { item_name: string; specification: string; received: number; delivered: number; pending: number }[] }[]>('/dashboard/today-deliveries')
      .then((r) => r.data),
}
