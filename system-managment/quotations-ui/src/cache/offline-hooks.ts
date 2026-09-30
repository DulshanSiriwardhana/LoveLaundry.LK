import { useEffect, useState } from 'react'
import { isGlobalOnline, subscribeConnectivity } from './offline'
import { countFailed, countPending, countSyncing, subscribeOutbox } from './outbox'

export interface OfflineSyncState {
  online: boolean
  pending: number
  syncing: number
  failed: number
}

const initialState: OfflineSyncState = { online: true, pending: 0, syncing: 0, failed: 0 }

/** Live snapshot of the offline write queue + connectivity for UI badges. */
export function useOfflineSync(): OfflineSyncState {
  const [state, setState] = useState<OfflineSyncState>(initialState)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const [pending, syncing, failed] = await Promise.all([
        countPending().catch(() => 0),
        countSyncing().catch(() => 0),
        countFailed().catch(() => 0),
      ])
      if (!alive) return
      setState({ online: isGlobalOnline(), pending, syncing, failed })
    }
    const unsubscribeOutbox = subscribeOutbox(() => void refresh())
    const unsubscribeConn = subscribeConnectivity(() => {
      setState((s) => ({ ...s, online: isGlobalOnline() }))
      void refresh()
    })
    void refresh()
    return () => {
      alive = false
      unsubscribeOutbox()
      unsubscribeConn()
    }
  }, [])

  return state
}