export const AI_SERVICE = {
  baseUrl: import.meta.env.VITE_AI_API_URL ?? 'http://localhost:8009',
  apiKey: import.meta.env.VITE_AI_API_KEY ?? 'dev-key-change-me',
  timeoutMs: 20000,
} as const

/** SHA-256 hex digest of a UTF-8 string — used for response integrity checks. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** HMAC-SHA256 hex signature (WebCrypto). */
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Canonical JSON: recursively sorts object keys so browser + server produce
 * the identical byte string for the same logical payload (mirrors Python's
 * `json.dumps(payload, sort_keys=True, default=str)`).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  const t = typeof value
  if (t === 'number' || t === 'boolean') return String(value)
  if (t === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (t === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== undefined && value[k as keyof typeof value] !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(String(value))
}