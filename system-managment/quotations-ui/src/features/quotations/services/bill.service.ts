import billsApi from '../../../api/bills-api'
import { idempotencyKey } from '../../../lib/idempotency'
import type { Bill, BillPayload, BillListParams, BillListResponse, UnbilledGatePass } from '../../../types/bill'

async function createBill(payload: BillPayload): Promise<Bill> {
  const key = await idempotencyKey(payload)
  const response = await billsApi.post<Bill>('/bills', payload, {
    headers: { 'X-Idempotency-Key': key },
  })
  return response.data
}

async function getBills(params: BillListParams = {}): Promise<BillListResponse> {
  const response = await billsApi.get<BillListResponse>('/bills', { params })
  return response.data
}

async function getBill(id: string): Promise<Bill> {
  const response = await billsApi.get<Bill>(`/bills/${id}`)
  return response.data
}

async function getUnbilledGatePasses(client_name?: string): Promise<UnbilledGatePass[]> {
  const response = await billsApi.get<UnbilledGatePass[]>('/bills/unbilled-gatepasses', {
    params: client_name ? { client_name } : {},
  })
  return response.data
}

async function deleteBill(id: string): Promise<{ message: string }> {
  const response = await billsApi.delete<{ message: string }>(`/bills/${id}`)
  return response.data
}

async function editBill(id: string, payload: Partial<BillPayload>): Promise<Bill> {
  const response = await billsApi.patch<Bill>(`/bills/${id}`, payload)
  return response.data
}

export const billService = { createBill, getBills, getBill, getUnbilledGatePasses, deleteBill, editBill }