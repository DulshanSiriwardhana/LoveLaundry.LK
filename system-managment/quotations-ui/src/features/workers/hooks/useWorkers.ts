import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dailyLogs, gatePassesService, workersService } from '../services/worker.service'
import type { DailyLogCreate, WorkerCreate } from '../types'

export const workerKeys = {
    all: ['workers'] as const,
    list: (activeOnly?: boolean) => [...workerKeys.all, 'list', activeOnly] as const,
}

export const dailyLogKeys = {
    all: ['daily-logs'] as const,
    list: (params?: object) => [...dailyLogKeys.all, 'list', params] as const,
    summary: (date: string) => [...dailyLogKeys.all, 'summary', date] as const,
}

export const gatePassKeys = {
    all: ['gatepasses'] as const,
}

export function useWorkers(activeOnly = false) {
    return useQuery({
        queryKey: workerKeys.list(activeOnly),
        queryFn: () => workersService.list(activeOnly),
    })
}

export function useCreateWorker() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: WorkerCreate) => workersService.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: workerKeys.all })
            toast.success('Staff added successfully')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to add staff'),
    })
}

export function useUpdateWorker() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string | number; data: Partial<WorkerCreate> }) =>
            workersService.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: workerKeys.all })
            toast.success('Staff updated')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to update staff'),
    })
}

export function useDeleteWorker() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string | number) => workersService.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: workerKeys.all })
            toast.success('Staff removed')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to remove staff'),
    })
}

export function useDailyTasks(params?: { work_date?: string; worker_name?: string; date_from?: string; date_to?: string }) {
    return useQuery({
        queryKey: dailyLogKeys.list(params),
        queryFn: () => dailyLogs.list(params),
    })
}

export function useDailySummary(date: string) {
    return useQuery({
        queryKey: dailyLogKeys.summary(date),
        queryFn: () => dailyLogs.dailySummary(date),
    })
}

export function useCreateDailyTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: DailyLogCreate) => dailyLogs.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dailyLogKeys.all })
            toast.success('Task logged')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to log task'),
    })
}

export function useUpdateDailyTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ logId, data }: { logId: string | number; data: Partial<DailyLogCreate> }) =>
            dailyLogs.update(logId, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dailyLogKeys.all })
            toast.success('Task updated')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to update task'),
    })
}

export function useDeleteDailyTask() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ logId }: { logId: string | number; entryId?: string }) =>
            dailyLogs.remove(logId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dailyLogKeys.all })
            toast.success('Task deleted')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to delete task'),
    })
}

export function useGatePassesForWorker() {
    return useQuery({
        queryKey: gatePassKeys.all,
        queryFn: () => gatePassesService.listAll(),
    })
}
