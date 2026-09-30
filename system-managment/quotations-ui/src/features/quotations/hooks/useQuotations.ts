import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { quotationService } from '../services/quotation.service'
import type { Quotation, QuotationPayload, OrderStatus, GarmentTag } from '../../../types/quotation'

export const quotationKeys = {
  all: ['quotations'] as const,
  list: () => [...quotationKeys.all] as const,
  detail: (id: string) => [...quotationKeys.all, id] as const,
  tags: (id: string) => [...quotationKeys.all, 'tags', id] as const,
}

export function useQuotations() {
  return useQuery({
    queryKey: quotationKeys.list(),
    queryFn: quotationService.getAllQuotations,
  })
}

export function useQuotation(id?: string) {
  return useQuery({
    queryKey: quotationKeys.detail(id ?? ''),
    queryFn: () => quotationService.getQuotation(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: QuotationPayload) => quotationService.createQuotation(payload),
    onSuccess: (created) => {
      qc.setQueryData<Quotation[]>(quotationKeys.list(), (prev = []) => [created, ...prev])
      qc.invalidateQueries({ queryKey: quotationKeys.list() })
      toast.success('Quotation created')
    },
    onError: () => toast.error('Failed to create quotation'),
  })
}

export function useUpdateQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QuotationPayload }) =>
      quotationService.updateQuotation(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Quotation[]>(quotationKeys.list(), (prev = []) =>
        prev.map(q => (q.id === updated.id ? updated : q)),
      )
      qc.setQueryData<Quotation>(quotationKeys.detail(String(updated.id)), updated)
      qc.invalidateQueries({ queryKey: quotationKeys.list() })
      toast.success('Quotation updated')
    },
    onError: () => toast.error('Failed to update quotation'),
  })
}

export function useDeleteQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => quotationService.deleteQuotation(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: quotationKeys.list() })
      const previous = qc.getQueryData<Quotation[]>(quotationKeys.list())
      qc.setQueryData<Quotation[]>(quotationKeys.list(), (prev = []) =>
        prev.filter(q => String(q.id) !== id),
      )
      return { previous }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(quotationKeys.list(), ctx.previous)
      toast.error('Deletion failed')
    },
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: quotationKeys.detail(id) })
      toast.success('Quotation deleted')
    },
  })
}

export function useAdvanceQuotationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      quotationService.advanceStatus(id, status, note),
    onSuccess: (updated) => {
      qc.setQueryData<Quotation>(quotationKeys.detail(String(updated.id)), updated)
      qc.invalidateQueries({ queryKey: quotationKeys.list() })
      toast.success(`Moved to "${updated.status}"`)
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update status'),
  })
}

export function useQuotationTags(id?: string) {
  return useQuery({
    queryKey: quotationKeys.tags(id ?? ''),
    queryFn: () => quotationService.listTags(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: { count?: number; per_item?: boolean; label?: string }
    }) => quotationService.createTags(id, body),
    onSuccess: (data) => {
      qc.setQueryData<GarmentTag[]>(quotationKeys.tags(String(data.quotation_id)), data.tags)
      toast.success(
        data.tags.length === 1 ? 'Tag generated' : `${data.tags.length} tags generated`,
      )
    },
    onError: () => toast.error('Failed to generate tags'),
  })
}
