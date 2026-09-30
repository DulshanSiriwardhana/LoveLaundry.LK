import billsApi from '../../../api/bills-api'
import type { DispatchJob, DispatchCreate, DispatchUpdate, RoutePlan } from '../../../types/operations'

export const dispatch = {
    list: (params?: {
        client_name?: string
        status?: string
        assigned_to?: string
        job_type?: string
    }) =>
        billsApi
            .get<DispatchJob[]>('/dispatch', { params })
            .then((r: any) => r.data),

    get: (id: string) =>
        billsApi.get<DispatchJob>(`/dispatch/${id}`).then((r: any) => r.data),

    create: (data: DispatchCreate) =>
        billsApi.post<DispatchJob>('/dispatch', data).then((r: any) => r.data),

    update: (id: string, data: DispatchUpdate) =>
        billsApi.patch<DispatchJob>(`/dispatch/${id}`, data).then((r: any) => r.data),

    remove: (id: string) =>
        billsApi.delete(`/dispatch/${id}`).then((r: any) => r.data),

    optimize: (assigned_to: string, date?: string) =>
        billsApi
            .post<RoutePlan>('/dispatch/optimize', { assigned_to, date })
            .then((r: any) => r.data),
}
