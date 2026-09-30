import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQuotations } from './useQuotations'
import { dashboardApi, type ActivityEntry, type OutstandingAging, type YearlyTrendPoint } from '../services/dashboard.service'
import type { Quotation } from '../../../types/quotation'

export type DashboardPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface TopClient {
  client_name: string
  revenue: number
  outstanding: number
  bills: number
}

export interface SeriesPoint {
  key: string
  label: string
  revenue: number
  collected: number
}

export interface StatusSlice {
  name: string
  value: number
  color: string
}

export interface PendingGatePassItem {
  item_name: string
  specification: string
  category: string
  received: number
  delivered: number
  pending: number
}

export interface PendingGatePass {
  gate_pass_number: string
  client_name: string
  pending: number
  items: PendingGatePassItem[]
}

export interface PeriodMetrics {
  revenue: number
  collected: number
  outstanding: number
  collectionRate: number
  avgBill: number
  billCount: number
  paidBills: number
  partialBills: number
  pendingBills: number
  gatePasses: number
  itemsReceived: number
  itemsDelivered: number
  itemsPending: number
  activeClients: number
  newClients: number
  quotationsDraft: number
  quotationsSent: number
  quotationsAccepted: number
  quotationAcceptedValue: number
  topClients: TopClient[]
  revenueSeries: SeriesPoint[]
  paymentStatus: StatusSlice[]
  pendingGatePasses: PendingGatePass[]
}

export interface DashboardAlert {
  id: string
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface DashboardSummaryResponse {
  current: PeriodMetrics
  previous: PeriodMetrics
}

export interface ClientWiseItem {
  item_name: string
  specification: string
  category: string
  received: number
  delivered: number
  pending: number
}

export interface GatePassSummary {
  gate_pass_number: string
  receiving_date: string
  items: { item_name: string; specification: string; received: number }[]
}

export interface ClientWiseEntry {
  client_name: string
  total_received: number
  total_delivered: number
  total_pending: number
  total_mismatches: number
  total_billed: number
  paid_amount: number
  outstanding: number
  gate_pass_count: number
  items: ClientWiseItem[]
  gate_passes: GatePassSummary[]
}

export interface ItemWiseEntry {
  item_name: string
  total_received: number
  total_delivered: number
  pending: number
  mismatch_count: number
  client_count: number
}

export interface TodayDeliveryItem {
  item_name: string
  specification: string
  quantity: number
}

export interface TodayDeliveryNote {
  gate_pass_number: string
  note: string
  delivered_date?: string
}

export interface TodayDeliveryClient {
  client_name: string
  delivered_items: TodayDeliveryItem[]
  total_qty: number
  pending_items: { item_name: string; specification: string; received: number; delivered: number; returned?: number; pending: number }[]
  note_deliveries?: TodayDeliveryNote[]
  has_note_delivery?: boolean
}

export interface DashboardOverviewData {
  current: PeriodMetrics
  previous: PeriodMetrics
  alerts: DashboardAlert[]
  activity: ActivityEntry[]
  clientWise: ClientWiseEntry[]
  itemWise: ItemWiseEntry[]
  aging: OutstandingAging
  yearlyTrend: YearlyTrendPoint[]
  todayDeliveries: TodayDeliveryClient[]
}

function buildAlerts(m: PeriodMetrics): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  if (m.collectionRate < 70 && m.revenue > 0) {
    alerts.push({
      id: 'collection',
      severity: 'high',
      message: `Collection rate is ${m.collectionRate.toFixed(1)}%. Prioritize follow-ups on ${m.pendingBills} unpaid bills.`,
    })
  }
  if (m.outstanding > 0 && m.outstanding > m.revenue * 0.4) {
    alerts.push({
      id: 'outstanding',
      severity: 'medium',
      message: `Outstanding receivables are ${((m.outstanding / Math.max(1, m.revenue)) * 100).toFixed(0)}% of revenue (${m.outstanding.toFixed(0)} LKR).`,
    })
  }
  if (m.itemsPending > 50) {
    alerts.push({
      id: 'pending-items',
      severity: 'medium',
      message: `${m.itemsPending} items are still pending delivery across ${m.gatePasses} gate passes.`,
    })
  }
  if (m.quotationsAccepted > 0 && m.quotationsDraft + m.quotationsSent > 0) {
    const conv =
      m.quotationsAccepted / (m.quotationsAccepted + m.quotationsDraft + m.quotationsSent)
    if (conv < 0.4) {
      alerts.push({
        id: 'conversion',
        severity: 'low',
        message: `Quotation conversion is ${(conv * 100).toFixed(0)}%. ${m.quotationsDraft} drafts are still open.`,
      })
    }
  }
  return alerts
}

