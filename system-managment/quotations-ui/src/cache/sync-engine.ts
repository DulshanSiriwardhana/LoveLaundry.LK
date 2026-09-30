/**
 * Sync engine — drains the offline outbox back to the backends.
 *
 * Writes are replayed strictly in the order they were queued (FIFO), one at a
 * time, so dependent operations (e.g. a bill then a payment on it) land in the
 * intended sequence. Every replayed create carries its deterministic
 * `X-Idempotency-Key`, so the backend returns the already-created entity if a
 * retry happens to arrive twice.
 *
 * Outcomes:
 *  - 2xx            → success, row removed, affected queries invalidated.
 *  - DELETE 404     → already gone server-side, treated as success.
 *  - HTTP 4xx       → permanent rejection, kept as `failed` for manual review
 *                     (drain pauses to avoid skipping dependent operations).
 *  - network error  → row returns to `pending`, retried on the next drain.
 */
import axios from 'axios'
import {
  countPending,
  listPending,
  markFailed,
  removeOutbox,
  requeueFailed,
  resetPending,
  setSyncing,
  subscribeOutbox,
} from './outbox'
import { isGlobalOnline, markServiceUp, subscribeConnectivity } from './offline'
import { setReplaying } from './offline-adapter'

export interface SyncNotifiers {
  /** Refreshes affected queries after a write lands. */
  invalidate: (resource?: string) => void
  /** Surface sync outcomes (toasts). */
  notify: (message: string, type?: 'success' | 'error' | 'info') => void
}

let notifiers: SyncNotifiers | null = null
export function registerSyncNotifiers(n: SyncNotifiers): void {
  notifiers = n
}

let engineStarted = false
export function isSyncEngineStarted(): boolean {
  return engineStarted
}

let running = false
let timer: ReturnType<typeof setTimeout> | null = null

function schedule(ms: number): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void drain()
  }, ms)
}

/** Starts the engine. Idempotent — safe under React StrictMode double-effects. */
export function startSyncEngine(): void {
  if (engineStarted) return
  engineStarted = true
  subscribeConnectivity(() => {
    if (isGlobalOnline()) schedule(500)
  })
  subscribeOutbox(() => {
    if (isGlobalOnline()) schedule(900)
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => schedule(400))
    window.addEventListener('focus', () => {
      if (isGlobalOnline()) schedule(500)
    })
  }
  void drain()
}

/** Manually triggers a drain (used by the UI "Sync now / Retry" buttons). */
export function drain(): Promise<void> {
  return runDrain()
}

async function runDrain(): Promise<void> {
  if (running || !isGlobalOnline()) return
  running = true
  let processed = 0
  try {
    const pending = await listPending()
    for (const item of pending) {
      if (!isGlobalOnline()) break
      const outcome = await replayOne(item)
      if (outcome === 'ok') processed += 1
      if (outcome === 'hard') break
    }
  } finally {
    running = false
    const remaining = await countPending().catch(() => 0)
    if (remaining > 0) {
      if (isGlobalOnline()) schedule(4000)
    } else if (processed > 0 && notifiers) {
      notifiers.notify('All offline changes synced.', 'success')
    }
  }
}

type ReplayOutcome = 'ok' | 'retry' | 'hard'

async function replayOne(item: {
  id?: number
  service: string
  method: string
  url: string
  baseURL: string
  data?: unknown
  idempotency_key?: string
  resource?: string
}): Promise<ReplayOutcome> {
  if (item.id === undefined) return 'ok'
  await setSyncing(item.id)
  setReplaying(item.service, true)
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ll_token') : null
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (item.idempotency_key) headers['X-Idempotency-Key'] = item.idempotency_key

    await axios.request({
      method: item.method,
      url: item.url,
      baseURL: item.baseURL,
      data: item.data,
      headers,
      timeout: 15000,
    })

    markServiceUp(item.service)
    await removeOutbox(item.id)
    if (notifiers) notifiers.invalidate(item.resource)
    return 'ok'
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status != null) {
      if (status === 404 && item.method === 'DELETE') {
        await removeOutbox(item.id)
        if (notifiers) notifiers.invalidate(item.resource)
        return 'ok'
      }
      if (status === 401) {
        await markFailed(item.id, 'Session expired — sign in again to sync.')
        if (notifiers) notifiers.notify('Session expired — some saved changes could not sync.', 'error')
        return 'hard'
      }
      await markFailed(item.id, `Server rejected the change (HTTP ${status}).`)
      if (notifiers) {
        notifiers.notify(`A saved offline change was rejected (HTTP ${status}). Retry once signed in.`, 'error')
      }
      return 'hard'
    }
    await resetPending(item.id, 'Network unavailable during sync.')
    return 'retry'
  } finally {
    setReplaying(item.service, false)
  }
}

/** Requeues manually-failed rows and immediately drains (UI "Retry failed"). */
export async function retryFailedSync(): Promise<void> {
  await requeueFailed()
  await drain()
}