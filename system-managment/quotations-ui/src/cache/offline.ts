/**
 * Connectivity tracking for the offline-first write queue.
 *
 * Tracks the browser's network state plus a per-service "known down" flag
 * learned from recent network failures, so a mutation can be queued right away
 * instead of burning a doomed HTTP round-trip (or a long timeout) first.
 */

const serviceDown = new Set<string>()
let online = typeof navigator !== 'undefined' ? !!navigator.onLine : true
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function setOnline(value: boolean): void {
  if (online === value) return
  online = value
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => setOnline(true))
  window.addEventListener('offline', () => setOnline(false))
}

export function isGlobalOnline(): boolean {
  return online
}

/** Whether a specific backend is currently believed to be unreachable. */
export function isServiceDown(service: string): boolean {
  return serviceDown.has(service)
}

export function markServiceDown(service: string): void {
  if (!serviceDown.has(service)) {
    serviceDown.add(service)
    emit()
  }
}

export function markServiceUp(service: string): void {
  if (serviceDown.delete(service)) emit()
}

export function subscribeConnectivity(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function connectivitySnapshot(): { online: boolean; downServices: string[] } {
  return { online, downServices: [...serviceDown] }
}