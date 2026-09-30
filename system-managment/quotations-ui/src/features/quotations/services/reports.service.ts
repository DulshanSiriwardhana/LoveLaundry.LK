import billsApi from '../../../api/bills-api'
import { idempotencyKey } from '../../../lib/idempotency'
import type { Payment, PaymentCreate } from '../../../types/operations'
import type { ClientSummary, LinenFlowResponse } from '../../../types/operations'

export const reports = {
    /**
     * Per-hotel linen flow with server-computed quantities.
     *
     * The hotel linen flow screen used to fetch every gate pass and every
     * delivery and rebuild the balance in the browser, crediting a
     * multi-pass delivery entirely to its primary gate pass. Period filtering
     * happened there too, so drawing one quarter loaded the whole collection.
     */
    linenFlow: (period: 'all' | 'month' | 'quarter' | 'year' = 'all') =>
        billsApi
            .get<LinenFlowResponse>('/dashboard/linen-flow', { params: { period } })
            .then((r: any) => r.data),

    clientSummary: (client_name: string) =>
        billsApi.get<ClientSummary>('/dashboard/client-summary', { params: { client_name } }).then((r: any) => r.data),

    clientWise: () =>
        billsApi.get<object[]>('/reports/client-wise').then((r: any) => r.data),

    itemWise: () =>
        billsApi.get<object[]>('/reports/item-wise').then((r: any) => r.data),

    gatepassWise: () =>
        billsApi.get<object[]>('/reports/gatepass-wise').then((r: any) => r.data),

    billing: () =>
        billsApi.get<{ total_sales: number; pending_bills_amount: number; paid_bills_amount: number; outstanding_amount: number }>('/reports/billing').then((r: any) => r.data),

    auditLogs: (limit = 50) =>
        billsApi.get<object[]>('/audit-logs', { params: { limit } }).then((r: any) => r.data),

    exportCSV: async (type: 'gatepasses' | 'bills' | 'deliveries', params?: Record<string, string>) => {
        const response = await billsApi.get(`/export/${type}`, {
            params,
            responseType: 'blob',
        })
        const blob = new Blob([response.data], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
    },

    exportExcel: async (type: 'gatepasses' | 'bills' | 'deliveries', params?: Record<string, string>) => {
        const response = await billsApi.get(`/export/${type}/xlsx`, {
            params,
            responseType: 'blob',
        })
        const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}-${new Date().toISOString().slice(0, 10)}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
    },
}

export const payments = {
    listForBill: (billId: string) =>
        billsApi.get<Payment[]>(`/bills/${billId}/payments`).then((r: any) => r.data),

    create: async (billId: string, data: PaymentCreate) => {
        const key = await idempotencyKey({ bill_id: billId, ...data })
        return billsApi.post<Payment>(`/bills/${billId}/payments`, data, {
            headers: { 'X-Idempotency-Key': key },
        }).then((r: any) => r.data)
    },
}
