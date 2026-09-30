/**
 * Offline-first axios adapter.
 *
 * Installed on an axios instance (via `installOfflineAdapter`), it wraps the
 * platform default adapter so that WRITE requests (POST/PUT/PATCH/DELETE):
 *
 *  1. when the browser is offline, or the backend was recently seen as
 *     unreachable, are immediately written to the outbox (IndexedDB) and the
 *     request resolves as `202 Accepted (offline)` with a `{ queued: true }`
 *     marker instead of failing;
 *  2. when a request is sent but dies mid-flight (no HTTP response — network
 *     drop, timeout), are queued the same way so nothing is lost;
 *
 * The sync engine later replays the queue with deterministic idempotency keys
 * (safe re-submission) and refreshes the React Query cache.
 *
 * Reads (GET) are left to the platform adapter + existing React Query
 * persister cache; auth/file-upload requests are never queued.
 */
import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { idempotencyKey } from '../lib/idempotency'
import { isGlobalOnline, isServiceDown, markServiceDown, markServiceUp } from './offline'
import { enqueueMutation } from './outbox'

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete'])
/** Routes that must never be replayed after the fact. */
const NEVER_QUEUE = /^\/(auth|token|login|register|share|uploads)(\/|$)/i
/** Backends currently being replayed by the sync engine — no re-queueing. */
const replaying = new Set<string>()

export function setReplaying(service: string, value: boolean): void {
  if (value) replaying.add(service)
  else replaying.delete(service)
}

/** Marker returned in the response body of an offline-queued write. */
export interface QueuedOfflineResponse {
  queued: true
  outbox_id: number
  service: string
  method: string
  url: string
  queued_at: number
}

const baseAdapter: AxiosAdapter = axios.getAdapter(axios.defaults.adapter)

function isMutation(config: InternalAxiosRequestConfig): boolean {
  return MUTATION_METHODS.has((config.method ?? 'get').toLowerCase())
}

function shouldQueue(config: InternalAxiosRequestConfig): boolean {
  if (!isMutation(config)) return false
  const url = config.url ?? ''
  if (NEVER_QUEUE.test(url)) return false
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) return false
  return true
}

/** Maps a request URL to a React Query resource (for cache invalidation). */
function resourceFor(service: string, url: string): string | undefined {
  const path = url.split('?')[0]
  let segs = path.split('/').filter(Boolean)
  if (service === 'management' && segs[0] === 'api') segs = segs.slice(1)
  if (segs[0] === 'management') segs = segs.slice(1)
  const first = segs[0]
  return first || undefined
}

interface PendingIdentity {
  kind: 'create' | 'update' | 'delete'
  entity_id?: string
}

/**
 * Classifies a queued write so per-record "pending sync" badges can match it
 * to a visible entity: updates/deletes target an id found in the URL,
 * collection-level POSTs are creates.
 */
function parsePendingIdentity(service: string, method: string, url: string): PendingIdentity {
  const path = url.split('?')[0]
  let segs = path.split('/').filter(Boolean)
  if (service === 'management' && segs[0] === 'api') segs = segs.slice(1)
  if (segs[0] === 'management') segs = segs.slice(1)
  const id = segs[1]
  if (method === 'DELETE') return { kind: 'delete', entity_id: id }
  if (method === 'PATCH' || method === 'PUT') return { kind: 'update', entity_id: id }
  if (segs.length >= 3) return { kind: 'update', entity_id: id }
  return { kind: 'create' }
}

async function buildQueuedResponse(
  config: InternalAxiosRequestConfig,
  service: string,
): Promise<AxiosResponse<QueuedOfflineResponse>> {
  const method = (config.method ?? 'get').toUpperCase()
  const body = config.data
  let key: string | undefined
  if (method === 'POST') key = await idempotencyKey(body)
  const identity = parsePendingIdentity(service, method, config.url ?? '')
  const outbox_id = await enqueueMutation({
    service,
    method,
    url: config.url ?? '',
    baseURL: config.baseURL ?? '',
    data: body,
    idempotency_key: key,
    resource: resourceFor(service, config.url ?? ''),
    kind: identity.kind,
    entity_id: identity.entity_id,
  })
  const marker: QueuedOfflineResponse = {
    queued: true,
    outbox_id,
    service,
    method,
    url: config.url ?? '',
    queued_at: Date.now(),
  }
  return {
    data: marker,
    status: 202,
    statusText: 'Accepted (offline)',
    headers: {} as AxiosResponse['headers'],
    config: config as InternalAxiosRequestConfig,
    request: config,
  }
}

/** Installs offline-first behaviour on an axios instance. */
export function installOfflineAdapter(instance: AxiosInstance, service: string): void {
  instance.defaults.adapter = async (
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse> => {
    const canQueue = shouldQueue(config) && !replaying.has(service)

    // Explicit offline / known-down: queue without attempting the network.
    if (canQueue && (!isGlobalOnline() || isServiceDown(service))) {
      return buildQueuedResponse(config, service)
    }

    try {
      const response = await baseAdapter(config)
      if (isMutation(config)) markServiceUp(service)
      return response
    } catch (err) {
      const e = err as { response?: unknown }
      if (!e.response) {
        markServiceDown(service)
        if (canQueue) return buildQueuedResponse(config, service)
      }
      throw err
    }
  }
}