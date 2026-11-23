import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { Badge, type BadgeTone } from '../../../components/ui/badge'
import { linenKeys } from '../hooks/useLinen'
import { useLinenLiveFeed, type LinenFeedStatus } from '../hooks/useLinenLiveFeed'

const LABEL: Record<LinenFeedStatus, string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

const TONE: Record<LinenFeedStatus, BadgeTone> = {
  live: 'success',
  connecting: 'warning',
  reconnecting: 'warning',
  offline: 'neutral',
}

/** Compact connection state for a linen screen. Every realtime frame also
 * refreshes the shared linen queries, so another device's scan updates the
 * visible lists, stats and profiles without a manual reload. */
export function LinenLiveBadge() {
  const queryClient = useQueryClient()
  const onEvent = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: linenKeys.all })
  }, [queryClient])

  const { status } = useLinenLiveFeed(onEvent)
  const label = LABEL[status]

  return (
    <Badge tone={TONE[status]} size="xs" dot title={`Linen live feed: ${label}`} aria-label={`Linen live feed: ${label}`}>
      <Radio size={11} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export default LinenLiveBadge
