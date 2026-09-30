import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { loyalty } from '../services/loyalty.service'
import type { LoyaltyAccount, LoyaltyAdjust } from '../../../types/operations'
import { invalidateResource } from '../../../cache/invalidation'

// `useAdjustLoyalty` invalidates ['loyalty', client]. The list has to live
// under the same namespace or an adjustment would never refresh it.
export const loyaltyKeys = {
    all: ['loyalty'] as const,
    detail: (client?: string) => [...loyaltyKeys.all, client] as const,
}

export function useLoyaltyAccount(client?: string) {
    return useQuery({
        queryKey: loyaltyKeys.detail(client),
        queryFn: () => loyalty.get(client as string),
        enabled: Boolean(client),
    })
}

export function useAdjustLoyalty() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: LoyaltyAdjust) => loyalty.adjust(data),
        onSuccess: (acct) => {
            qc.setQueryData(loyaltyKeys.detail(acct.client_name), acct)
            invalidateResource(qc, 'loyalty')
            toast.success('Loyalty updated')
        },
        onError: () => toast.error('Failed to update loyalty'),
    })
}

export function useLoyaltyList(client_name?: string) {
    return useQuery({
        queryKey: [...loyaltyKeys.all, 'list', client_name],
        queryFn: () => loyalty.list(client_name),
        enabled: Boolean(client_name),
    })
}

export type { LoyaltyAccount }
