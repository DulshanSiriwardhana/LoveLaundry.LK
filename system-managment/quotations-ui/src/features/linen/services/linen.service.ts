import billsApi from '../../../api/bills-api'
import type {
  Linen,
  LinenListResponse,
  LinenEventListResponse,
  LinenStats,
  LinenListParams,
  LinenBulkCreate,
  LinenScanAction,
  LinenTagGenerate,
  LinenTransitionList,
  LinenBulkScanResult,
  LinenMissingInCycleResponse,
} from '../../../types/linen'

async function listLinens(params: LinenListParams = {}): Promise<LinenListResponse> {
  const response = await billsApi.get<LinenListResponse>('/linens', { params })
  return response.data
}

async function getLinen(docId: string): Promise<Linen> {
  const response = await billsApi.get<Linen>(`/linens/${docId}`)
  return response.data
}

async function getLinenByCode(code: string): Promise<Linen> {
  const response = await billsApi.get<Linen>(`/linens/by-code/${code}`)
  return response.data
}

/** Non-mutating proof that a QR belongs to the signed-in laundry. */
async function verifyLinenCode(code: string): Promise<Linen> {
  const response = await billsApi.get<Linen>(`/linens/verify/${encodeURIComponent(code)}`)
  return response.data
}

async function getMissingInCycle(days: number, limit = 200): Promise<LinenMissingInCycleResponse> {
  const response = await billsApi.get<LinenMissingInCycleResponse>('/linens/missing-in-cycle', {
    params: { days, limit },
  })
  return response.data
}

async function createLinenBulk(payload: LinenBulkCreate): Promise<{ items: Linen[]; count: number }> {
  const response = await billsApi.post<{ items: Linen[]; count: number }>('/linens/bulk', payload)
  return response.data
}

async function generateTags(payload: LinenTagGenerate): Promise<{ items: Linen[]; count: number }> {
  const response = await billsApi.post<{ items: Linen[]; count: number }>('/linens/generate-tags', payload)
  return response.data
}

async function scanLinen(docId: string, payload: LinenScanAction): Promise<Linen> {
  const response = await billsApi.post<Linen>(`/linens/${docId}/scan`, payload)
  return response.data
}

async function bulkScan(codes: string[], action: string, location?: string): Promise<LinenBulkScanResult> {
  const response = await billsApi.post<LinenBulkScanResult>('/linens/bulk-scan', codes, { params: { action, location } })
  return response.data
}

async function getTransitions(): Promise<LinenTransitionList> {
  const response = await billsApi.get<LinenTransitionList>('/linens/transitions')
  return response.data
}

async function getLinenEvents(docId: string, params: { skip?: number; limit?: number } = {}): Promise<LinenEventListResponse> {
  const response = await billsApi.get<LinenEventListResponse>(`/linens/${docId}/events`, { params })
  return response.data
}

async function getLinenStats(): Promise<LinenStats> {
  const response = await billsApi.get<LinenStats>('/linens/stats/summary')
  return response.data
}

async function deleteLinen(docId: string): Promise<void> {
  await billsApi.delete(`/linens/${docId}`)
}

export const linenService = {
  listLinens,
  getLinen,
  getLinenByCode,
  verifyLinenCode,
  getMissingInCycle,
  createLinenBulk,
  generateTags,
  scanLinen,
  bulkScan,
  getTransitions,
  getLinenEvents,
  getLinenStats,
  deleteLinen,
}
