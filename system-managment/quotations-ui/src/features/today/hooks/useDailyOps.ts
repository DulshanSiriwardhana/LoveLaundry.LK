import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ops, dayCloseApi, moneyApi, type DayCloseTotals } from '../services/ops.service'
import { deliveries, type PendingGatePass } from '../../quotations/services/delivery.service'
import { returns as returnsApi } from '../../quotations/services/returns.service'
import { invalidateDeliveryData } from '../../quotations/hooks/useGatePasses'
import { expensesApi } from '../../management/api/management-api'

export const opsKeys = {
  all: ['ops'] as const,
  adjustments: (status?: string) => [...opsKeys.all, 'adjustments', status ?? 'ALL'] as const,
  reconciliation: (status?: string) => [...opsKeys.all, 'reconciliation', status ?? 'ALL'] as const,
  events: (date?: string) => [...opsKeys.all, 'events', date ?? 'ALL'] as const,
  dayClose: (date?: string) => [...opsKeys.all, 'day-close', date ?? 'ALL'] as const,
  dayMoney: (date?: string) => [...opsKeys.all, 'day-money', date ?? 'ALL'] as const,
  expenses: (date?: string) => [...opsKeys.all, 'expenses', date ?? 'ALL'] as const,
  pendingResend: () => [...opsKeys.all, 'pending-resend'] as const,
}

export function useAdjustments(status?: string) {
  return useQuery({
    queryKey: opsKeys.adjustments(status),
    queryFn: () => ops.adjustments.list(status ? { status } : undefined),
  })
}

export function useApproveAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ops.adjustments.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsKeys.all })
      invalidateDeliveryData(qc)
      toast.success('Adjustment approved')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || e?.message || 'Failed to approve adjustment'),
  })
}

export function useRejectAdjustment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => ops.adjustments.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsKeys.all })
      invalidateDeliveryData(qc)
      toast.success('Adjustment rejected')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || e?.message || 'Failed to reject adjustment'),
  })
}

export function useReconciliationIssues(status?: string) {
  return useQuery({
    queryKey: opsKeys.reconciliation(status),
    queryFn: () => ops.reconciliation.issues(status ? { status } : undefined),
  })
}

export function useEvents(date?: string) {
  return useQuery({
    queryKey: opsKeys.events(date),
    queryFn: () => ops.events.list(date ? { date } : undefined),
  })
}

export function usePendingGatePasses() {
  return useQuery<PendingGatePass[]>({
    queryKey: [...opsKeys.all, 'pending-gatepasses'],
    queryFn: () => deliveries.pendingGatePasses(),
  })
}

export function useDayClose(date?: string) {
  return useQuery({
    queryKey: opsKeys.dayClose(date),
    queryFn: () => (date ? dayCloseApi.get(date) : Promise.resolve(null)),
    enabled: Boolean(date),
  })
}

export function useDayMoney(date: string) {
  return useQuery({
    queryKey: opsKeys.dayMoney(date),
    queryFn: () => moneyApi.get(date),
    enabled: Boolean(date),
  })
}

export function useDayExpenses(date: string) {
  return useQuery({
    queryKey: opsKeys.expenses(date),
    queryFn: () => expensesApi.summary({ start_date: date, end_date: date }).then(r => r.data),
    enabled: Boolean(date) && Boolean(import.meta.env.VITE_MGMT_API_URL),
    retry: 1,
  })
}

export function usePendingResend() {
  return useQuery({
    queryKey: opsKeys.pendingResend(),
    queryFn: () => returnsApi.pendingResent(),
    retry: 1,
  })
}

export function useCloseDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { date: string; totals: DayCloseTotals; note?: string }) => dayCloseApi.create(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: opsKeys.all })
      invalidateDeliveryData(qc)
      toast.success(`Day closed for ${data.entity_id}`)
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || e?.message || 'Failed to close the day'),
  })
}
