/**
 * Local-date helpers that avoid the UTC round-trip footgun of
 * `new Date().toISOString()` / `new Date('YYYY-MM-DD').toISOString()`.
 */

export function todayISO(): string {
  const d = new Date()
  return toISODate(d)
}

/** Normalize a Date or date-string to a local `YYYY-MM-DD` string ('' when invalid). */
export function toISODate(v: Date | string): string {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return formatParts(v.getFullYear(), v.getMonth() + 1, v.getDate())
  }
  if (typeof v === 'string') {
    const t = v.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
    if (!t) return ''
    const d = new Date(t)
    if (isNaN(d.getTime())) return ''
    return formatParts(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return ''
}

function formatParts(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}