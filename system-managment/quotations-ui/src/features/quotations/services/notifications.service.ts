import billsApi from '../../../api/bills-api'
import type { GatePassPendingEntry, NotificationSummary } from '../../../types/notification'

/**
 * The bell icon used to rebuild "pending" in the browser from gate passes,
 * deliveries and returns. This is the server's copy of the same numbers, so the
 * badge, the notification page and the delivery form can never disagree.
 */
export const notificationsApi = {
    gatepassPending: (params?: { client_name?: string }): Promise<GatePassPendingEntry[]> =>
        billsApi
            .get<GatePassPendingEntry[]>('/notifications/gatepass-pending', { params })
            .then(r => r.data),

    summary: (params?: { client_name?: string }): Promise<NotificationSummary> =>
        billsApi
            .get<NotificationSummary>('/notifications/summary', { params })
            .then(r => r.data),
}
