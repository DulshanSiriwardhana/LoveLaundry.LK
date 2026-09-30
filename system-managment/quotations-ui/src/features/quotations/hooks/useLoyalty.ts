import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { loyalty } from '../services/loyalty.service'
import type { LoyaltyAccount, LoyaltyAdjust } from '../../../types/operations'

export function useLoyaltyAccount(client?: string) {
    return useQuery({
        queryKey: ['loyalty', client],
        queryFn: () => loyalty.get(client as string),
        enabled: Boolean(client),
    })
}

export function useAdjustLoyalty() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: LoyaltyAdjust) => loyalty.adjust(data),
        onSuccess: (acct) => {
            qc.invalidateQueries({ queryKey: ['loyalty', acct.client_name] })
            toast.success('Loyalty updated')
        },
        onError: () => toast.error('Failed to update loyalty'),
    })
}

export function useLoyaltyList(client_name?: string) {
    return useQuery({
        queryKey: ['loyalty-list', client_name],
        queryFn: () => loyalty.list(client_name),
        enabled: Boolean(client_name),
    })
}

export type { LoyaltyAccount }
