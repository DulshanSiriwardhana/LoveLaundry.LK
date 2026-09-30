/** Deterministic idempotency key for create requests.
 *
 * The key is derived from the canonical payload so a retry of the same
 * logical submission (network drop, double click, offline queue replay)
 * yields the identical `X-Idempotency-Key` header, letting the backend's
 * idempotency guard return the already-created entity instead of a duplicate.
 *
 * Uses SHA-256 when `crypto.subtle` is available (secure contexts: HTTPS /
 * localhost) and falls back to a deterministic 32-bit hash otherwise.
 */

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(',')}}`
}

export async function idempotencyKey(payload: unknown): Promise<string> {
  const text = canonicalize(payload)
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      return `s1-${hex}`
    }
  } catch {
    // Secure-context API unavailable — fall back to the sync hash.
  }
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0
  }
  return `f1-${hash.toString(16)}`
}