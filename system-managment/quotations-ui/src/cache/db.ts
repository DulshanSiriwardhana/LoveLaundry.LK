import Dexie, { type Table } from 'dexie'
import type { OutboxRow } from './outbox'

/**
 * local_cache_db — a per-user IndexedDB database (Dexie schema v2).
 *
 * Tables:
 *  - kv:         one row storing the dehydrated React Query cache snapshot
 *                (the persister's underlying store).
 *  - resources:  per-resource metadata used for freshness/status decisions
 *                (resource, created_at, last_updated_at, last_api_sync_at,
 *                cache_version, sync_status).
 *  - outbox:     writes made while offline (or that failed on a flaky
 *                network) that must be replayed to the backends once the
 *                connection returns. FIFO by created_at.
 *  - sync_meta:  small key/value rows for sync bookkeeping (last sync time…).
 */
export interface KvRow {
  key: string
  value: unknown
  updated_at: number
}

export type SyncStatusValue =
  | 'fresh'
  | 'syncing'
  | 'stale'
  | 'offline'
  | 'synced-failed'

export interface ResourceMetaRow {
  resource: string
  created_at: number
  last_updated_at: number
  last_api_sync_at: number
  cache_version: string
  sync_status: SyncStatusValue
  online: boolean
}

export interface SyncMetaRow {
  key: string
  value: unknown
  updated_at: number
}

export interface LocalCacheDb extends Dexie {
  kv: Table<KvRow, string>
  resources: Table<ResourceMetaRow, string>
  outbox: Table<OutboxRow, number>
  sync_meta: Table<SyncMetaRow, string>
}

/** Keep IndexedDB names filesystem-safe regardless of user id contents. */
export function sanitizeScope(scope: string): string {
  const cleaned = String(scope ?? '')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .slice(0, 48)
  return cleaned || 'anon'
}

export function cacheDbName(scope: string): string {
  return `local_cache_db_${sanitizeScope(scope)}`
}

/** Opens (creating on first use) the per-user local cache database. */
export function openCacheDb(scope: string): LocalCacheDb {
  const db = new Dexie(cacheDbName(scope)) as LocalCacheDb
  db.version(1).stores({
    kv: 'key',
    resources: 'resource',
  })
  db.version(2).stores({
    outbox: '++id, service, status, created_at',
    sync_meta: 'key',
  })
  return db
}

/** Permanently drops a user's local cache (e.g. on logout). */
export async function deleteCacheDb(scope: string): Promise<void> {
  try {
    await Dexie.delete(cacheDbName(scope))
  } catch {
    // Missing/already-deleted database is a no-op.
  }
}