import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { sanitizeScope } from './db'
import { listAll, subscribeOutbox, type OutboxKind, type OutboxRow, type OutboxStatus } from './outbox'
import { subscribeConnectivity } from './offline'

/**
 * Live view of what the logged-in user has saved locally that hasn't reached
 * the server yet. Feeds two kinds of UI:
 *
 *  - per-record:  `useIsEntityPending` → "Pending sync" badge on a row/card
 *                 for any update/delete queued against that entity's id;
 *  - per-screen:  `usePendingChanges` → "N offline changes" chip counting
 *                 queued writes whose resource matches the current view.
 *
 * State is recomputed whenever the outbox changes (write queued, synced,
 * failed) or connectivity changes.
 */

export interface PendingBrief {
  outbox_id: number
  service: string
  method: string
  url: string
  kind?: OutboxKind
  entity_id?: string
  resource?: string
  status: OutboxStatus
  queued_at: number
}

export interface ResourceCounts {
  pending: number
  failed: number
}

interface PendingSyncCtxValue {
  byEntity: ReadonlyMap<string, PendingBrief>
  byResource: ReadonlyMap<string, ResourceCounts>
}

const PendingSyncCtx = createContext<PendingSyncCtxValue>({
  byEntity: new Map(),
  byResource: new Map(),
})

export function PendingSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const scope = sanitizeScope(user?.id ?? '')
  const [value, setValue] = useState<PendingSyncCtxValue>({ byEntity: new Map(), byResource: new Map() })

  useEffect(() => {
    let alive = true
    const refresh = async (): Promise<void> => {
      const rows = await listAll(scope).catch(() => [] as OutboxRow[])
      if (!alive) return
      const byEntity = new Map<string, PendingBrief>()
      const byResource = new Map<string, ResourceCounts>()
      for (const r of rows) {
        if (r.entity_id) {
          const entityKey = `${r.service}:${r.entity_id}`
          byEntity.set(entityKey, {
            outbox_id: r.id ?? 0,
            service: r.service,
            method: r.method,
            url: r.url,
            kind: r.kind,
            entity_id: r.entity_id,
            resource: r.resource,
            status: r.status,
            queued_at: r.created_at,
          })
        }
        if (r.resource) {
          const resourceKey = `${r.service}:${r.resource}`
          const cur = byResource.get(resourceKey) ?? { pending: 0, failed: 0 }
          if (r.status === 'failed') cur.failed += 1
          else cur.pending += 1
          byResource.set(resourceKey, cur)
        }
      }
      setValue({ byEntity, byResource })
    }
    void refresh()
    const unsubscribeOutbox = subscribeOutbox(() => void refresh())
    const unsubscribeConn = subscribeConnectivity(() => void refresh())
    return () => {
      alive = false
      unsubscribeOutbox()
      unsubscribeConn()
    }
  }, [scope])

  return <PendingSyncCtx.Provider value={value}>{children}</PendingSyncCtx.Provider>
}

export function usePendingSync(): PendingSyncCtxValue {
  return useContext(PendingSyncCtx)
}

export function useIsEntityPending(service: string, entityId?: string): PendingBrief | undefined {
  const { byEntity } = usePendingSync()
  if (!entityId) return undefined
  return byEntity.get(`${service}:${entityId}`)
}

export function usePendingChanges(service: string, resource?: string): ResourceCounts {
  const { byResource } = usePendingSync()
  if (!resource) return { pending: 0, failed: 0 }
  return byResource.get(`${service}:${resource}`) ?? { pending: 0, failed: 0 }
}