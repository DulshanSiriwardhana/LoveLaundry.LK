import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dispatch } from '../services/dispatch.service'
import type { DispatchCreate, DispatchUpdate } from '../../../types/operations'

export const dispatchKeys = {
    all: ['dispatch'] as const,
    list: (params?: object) => [...dispatchKeys.all, 'list', params] as const,
    detail: (id: string) => [...dispatchKeys.all, id] as const,
}

export function useDispatchJobs(params?: {
    client_name?: string
    status?: string
    assigned_to?: string
    job_type?: string
}) {
    return useQuery({
        queryKey: dispatchKeys.list(params),
        queryFn: () => dispatch.list(params),
    })
}

export function useCreateDispatch() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: DispatchCreate) => dispatch.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dispatchKeys.all })
            toast.success('Dispatch job created')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to create job'),
    })
}

export function useUpdateDispatch() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: DispatchUpdate }) =>
            dispatch.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dispatchKeys.all })
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to update job'),
    })
}

export function useDeleteDispatch() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => dispatch.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: dispatchKeys.all })
            toast.success('Dispatch job removed')
        },
        onError: () => toast.error('Failed to remove job'),
    })
}

export function useOptimizeRoute() {
    return useMutation({
        mutationFn: ({ assigned_to, date }: { assigned_to: string; date?: string }) =>
            dispatch.optimize(assigned_to, date),
        onError: () => toast.error('Could not plan route'),
    })
}
