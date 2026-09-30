import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { payments } from '../services/reports.service'
import type { PaymentCreate } from '../../../types/operations'

export const paymentKeys = {
    all: ['payments'] as const,
    list: (billId: string) => [...paymentKeys.all, billId] as const,
}

export function usePayments(billId?: string) {
    return useQuery({
        queryKey: paymentKeys.list(billId ?? ''),
        queryFn: () => payments.listForBill(billId ?? ''),
        enabled: Boolean(billId),
    })
}

export function useCreatePayment() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ billId, data }: { billId: string; data: PaymentCreate }) =>
            payments.create(billId, data),
        onSuccess: (_, { billId }) => {
            qc.invalidateQueries({ queryKey: paymentKeys.list(billId) })
            qc.invalidateQueries({ queryKey: ['bills', billId] })
            qc.invalidateQueries({ queryKey: ['bills', 'list'] })
            toast.success('Payment recorded successfully')
        },
        onError: () => toast.error('Failed to record payment'),
    })
}
