/**
 * Single source for the outgoing auth token and for deciding whether a 401
 * really means "this session is over".
 *
 * Normally the outgoing token is the stored session token. During an audited
 * platform support entry (see AuthContext) it is the short-lived support
 * token, so every API client automatically operates inside the entered
 * laundry without each call site knowing about support mode. The support
 * token lives only in memory: a reload safely drops back to the platform
 * session.
 *
 * IMPORTANT: a 401 from *any* microservice is NOT proof that the user's
 * session ended. Every screen talks to several independent services, and a
 * transient database/read-replica hiccup, a service-specific permission rule
 * or a proxy can answer 401 while the JWT is still perfectly valid. Treating
 * those as a logout is what made sessions disappear "sometimes" right after
 * login or on the next click. We therefore only end a session when the token
 * we actually sent is demonstrably expired (or absent).
 */

export const SESSION_EXPIRED_EVENT = 'll:session-expired'
export const SUPPORT_SESSION_EXPIRED_EVENT = 'll:support-session-expired'
export const TOKEN_STORAGE_KEY = 'll_token'
export const USER_STORAGE_KEY = 'll_user'

/** Grace period for clock drift between the browser and the API hosts. */
const CLOCK_SKEW_MS = 60_000

let supportToken: string | null = null
let expiryNotified = false

export function setSupportToken(token: string | null): void {
  supportToken = token
  // A brand-new support session is a new authentication attempt.
  if (token) expiryNotified = false
}

export function getActiveToken(): string | null {
  return (
    supportToken ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null)
  )
}

/** Decode a JWT payload without throwing on malformed/base64url input. */
export function decodeToken(token: string | null): Record<string, unknown> | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    // JWT uses base64url; atob only accepts standard base64. Normalise first
    // so a token containing '-' or '_' is still readable.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
    // atob yields a binary string; decode the UTF-8 bytes so non-ASCII claims
    // (user names with diacritics, etc.) survive intact.
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes))
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * True only when the token is clearly past its expiry. A token with no `exp`,
 * an undecodable token, or one that expired moments ago (clock skew) is NOT
 * treated as expired — an ambiguous 401 must never destroy a valid session.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true // no token was sent: the session is already gone
  const exp = decodeToken(token)?.exp
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return false
  return exp * 1000 < Date.now() - CLOCK_SKEW_MS
}

/** Wipe the persisted half of the session. The auth layer clears React state. */
export function clearStoredSession(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(USER_STORAGE_KEY)
  setSupportToken(null)
}

/**
 * Called by the API interceptor when a protected request proves the token that
 * was actually sent is no longer usable. The one-shot flag prevents a burst of
 * parallel 401s from firing repeatedly.
 *
 * A support token is short-lived by design. When it expires, only the
 * in-memory support session may be dropped; the operator's underlying stored
 * platform session must survive so they land back on the registry. Passing the
 * sent token lets us tell the two apart even when several services answer 401
 * at once.
 */
export function notifySessionExpired(sentToken?: string | null): void {
  if (expiryNotified) return
  expiryNotified = true

  if (sentToken && sentToken === supportToken) {
    setSupportToken(null)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SUPPORT_SESSION_EXPIRED_EVENT))
    }
    return
  }

  clearStoredSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

/** Reset the one-shot guard on every sign-in, scope switch and support exit. */
export function resetSessionExpiryGuard(): void {
  expiryNotified = false
}
