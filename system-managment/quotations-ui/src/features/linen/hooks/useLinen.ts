import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { linenService } from '../services/linen.service'
import type { Linen, LinenListParams, LinenBulkCreate, LinenScanAction, LinenTagGenerate } from '../../../types/linen'

export const linenKeys = {
  all: ['linens'] as const,
  list: (params: LinenListParams) => [...linenKeys.all, 'list', params] as const,
  detail: (id: string) => [...linenKeys.all, id] as const,
  byCode: (code: string) => [...linenKeys.all, 'code', code] as const,
  verify: (code: string) => [...linenKeys.all, 'verify', code] as const,
  events: (id: string) => [...linenKeys.all, id, 'events'] as const,
  stats: () => [...linenKeys.all, 'stats'] as const,
  transitions: () => [...linenKeys.all, 'transitions'] as const,
  /** Base key so any live event can refresh every overdue list at once. */
  missing: () => [...linenKeys.all, 'missing'] as const,
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

export interface LinenVerificationQuery {
  code: string
  state: 'pending' | 'success' | 'error'
  linen?: Linen
  isFetching: boolean
  dataUpdatedAt: number
  errorUpdatedAt: number
  error: unknown
}

function isNotFound(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status === 404
}

/** Verify every distinct code in a session without recording a scan. */
export function useLinenVerifications(codes: string[], enabled = true): LinenVerificationQuery[] {
  return useQueries({
    queries: codes.map(code => ({
      queryKey: linenKeys.verify(code),
      queryFn: () => linenService.verifyLinenCode(code),
      enabled: enabled && Boolean(code),
      staleTime: 60_000,
      retry: (failureCount: number, error: unknown) => !isNotFound(error) && failureCount < 1,
    })),
    combine: results => results.map((result, index) => ({
      code: codes[index],
      state: result.status,
      linen: result.data,
      isFetching: result.isFetching,
      dataUpdatedAt: result.dataUpdatedAt,
      errorUpdatedAt: result.errorUpdatedAt,
      error: result.error,
    })),
  })
}

/** Linens the admin-defined cycle window says should have been scanned. */
export function useMissingInCycle(days?: number, enabled = true) {
  const valid = enabled && typeof days === 'number' && Number.isFinite(days) && days > 0
  return useQuery({
    queryKey: [...linenKeys.missing(), days ?? null],
    queryFn: () => linenService.getMissingInCycle(days as number),
    enabled: valid,
    staleTime: 15_000,
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

/** The action catalogue is server-owned and changes far less often than the
 * linen data, so it is cached separately from the inventory queries. */
export function useLinenTransitions() {
  return useQuery({
    queryKey: linenKeys.transitions(),
    queryFn: () => linenService.getTransitions(),
    staleTime: 10 * 60 * 1000,
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
