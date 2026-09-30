import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '../services/notifications.service'
import { useQuotations } from './useQuotations'
import type { NotificationItem, GatePassPendingEntry } from '../../../types/notification'
import type { Quotation } from '../../../types/quotation'

export function useNotifications() {
  /**
   * Pending quantities now come straight from the server's canonical balances.
   *
   * This hook used to fetch every gate pass, every delivery and every return and
   * recompute `received - delivered + returned` itself. That copy disagreed
   * with the delivery form for multi-pass deliveries (it credited every line to
   * one pass) and could not see spec-level corrections at all. One number, one
   * source.
   */
  const { data: gatePassPending = [], isLoading: gpLoading } = useQuery<GatePassPendingEntry[]>({
    queryKey: ['notifications', 'gatepass-pending'],
    queryFn: () => notificationsApi.gatepassPending(),
    staleTime: 60_000,
  })

  const { data: quotations = [], isLoading: qLoading } = useQuotations()

  const pendingCount = useMemo(
    () => gatePassPending.reduce((sum, e) => sum + (e.pending || 0), 0),
    [gatePassPending],
  )

  const deliveredQuotations: Quotation[] = useMemo(
    () => quotations.filter((q) => q.status === 'delivered'),
    [quotations],
  )

  const acceptedCount = deliveredQuotations.length
  const totalCount = pendingCount + acceptedCount

  const notificationItems: NotificationItem[] = useMemo(() => {
    const items: NotificationItem[] = []

    if (gatePassPending.length > 0) {
      const gpCount = new Set(gatePassPending.map((e) => e.gate_pass_number)).size
      items.push({
        id: 'gatepass_pending',
        type: 'gatepass_pending',
        title: 'Pending to Send',
        message: `${pendingCount} item${pendingCount !== 1 ? 's' : ''} pending to be sent across ${gpCount} gate pass${gpCount !== 1 ? 'es' : ''}`,
        count: pendingCount,
        route: '/gate-passes',
        gatePassItems: gatePassPending,
      })
    }

    if (deliveredQuotations.length > 0) {
      items.push({
        id: 'quotation_delivered',
        type: 'quotation_delivered',
        title: 'Ready for Billing',
        message: `${deliveredQuotations.length} delivered order${deliveredQuotations.length !== 1 ? 's' : ''} awaiting billing`,
        count: deliveredQuotations.length,
        route: '/quotations',
        quotations: deliveredQuotations,
      })
    }

    return items
  }, [gatePassPending, pendingCount, deliveredQuotations])

  return {
    notificationItems,
    totalCount,
    pendingCount,
    acceptedCount,
    gatePassPending,
    deliveredQuotations,
    isLoading: gpLoading || qLoading,
  }
}

/**
 * The same server-computed pending feed the bell uses, for screens that need to
 * sum outstanding quantity themselves (e.g. the close-day summary, which scopes
 * it to the passes received on a given date).
 *
 * Reuses the `notifications` query key, so anything that moves a quantity
 * invalidates this too.
 */
export function usePendingGatePassItems() {
    return useQuery<GatePassPendingEntry[]>({
        queryKey: ['notifications', 'gatepass-pending'],
        queryFn: () => notificationsApi.gatepassPending(),
        staleTime: 60_000,
    })
}
