import workersApi from '../../../api/workers-api'
import billsApi from '../../../api/bills-api'
import type { DailyLog, DailyLogCreate, DailySummary, Worker, WorkerCreate } from '../types'
import type { GatePass } from '../../../types/operations'

export const workersService = {
    list: (activeOnly = false) =>
        workersApi.get<Worker[]>('/workers', { params: activeOnly ? { active_only: true } : {} }).then(r => r.data),

    create: (data: WorkerCreate) =>
        workersApi.post<Worker>('/workers', data).then(r => r.data),

    update: (id: string | number, data: Partial<WorkerCreate>) =>
        workersApi.put<Worker>(`/workers/${id}`, data).then(r => r.data),

    remove: (id: string | number) =>
        workersApi.delete(`/workers/${id}`).then(r => r.data),
}

export const dailyLogs = {
    list: (params?: { work_date?: string; worker_name?: string; date_from?: string; date_to?: string }) =>
        workersApi.get<DailyLog[]>('/daily-logs', { params }).then(r => r.data),

    get: (id: string | number) =>
        workersApi.get<DailyLog>(`/daily-logs/${id}`).then(r => r.data),

    create: (data: DailyLogCreate) =>
        workersApi.post<DailyLog>('/daily-logs', data).then(r => r.data),

    update: (id: string | number, data: Partial<DailyLogCreate>) =>
        workersApi.put<DailyLog>(`/daily-logs/${id}`, data).then(r => r.data),

    remove: (id: string | number) =>
        workersApi.delete<{ message: string }>(`/daily-logs/${id}`).then(r => r.data),

    dailySummary: (date: string) =>
        workersApi.get<DailySummary>('/summary/daily', { params: { date } }).then(r => r.data),
}

export const gatePassesService = {
    list: () =>
        billsApi.get<GatePass[]>('/gatepasses', { params: { status: 'RECEIVED' } }).then(r => r.data),

    listAll: () =>
        billsApi.get<GatePass[]>('/gatepasses').then(r => r.data),
}
