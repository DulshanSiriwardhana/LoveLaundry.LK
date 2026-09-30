import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shopBillService } from '../services/shop-bill.service'
import type { LegacyInvoiceCreate } from '../../../types/shop-bill'

export const legacyInvoiceKeys = {
  all: ['legacy-invoices'] as const,
  list: (params?: { skip?: number; limit?: number; search?: string }) =>
    [...legacyInvoiceKeys.all, 'list', params] as const,
  detail: (id: string) => [...legacyInvoiceKeys.all, id] as const,
}

export function useLegacyInvoices(params?: { skip?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: legacyInvoiceKeys.list(params),
    queryFn: () => shopBillService.listLegacyInvoices(params),
  })
}

export function useLegacyInvoice(id?: string) {
  return useQuery({
    queryKey: legacyInvoiceKeys.detail(id ?? ''),
    queryFn: () => shopBillService.getLegacyInvoice(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateLegacyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LegacyInvoiceCreate) => shopBillService.createLegacyInvoice(payload),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success(`Invoice ${invoice.invoice_number} saved`)
    },
    onError: () => toast.error('Failed to save invoice'),
  })
}

export function useDeleteLegacyInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.deleteLegacyInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: legacyInvoiceKeys.all })
      toast.success('Invoice deleted')
    },
    onError: () => toast.error('Failed to delete invoice'),
  })
}