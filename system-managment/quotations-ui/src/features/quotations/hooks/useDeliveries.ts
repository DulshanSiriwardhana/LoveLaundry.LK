import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deliveries } from '../services/delivery.service'
import { invalidateDeliveryData } from './useGatePasses'
import type {
    DeliveryCancel,
    DeliveryCorrection,
    DeliveryCreate,
} from '../../../types/operations'

export const deliveryKeys = {
    all: ['deliveries'] as const,
    list: (params?: object) => [...deliveryKeys.all, 'list', params] as const,
    detail: (id: string) => [...deliveryKeys.all, id] as const,
    balance: (id: string) => [...deliveryKeys.all, id, 'balance'] as const,
    available: (clientName?: string) => [...deliveryKeys.all, 'available', clientName] as const,
}

export function useDeliveries(params?: { client_name?: string; gate_pass_id?: string }) {
    return useQuery({
        queryKey: deliveryKeys.list(params),
        queryFn: () => deliveries.list(params),
    })
}

export function useDelivery(id?: string) {
    return useQuery({
        queryKey: deliveryKeys.detail(id ?? ''),
        queryFn: () => deliveries.get(id ?? ''),
        enabled: Boolean(id),
    })
}

/**
 * Server-computed delivery balance: the delivery, its correction history, and
 * the resulting balance of every gate pass it touched.
 */
export function useDeliveryBalance(id?: string) {
    return useQuery({
        queryKey: deliveryKeys.balance(id ?? ''),
        queryFn: () => deliveries.balance(id ?? ''),
        enabled: Boolean(id),
    })
}

/**
 * What is deliverable right now, per hotel and per source gate pass.
 *
 * `staleTime` is deliberately short: this drives the quantity an operator is
 * allowed to type, and it must not disagree with what the server will accept.
 */
export function useAvailableDeliveries(clientName?: string) {
    return useQuery({
        queryKey: deliveryKeys.available(clientName),
        queryFn: () => deliveries.available(clientName),
        staleTime: 30_000,
    })
}

export function useCreateDelivery() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: DeliveryCreate) => deliveries.create(data),
        onSuccess: () => {
            invalidateDeliveryData(qc)
            toast.success('Delivery recorded successfully')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to record delivery'),
    })
}

export function useUpdateDeliveryDate() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, delivery_date, reason }: { id: string; delivery_date: string; reason?: string }) =>
            deliveries.updateDate(id, delivery_date, reason),
        onSuccess: () => {
            invalidateDeliveryData(qc)
            toast.success('Delivery date updated')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to update delivery date'),
    })
}

/** Correct recorded quantities. A reason is mandatory; originals are kept. */
export function useCorrectDeliveryItems() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: DeliveryCorrection }) =>
            deliveries.correctItems(id, data),
        onSuccess: () => {
            invalidateDeliveryData(qc)
            toast.success('Delivery corrected')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to correct delivery'),
    })
}

/** Void a mis-recorded delivery, releasing its quantities to the balances. */
export function useCancelDelivery() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: DeliveryCancel }) =>
            deliveries.cancel(id, data),
        onSuccess: () => {
            invalidateDeliveryData(qc)
            toast.success('Delivery cancelled')
        },
        onError: (e: Error) => toast.error(e.message || 'Failed to cancel delivery'),
    })
}
