import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { stalenessFor } from './cache-config'

export type SyncStatus =
  | 'fresh'
  | 'syncing'
  | 'stale'
  | 'offline'
  | 'error'
  | 'no-data'

export interface ResourceSyncState {
  status: SyncStatus
  online: boolean
  updating: boolean
  hasData: boolean
  lastUpdated: number | null
}

function matchesPrefix(candidate: readonly unknown[], prefix: readonly unknown[]): boolean {
  if (!Array.isArray(candidate)) return false
  return prefix.every((part, i) => candidate[i] === part)
}

/** Re-render tick used to refresh freshness labels over time. */
const FRESHNESS_TICK_MS = 30_000

/**
 * Live sync status for a resource (a query-key prefix) backed by the React
 * Query cache:
 *
 *  - fresh:    cache returned from an API call within its staleness window
 *  - syncing:  cached data is on screen and a background refresh is running
 *  - stale:    showing cached data older than its staleness window
 *  - offline:  showing cached data while the browser is offline
 *  - error:    showing cached data and the last refresh failed
 *  - no-data:  nothing cached yet — initial load in progress
 */
export function useSyncStatus(queryKey: readonly unknown[]): ResourceSyncState {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [tick, setTick] = useState(0)

  // Track connectivity.
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Re-render when any query sharing this prefix changes (refresh finished,
  // mutation invalidated it, new data arrived) and as the freshness window
  // elapses so "Updated just now" decays into the timestamp label.
  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const unsubscribe = cache.subscribe((event) => {
      if (
        event.type === 'updated' ||
        event.type === 'added' ||
        event.type === 'removed'
      ) {
        if (matchesPrefix(event.query.queryKey, queryKey)) setTick((t) => t + 1)
      }
    })
    const interval = window.setInterval(() => setTick((t) => t + 1), FRESHNESS_TICK_MS)
    return () => {
      unsubscribe()
      window.clearInterval(interval)
    }
  }, [queryClient, queryKey])

  // Recompute from the current cache on every render (see tick above).
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => matchesPrefix(q.queryKey, queryKey))

  void tick

  let lastUpdated: number | null = null
  let anyFetching = false
  let anyHardError = false
  for (const q of queries) {
    const ts = q.state.dataUpdatedAt
    if (ts != null && ts > 0 && (lastUpdated === null || ts > lastUpdated)) {
      lastUpdated = ts
    }
    if (q.state.fetchStatus === 'fetching') anyFetching = true
    if (q.state.status === 'error' && q.state.data === undefined) anyHardError = true
  }

  const hasData = lastUpdated !== null

  let status: SyncStatus
  if (!online && hasData) status = 'offline'
  else if (anyFetching && hasData) status = 'syncing'
  else if (anyFetching && !hasData) status = 'no-data'
  else if (anyHardError && hasData) status = 'error'
  else if (anyHardError && !hasData) status = 'no-data'
  else if (hasData && lastUpdated !== null && Date.now() - lastUpdated <= stalenessFor(queryKey)) status = 'fresh'
  else if (hasData) status = 'stale'
  else status = 'no-data'

  return {
    status,
    online,
    updating: anyFetching && hasData,
    hasData,
    lastUpdated,
  }
}