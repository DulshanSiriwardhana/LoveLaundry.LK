/**
 * Local-date helpers that avoid the UTC round-trip footgun of
 * `new Date().toISOString()` / `new Date('YYYY-MM-DD').toISOString()`.
 *
 * All "which day is it" questions are answered in Sri Lankan time — see
 * `./time`.
 */

import { getDateParts, formatISODate, TIME_ZONE } from './time'

export { todayISO } from './time'

/**
 * Normalize a Date or date-string to a `YYYY-MM-DD` string in Sri Lankan time
 * ('' when invalid). A bare `YYYY-MM-DD` string is already a calendar date and is
 * returned untouched.
 */
export function toISODate(v: Date | string): string {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    return formatISODate(getDateParts(v))
  }
  if (typeof v === 'string') {
    const t = v.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
    if (!t) return ''
    const d = new Date(t)
    if (isNaN(d.getTime())) return ''
    return formatISODate(getDateParts(d))
  }
  return ''
}

export { TIME_ZONE }
