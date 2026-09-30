import { useQuery } from '@tanstack/react-query'
import { reports } from '../services/reports.service'
import type { LinenFlowResponse } from '../../../types/operations'

/**
 * Per-hotel linen flow, with the quantities computed server-side.
 *
 * The screen previously loaded every gate pass and every delivery and rebuilt
 * the balance in the browser, which both mis-attributed multi-pass deliveries
 * and re-implemented the `marked_delivered` rule. Period filtering also lived
 * here, so selecting a quarter still transferred the whole collection.
 */
export function useLinenFlow(period: 'all' | 'month' | 'quarter' | 'year' = 'all') {
    return useQuery<LinenFlowResponse>({
        queryKey: ['reports', 'linen-flow', period],
        queryFn: () => reports.linenFlow(period),
        staleTime: 60_000,
    })
}