export function useDashboardOverview(period: DashboardPeriod) {
  const quotesQ = useQuotations()
  const summaryQ = useQuery({
    queryKey: ['dashboard', 'summary', period],
    queryFn: () => dashboardApi.getSummary(period),
  })
  const activityQ = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.getRecentActivity(10),
  })
  const clientWiseQ = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: dashboardApi.getClientWise,
  })
  const itemWiseQ = useQuery({
    queryKey: ['reports', 'item-wise'],
    queryFn: dashboardApi.getItemWise,
  })
  const agingQ = useQuery({
    queryKey: ['dashboard', 'outstanding-aging'],
    queryFn: dashboardApi.getOutstandingAging,
  })
  const yearlyQ = useQuery({
    queryKey: ['dashboard', 'yearly-trend'],
    queryFn: dashboardApi.getYearlyTrend,
  })
  const todayDeliveriesQ = useQuery({
    queryKey: ['dashboard', 'today-deliveries'],
    queryFn: dashboardApi.getTodayDeliveries,
  })

  const isLoading = quotesQ.isLoading || summaryQ.isLoading
  const error = (summaryQ.error || quotesQ.error) as Error | null

  const data = useMemo<DashboardOverviewData | null>(() => {
    if (!summaryQ.data || !quotesQ.data) return null
    const quotes = quotesQ.data as Quotation[]

    const applyQuotations = (m: PeriodMetrics): PeriodMetrics => ({
      ...m,
      quotationsDraft: quotes.filter((q) => q.status === 'draft').length,
      quotationsSent: quotes.filter((q) => q.status === 'received').length,
      quotationsAccepted: quotes.filter((q) => q.status === 'delivered').length,
      quotationAcceptedValue: quotes
        .filter((q) => q.status === 'delivered')
        .reduce((s, q) => s + (Number((q as { total_amount?: number }).total_amount) || 0), 0),
    })

    const current = applyQuotations(summaryQ.data.current)
    const previous = applyQuotations(summaryQ.data.previous)
    const alerts = buildAlerts(current)
    return {
      current,
      previous,
      alerts,
      activity: activityQ.data ?? [],
      clientWise: clientWiseQ.data ?? [],
      itemWise: itemWiseQ.data ?? [],
      aging: agingQ.data ?? { current: 0, '30_day': 0, '60_day': 0, '90_day': 0, over_90: 0 },
      yearlyTrend: yearlyQ.data ?? [],
      todayDeliveries: todayDeliveriesQ.data ?? [],
    }
  }, [summaryQ.data, quotesQ.data, activityQ.data, clientWiseQ.data, itemWiseQ.data, agingQ.data, yearlyQ.data, todayDeliveriesQ.data])

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      summaryQ.refetch()
      quotesQ.refetch()
      activityQ.refetch()
      clientWiseQ.refetch()
      itemWiseQ.refetch()
      agingQ.refetch()
      yearlyQ.refetch()
      todayDeliveriesQ.refetch()
    },
  }
}

export { useDashboardOverview as useBusinessDashboard }
