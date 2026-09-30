import billsApi from '../../../api/bills-api'
import { withItems } from '../../../lib/api-normalise'
import { dateToStartOfDayISO } from '../../../lib/time'
import type {
    GatePass,
    GatePassBalanceResponse,
    GatePassCreate,
    GatePassDeliveriesResponse,
    GatePassMarkDelivered,
} from '../../../types/operations'

function toISODatetime(dateStr: string): string {
    if (dateStr.includes('T')) return dateStr
    return dateToStartOfDayISO(dateStr)
}

export const gatepasses = {
    list: (params?: { client_name?: string; status?: string }): Promise<GatePass[]> =>
        billsApi.get<GatePass[]>('/gatepasses', { params }).then(r => withItems(r.data)),

    get: (id: string) =>
        billsApi.get<GatePass>(`/gatepasses/${id}`).then((r: any) => r.data),

    create: (data: GatePassCreate) => {
        const payload = {
            ...data,
            receiving_date: toISODatetime(data.receiving_date),
        }
        return billsApi.post<GatePass>('/gatepasses', payload).then((r: any) => r.data)
    },

    updateStatus: (id: string, status: string) =>
        billsApi.patch<GatePass>(`/gatepasses/${id}/status`, null, { params: { status_update: status } }).then((r: any) => r.data),

    markDelivered: (id: string, data: GatePassMarkDelivered) =>
        billsApi.post<GatePass>(`/gatepasses/${id}/mark-delivered`, data).then((r: any) => r.data),

    reopenLegacy: (id: string) =>
        billsApi.post<GatePass>(`/gatepasses/${id}/reopen`).then((r: any) => r.data),

    reopenLegacyBatch: () =>
        billsApi.post<{ reopened: Array<Record<string, unknown>>; skipped: Array<Record<string, unknown>> }>('/gatepasses/reopen-legacy').then((r: any) => r.data),

    adjust: (id: string, item_name: string, corrected_qty: number, reason: string, specification?: string | null) =>
        billsApi.post<GatePass>(`/gatepasses/${id}/adjust`, { item_name, specification, corrected_qty, reason }).then((r: any) => r.data),

    updateDate: (id: string, receiving_date: string, reason?: string) =>
        billsApi.patch<GatePass>(`/gatepasses/${id}/date`, { receiving_date: toISODatetime(receiving_date), reason }).then((r: any) => r.data),

    update: (
        id: string,
        payload: {
            client_name?: string
            received_by?: string
            notes?: string
            items?: Array<{
                item_name: string
                category?: string | null
                client_qty: number
                received_qty: number
                mismatch_reason?: string | null
                mismatch_notes?: string | null
                rewashed?: boolean
            }>
        },
    ) =>
        billsApi.patch<GatePass>(`/gatepasses/${id}`, payload).then((r: any) => r.data),

    createBillFromGatePass: (
        gate_pass_id: string,
        data: { instant?: boolean; notes?: string; quotation_id?: string; client_name?: string },
    ) =>
        billsApi.post('/bills', {
            gate_pass_id,
            instant: data.instant ?? false,
            notes: data.notes,
            quotation_id: data.quotation_id,
            client_name: data.client_name,
        }).then((r: any) => r.data),

    /**
     * The canonical balance for this gate pass, computed by the server.
     *
     * Every screen showing pending/remaining/delivered for a pass must consume
     * this instead of subtracting quantities locally. Delivered lines are
     * attributed to the pass they actually came from, so a delivery spanning
     * two passes cannot make one of them look short.
     */
    balance: (id: string) =>
        billsApi
            .get<GatePassBalanceResponse>(`/gatepasses/${id}/balance`)
            .then((r: any) => r.data),

    /**
     * Every delivery that drew lines from this pass. Each delivery carries a
     * `lines_from_this_gate_pass` array so the page can show the delivery's
     * contribution to THIS pass without re-deriving attribution.
     */
    deliveries: (id: string) =>
        billsApi
            .get<GatePassDeliveriesResponse>(`/gatepasses/${id}/deliveries`)
            .then((r: any) => r.data),
}

