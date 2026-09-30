import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { billService } from '../services/bill.service'
import type { BillPayload, BillListParams } from '../../../types/bill'

export const billKeys = {
  all: ['bills'] as const,
  list: (params: BillListParams) => [...billKeys.all, 'list', params] as const,
  detail: (id: string) => [...billKeys.all, id] as const,
}

export function useBills(params: BillListParams = {}) {
  return useQuery({
    queryKey: billKeys.list(params),
    queryFn: () => billService.getBills(params),
  })
}

export function useBill(id?: string) {
  return useQuery({
    queryKey: billKeys.detail(id ?? ''),
    queryFn: () => billService.getBill(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useUnbilledGatePasses(client_name?: string) {
  return useQuery({
    queryKey: [...billKeys.all, 'unbilled-gatepasses', client_name ?? ''] as const,
    queryFn: () => billService.getUnbilledGatePasses(client_name),
  })
}

export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: BillPayload) => billService.createBill(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billKeys.all })
      toast.success('Bill saved')
    },
    onError: () => toast.error('Failed to save bill'),
  })
}

export function useEditBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BillPayload> }) =>
      billService.editBill(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billKeys.all })
      toast.success('Bill updated')
    },
    onError: () => toast.error('Failed to update bill'),
  })
}

export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => billService.deleteBill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: billKeys.all })
      toast.success('Bill deleted')
    },
    onError: () => toast.error('Failed to delete bill'),
  })
}