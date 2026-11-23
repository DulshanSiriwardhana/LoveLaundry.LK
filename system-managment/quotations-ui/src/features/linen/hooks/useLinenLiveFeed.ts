import { useEffect, useRef, useState } from 'react'
import billsApi from '../../../api/bills-api'
import { getActiveToken } from '../../../lib/auth-token'
import type { LinenRealtimeEvent } from '../lib/scan-session'

export type LinenFeedStatus = 'offline' | 'connecting' | 'live' | 'reconnecting'

/**
 * Subscribe to the bill-service linen hub while a scanning screen is open.
 *
 * The existing `/ws/linen` endpoint authenticates with the JWT in the upgrade
 * query string (browsers cannot send an Authorization header there) and only
 * streams events for the laundry in that token. One connection follows the
 * `laundry` channel, so every device's scan appears immediately.
 */
function websocketUrl(token: string): string | null {
  const base = billsApi.defaults.baseURL
  if (!base) return null
  try {
    const url = new URL(base, typeof window === 'undefined' ? undefined : window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/ws/linen`
    url.search = ''
    url.hash = ''
    url.searchParams.set('token', token)
    return url.toString()
  } catch {
    return null
  }
}

export function useLinenLiveFeed(
  onEvent: (event: LinenRealtimeEvent) => void,
  enabled = true
): { status: LinenFeedStatus; lastEventAt: number | null } {
  const onEventRef = useRef(onEvent)
  const [status, setStatus] = useState<LinenFeedStatus>('offline')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) {
      setStatus('offline')
      return
    }

    let disposed = false
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let pingTimer: number | undefined
    let attempt = 0

    function clearTimers() {
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      if (pingTimer !== undefined) window.clearInterval(pingTimer)
      reconnectTimer = undefined
      pingTimer = undefined
    }

    function scheduleReconnect() {
      if (disposed) return
      attempt += 1
      setStatus('reconnecting')
      const backoff = Math.min(15_000, 500 * 2 ** Math.min(attempt, 5))
      const jitter = Math.floor(Math.random() * 250)
      reconnectTimer = window.setTimeout(connect, backoff + jitter)
    }

    function connect() {
      if (disposed) return
      const token = getActiveToken()
      const url = token ? websocketUrl(token) : null
      if (!url) {
        setStatus('offline')
        return
      }

      setStatus(attempt ? 'reconnecting' : 'connecting')
      try {
        socket = new WebSocket(url)
      } catch {
        scheduleReconnect()
        return
      }

      socket.onopen = () => {
        if (disposed) return
        attempt = 0
        setStatus('live')
        socket?.send(JSON.stringify({ type: 'subscribe', channels: ['laundry'] }))
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }))
          }
        }, 20_000)
      }

      socket.onmessage = message => {
        if (disposed || typeof message.data !== 'string') return
        try {
          const payload = JSON.parse(message.data) as { type?: string }
          if (payload?.type !== 'linen.event') return
          setLastEventAt(Date.now())
          onEventRef.current(payload as LinenRealtimeEvent)
        } catch {
          // Ignore malformed frames; the socket stays useful for later events.
        }
      }

      socket.onerror = () => {
        // `onclose` always follows; let it own the reconnect decision.
      }

      socket.onclose = event => {
        if (disposed) return
        if (pingTimer !== undefined) window.clearInterval(pingTimer)
        pingTimer = undefined
        // 4401/4403 are deliberate server refusals: retrying cannot fix a bad
        // token or a user without a laundry, so stop instead of hot-looping.
        if (event.code === 4401 || event.code === 4403) {
          setStatus('offline')
          return
        }
        scheduleReconnect()
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimers()
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        try {
          socket.close()
        } catch {
          // The browser tore it down first; nothing to clean up.
        }
      }
      socket = null
    }
  }, [enabled])

  return { status, lastEventAt }
}
