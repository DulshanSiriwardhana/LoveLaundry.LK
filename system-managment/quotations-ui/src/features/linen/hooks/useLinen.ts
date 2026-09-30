import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { linenService } from '../services/linen.service'
import type { LinenListParams, LinenBulkCreate, LinenScanAction, LinenTagGenerate } from '../../../types/linen'

export const linenKeys = {
  all: ['linens'] as const,
  list: (params: LinenListParams) => [...linenKeys.all, 'list', params] as const,
  detail: (id: string) => [...linenKeys.all, id] as const,
  byCode: (code: string) => [...linenKeys.all, 'code', code] as const,
  events: (id: string) => [...linenKeys.all, id, 'events'] as const,
  stats: () => [...linenKeys.all, 'stats'] as const,
}

export function useLinens(params: LinenListParams = {}) {
  return useQuery({
    queryKey: linenKeys.list(params),
    queryFn: () => linenService.listLinens(params),
  })
}

export function useLinen(docId?: string) {
  return useQuery({
    queryKey: linenKeys.detail(docId ?? ''),
    queryFn: () => linenService.getLinen(docId ?? ''),
    enabled: Boolean(docId),
  })
}

export function useLinenByCode(code?: string) {
  return useQuery({
    queryKey: linenKeys.byCode(code ?? ''),
    queryFn: () => linenService.getLinenByCode(code ?? ''),
    enabled: Boolean(code),
  })
}

export function useLinenEvents(docId?: string) {
  return useQuery({
    queryKey: linenKeys.events(docId ?? ''),
    queryFn: () => linenService.getLinenEvents(docId ?? ''),
    enabled: Boolean(docId),
  })
}

export function useLinenStats() {
  return useQuery({
    queryKey: linenKeys.stats(),
    queryFn: () => linenService.getLinenStats(),
  })
}

export function useCreateLinenBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LinenBulkCreate) => linenService.createLinenBulk(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: linenKeys.all })
      toast.success(`Created ${data.count} linen items`)
    },
    onError: () => toast.error('Failed to create linen items'),
  })
}

export function useGenerateTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: LinenTagGenerate) => linenService.generateTags(payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: linenKeys.all })
      toast.success(`Generated ${data.count} linen tags`)
    },
    onError: () => toast.error('Failed to generate tags'),
  })
}

export function useScanLinen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ docId, payload }: { docId: string; payload: LinenScanAction }) =>
      linenService.scanLinen(docId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linenKeys.all })
    },
    onError: () => toast.error('Failed to scan linen'),
  })
}

export function useBulkScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ codes, action, location }: { codes: string[]; action: string; location?: string }) =>
      linenService.bulkScan(codes, action, location),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: linenKeys.all })
      toast.success(`Processed ${data.total_processed} items`)
    },
    onError: () => toast.error('Failed to bulk scan'),
  })
}

export function useDeleteLinen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: string) => linenService.deleteLinen(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linenKeys.all })
      toast.success('Linen deleted')
    },
    onError: () => toast.error('Failed to delete linen'),
  })
}
