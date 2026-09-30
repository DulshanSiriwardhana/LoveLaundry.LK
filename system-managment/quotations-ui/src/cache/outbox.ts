/**
 * Outbox — writes queued locally while offline (or after a flaky-network
 * failure) that must be replayed to the backends once the connection returns.
 *
 * Stored in the per-user local_cache_db (IndexedDB via Dexie), so it survives
 * page reloads, app restarts and is cleaned up automatically on logout (the
 * whole database is dropped).
 */
import { openCacheDb, type LocalCacheDb } from './db'
import { getCacheScope } from './scope'

export type OutboxStatus = 'pending' | 'syncing' | 'failed'

export type OutboxKind = 'create' | 'update' | 'delete'

export interface OutboxRow {
  id?: number
  /** Logical backend, e.g. 'bills' | 'quotation' | 'workers' | 'management'. */
  service: string
  /** Uppercase HTTP method: POST/PUT/PATCH/DELETE. */
  method: string
  /** Relative URL (baseURL is stored separately). */
  url: string
  baseURL: string
  data?: unknown
  /** Deterministic idempotency key so replays never double-create. */
  idempotency_key?: string
  /** Query-key first segment to invalidate after this change syncs. */
  resource?: string
  /** Operation class — drives the per-record "pending sync" badge. */
  kind?: OutboxKind
  /** Server-side entity id this change targets (updates/deletes). */
  entity_id?: string
  status: OutboxStatus
  attempts: number
  last_error?: string
  created_at: number
}

const listeners = new Set<() => void>()
const CHANGE_EVENT = 'll-outbox-changed'

function emit(): void {
  for (const l of listeners) l()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
}

export function subscribeOutbox(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

let db: LocalCacheDb | null = null
let dbScope = ''

function cache(scope?: string): LocalCacheDb {
  const target = scope ?? getCacheScope()
  if (!db || dbScope !== target) {
    db = openCacheDb(target)
    dbScope = target
  }
  return db
}

export interface EnqueueMutationInput {
  service: string
  method: string
  url: string
  baseURL: string
  data?: unknown
  idempotency_key?: string
  resource?: string
  kind?: OutboxKind
  entity_id?: string
}

/** Adds a write to the outbox and notifies the sync engine / UI. */
export async function enqueueMutation(input: EnqueueMutationInput): Promise<number> {
  const row: OutboxRow = {
    service: input.service,
    method: input.method,
    url: input.url,
    baseURL: input.baseURL,
    data: input.data,
    idempotency_key: input.idempotency_key,
    resource: input.resource,
    kind: input.kind,
    entity_id: input.entity_id,
    status: 'pending',
    attempts: 0,
    created_at: Date.now(),
  }
  const id = await cache().outbox.add(row)
  emit()
  return id
}

export async function listAll(scope?: string): Promise<OutboxRow[]> {
  return cache(scope).outbox.orderBy('created_at').toArray()
}

export async function listPending(): Promise<OutboxRow[]> {
  return cache().outbox.where('status').anyOf('pending', 'syncing').sortBy('created_at')
}

export async function countPending(): Promise<number> {
  return cache().outbox.where('status').anyOf('pending', 'syncing').count()
}

export async function countSyncing(): Promise<number> {
  return cache().outbox.where('status').equals('syncing').count()
}

export async function countFailed(): Promise<number> {
  return cache().outbox.where('status').equals('failed').count()
}

export async function setSyncing(id: number): Promise<void> {
  await cache().outbox.update(id, { status: 'syncing' })
  emit()
}

/** Network hiccup: back to pending (attempts bumped) so a later drain retries. */
export async function resetPending(id: number, lastError: string): Promise<void> {
  const row = await cache().outbox.get(id)
  if (!row) return
  await cache().outbox.update(id, {
    status: 'pending',
    attempts: (row.attempts ?? 0) + 1,
    last_error: lastError,
  })
  emit()
}

/** Permanent rejection (HTTP 4xx): keep for manual review, stop auto-retry. */
export async function markFailed(id: number, lastError: string): Promise<void> {
  const row = await cache().outbox.get(id)
  if (!row) return
  await cache().outbox.update(id, {
    status: 'failed',
    attempts: (row.attempts ?? 0) + 1,
    last_error: lastError,
  })
  emit()
}

export async function removeOutbox(id: number): Promise<void> {
  await cache().outbox.delete(id)
  emit()
}

/** Sends failed rows back to pending so a drain can retry them manually. */
export async function requeueFailed(): Promise<number> {
  const count = await cache().outbox.where('status').equals('failed').modify({ status: 'pending' })
  if (count > 0) emit()
  return count
}