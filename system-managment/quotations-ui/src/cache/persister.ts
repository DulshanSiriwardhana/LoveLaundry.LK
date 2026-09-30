import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { CACHE_RESOURCES, CACHE_VERSION } from './cache-config'
import type { LocalCacheDb, ResourceMetaRow } from './db'
import { openCacheDb } from './db'

const KV_KEY = 'react-query:cache'

/** Debounce window for persisting a dehydrated snapshot. */
const WRITE_DEBOUNCE_MS = 400

async function upsertResourceMetadata(
  db: LocalCacheDb,
  client: PersistedClient,
): Promise<void> {
  const now = Date.now()
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  const rows: ResourceMetaRow[] = []

  for (const query of client.clientState.queries) {
    const key = query?.queryKey
    if (!Array.isArray(key) || key.length === 0) continue
    const resource = String(key[0] ?? '')
    if (!CACHE_RESOURCES.has(resource)) continue

    const dataUpdatedAt = query.state.dataUpdatedAt
    const timestamp = typeof dataUpdatedAt === 'number' && dataUpdatedAt > 0 ? dataUpdatedAt : now

    rows.push({
      resource,
      created_at: now,
      last_updated_at: timestamp,
      last_api_sync_at: now,
      cache_version: client.buster || CACHE_VERSION,
      sync_status: online ? 'fresh' : 'offline',
      online,
    })
  }

  if (rows.length > 0) await db.resources.bulkPut(rows)
}

/**
 * A Persister backed by the per-user local_cache_db (IndexedDB via Dexie).
 * The cache is best-effort: any IndexedDB failure is swallowed so the app
 * keeps working with the remote APIs as its source of truth.
 */
export function createIndexedDbPersister(scope: string): Persister {
  const db = openCacheDb(scope)
  let writeTimer: ReturnType<typeof setTimeout> | null = null
  let pending: PersistedClient | null = null

  const doWrite = async (client: PersistedClient): Promise<void> => {
    try {
      await db.transaction('rw', db.kv, db.resources, async () => {
        await db.kv.put({ key: KV_KEY, value: client, updated_at: Date.now() })
        await upsertResourceMetadata(db, client)
      })
    } catch {
      // Cache unavailable — never block the app on persistence.
    }
  }

  const scheduleWrite = (client: PersistedClient): void => {
    pending = client
    if (writeTimer) clearTimeout(writeTimer)
    writeTimer = setTimeout(() => {
      const snapshot = pending
      pending = null
      if (snapshot) void doWrite(snapshot)
    }, WRITE_DEBOUNCE_MS)
  }

  return {
    persistClient: scheduleWrite,
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const row = await db.kv.get(KV_KEY)
        const value = row?.value as PersistedClient | undefined
        if (
          value &&
          typeof value === 'object' &&
          typeof (value as PersistedClient).clientState === 'object' &&
          typeof (value as PersistedClient).timestamp === 'number'
        ) {
          return value
        }
        return undefined
      } catch {
        return undefined
      }
    },
    removeClient: async (): Promise<void> => {
      if (writeTimer) {
        clearTimeout(writeTimer)
        writeTimer = null
        pending = null
      }
      try {
        await db.transaction('rw', db.kv, db.resources, async () => {
          await db.kv.clear()
          await db.resources.clear()
        })
      } catch {
        // Ignore — nothing to clean.
      }
    },
  }
}