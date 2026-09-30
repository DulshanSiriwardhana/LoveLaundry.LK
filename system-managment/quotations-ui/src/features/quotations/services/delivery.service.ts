import billsApi from '../../../api/bills-api'
import { idempotencyKey } from '../../../lib/idempotency'
import { withItems } from '../../../lib/api-normalise'
import type {
    AvailabilityResponse,
    Delivery,
    DeliveryBalanceResponse,
    DeliveryCancel,
    DeliveryCorrection,
    DeliveryCreate,
} from '../../../types/operations'

function toISODatetime(dateStr: string): string {
    // If already a full datetime string, return as-is
    if (dateStr.includes('T')) return dateStr
    // Convert plain date "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00"
    return `${dateStr}T00:00:00`
}

export interface PendingGatePassItem {
    item_name: string
    specification: string
    category: string
    received_qty: number
    delivered_qty: number
    returned_qty: number
    pending_qty: number
}

export interface PendingGatePass {
    gate_pass_id: string
    gate_pass_number: string
    client_name: string
    receiving_date: string
    status: string
    total_pending: number
    items: PendingGatePassItem[]
}

export const deliveries = {
    list: (params?: {
        client_name?: string
        gate_pass_id?: string
        date_from?: string
        date_to?: string
        include_cancelled?: boolean
    }): Promise<Delivery[]> =>
        billsApi.get<Delivery[]>('/deliveries', { params }).then(r => withItems(r.data)),

    get: (id: string) =>
        billsApi.get<Delivery>(`/deliveries/${id}`).then((r: any) => r.data),

    updateDate: (id: string, delivery_date: string, reason?: string) =>
        billsApi.patch<Delivery>(`/deliveries/${id}/date`, { delivery_date: toISODatetime(delivery_date), reason }).then((r: any) => r.data),

    /**
     * One delivery, possibly drawing items from several gate passes.
     *
     * This is a SINGLE request. Splitting it into one POST per gate pass meant
     * a mid-batch failure left some passes delivered and others not, with no
     * way back — the server rejects the whole document atomically instead.
     */
    create: async (data: DeliveryCreate) => {
        const payload = {
            ...data,
            delivery_date: toISODatetime(data.delivery_date),
        }
        const key = await idempotencyKey(payload)
        return billsApi.post<Delivery>('/deliveries', payload, {
            headers: { 'X-Idempotency-Key': key },
        }).then((r: any) => r.data)
    },

    pendingGatePasses: (clientName?: string) =>
        billsApi.get<PendingGatePass[]>('/deliveries/pending-gatepasses', {
            params: clientName ? { client_name: clientName } : {},
        }).then((r: any) => r.data),

    /**
     * What is deliverable right now, per hotel and per source gate pass.
     *
     * This is the single source of truth the delivery form, the gate-pass
     * detail page and the dashboard all render, so the number a user is shown
     * is always exactly the number the server will accept.
     */
    available: (clientName?: string) =>
        billsApi
            .get<AvailabilityResponse>('/deliveries/available', {
                params: clientName ? { client_name: clientName } : {},
            })
            .then((r: any) => r.data),

    /**
     * A delivery plus the resulting balance of every gate pass it touched.
     *
     * Answers "what did we record, what was it corrected to, who changed it and
     * why, and what now remains on each source pass" in one call.
     */
    balance: (deliveryId: string) =>
        billsApi
            .get<DeliveryBalanceResponse>(`/deliveries/${deliveryId}/balance`)
            .then((r: any) => r.data),

    /**
     * Correct recorded delivery quantities. The original values are kept in the
     * delivery's `corrections` history and in the event journal; a reason is
     * mandatory.
     */
    correctItems: (id: string, data: DeliveryCorrection) =>
        billsApi
            .patch<Delivery>(`/deliveries/${id}/items`, data)
            .then((r: any) => r.data),

    /** Void a mis-recorded delivery, releasing its quantities to the balances. */
    cancel: (id: string, data: DeliveryCancel) =>
        billsApi
            .post<Delivery>(`/deliveries/${id}/cancel`, data)
            .then((r: any) => r.data),
}
