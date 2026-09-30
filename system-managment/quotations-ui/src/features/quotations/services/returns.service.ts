import billsApi from '../../../api/bills-api'
import type { Return, ReturnCreate } from '../../../types/operations'

export type ReturnUpdatePayload = {
  status?: string
  items?: import('../../../types/operations').ReturnItem[]
  bill_adjustment?: import('../../../types/operations').BillAdjustment
  notes?: string
}

export const returns = {
  list: (params?: { client_name?: string; status?: string; gate_pass_id?: string; skip?: number; limit?: number }) =>
    billsApi.get<{ items: Return[]; total: number }>('/returns', { params }).then((r: any) => r.data),

  get: (returnId: string) =>
    billsApi.get<Return>(`/returns/${returnId}`).then((r: any) => r.data),

  create: (data: ReturnCreate) =>
    billsApi.post<Return>('/returns', data).then((r: any) => r.data),

  update: (returnId: string, data: ReturnUpdatePayload) =>
    billsApi.patch<Return>(`/returns/${returnId}`, data).then((r: any) => r.data),

  markResent: (returnId: string, itemName: string, specification: string = '') =>
    billsApi.post<Return>(`/returns/${returnId}/resent`, null, { params: { item_name: itemName, specification } }).then((r: any) => r.data),

  pendingResent: (clientName?: string) =>
    billsApi.get<Array<{ return_id: string; client_name: string; items: any[]; created_at: string }>>('/returns/pending-resent', { params: { client_name: clientName } }).then((r: any) => r.data),

  summary: () =>
    billsApi.get<{ total: number; pending: number; received: number; processed: number }>('/returns/stats/summary').then((r: any) => r.data),
}
