/**
 * Single source of truth for "what time is it" in this application.
 *
 * Love Laundry operates only in Sri Lanka, so every timestamp the user sees or
 * submits is interpreted in Asia/Colombo (UTC+05:30, no DST) regardless of the
 * device's own timezone. Storage stays UTC; only the presentation and the
 * calendar-day boundaries move to Sri Lankan time.
 *
 * Everything in here is deliberately dependency-free (no dayjs/luxon) and built
 * on `Intl.DateTimeFormat`, which ships a full IANA tz database in the browser
 * and in Node.
 */
/** IANA zone for all business days, reports and displayed timestamps. */
export const TIME_ZONE = 'Asia/Colombo'

/** Human label appended where a bare time is shown. */
export const TIME_ZONE_LABEL = 'LKT'

/** Sri Lanka is a fixed +05:30 offset with no daylight saving. */
export const UTC_OFFSET_MINUTES = 330

/** ISO-8601 offset used when sending a wall-clock time to the API. */
export const UTC_OFFSET_SUFFIX = '+05:30'

const partsCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let formatter = partsCache.get(key)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, ...options })
    partsCache.set(key, formatter)
  }
  return formatter
}

export interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  /** 0 = Sunday … 6 = Saturday, in Sri Lankan time. */
  weekday: number
}

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  const found = parts.find((p) => p.type === type)
  return found ? Number(found.value) : 0
}

/** Break an instant into Sri Lankan wall-clock fields. */
export function getDateParts(value: Date | string | number = new Date()): DateParts {
  const date = value instanceof Date ? value : new Date(value)
  const parts = partsFormatter({
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    // h23 is essential: with the locale default (h12) midnight comes back as
    // "12" with no day-period part to disambiguate it.
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(date)

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const weekdayLabel = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  return {
    year: pick(parts, 'year'),
    month: pick(parts, 'month'),
    day: pick(parts, 'day'),
    hour: pick(parts, 'hour'),
    minute: pick(parts, 'minute'),
    second: pick(parts, 'second'),
    weekday: Math.max(0, weekdays.indexOf(weekdayLabel)),
  }
}

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0')
}

/** The current instant, as Sri Lankan calendar fields. */
export function now(): DateParts {
  return getDateParts(new Date())
}

/** `YYYY-MM-DD` for the Sri Lankan day that contains the given instant. */
export function todayISO(): string {
  return formatISODate(getDateParts(new Date()))
}

export function formatISODate(parts: DateParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`
}

export function formatISOTime(parts: DateParts): string {
  return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

/**
 * `YYYY-MM-DDTHH:mm:ss+05:30` — the wire format for a wall-clock time the user
 * picked. Sending the explicit offset is what stops the server from reading our
 * midnight as UTC midnight.
 */
export function toISODateTime(value: Date | string | number = new Date()): string {
  const parts = getDateParts(value)
  return `${formatISODate(parts)}T${formatISOTime(parts)}${UTC_OFFSET_SUFFIX}`
}

/**
 * Attach the Sri Lankan offset to a bare `YYYY-MM-DD` so it means *our* midnight
 * rather than the browser's.
 */
export function dateToStartOfDayISO(value: string): string {
  return `${value}T00:00:00${UTC_OFFSET_SUFFIX}`
}

/** `YYYY-MM` for the Sri Lankan month containing the given instant. */
export function currentMonthISO(): string {
  const parts = getDateParts(new Date())
  return `${pad(parts.year, 4)}-${pad(parts.month)}`
}

export function currentYear(): number {
  return getDateParts(new Date()).year
}

export function currentMonth(): number {
  return getDateParts(new Date()).month
}

/** Shift a `YYYY-MM-DD` string by whole days, staying in the date domain. */
export function addDaysISO(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day
  const shifted = new Date(Date.UTC(y, m - 1, d))
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** First day of the month containing the given instant, in Sri Lankan time. */
export function startOfMonthISO(value: Date | string | number = new Date()): string {
  const parts = getDateParts(value)
  return `${pad(parts.year, 4)}-${pad(parts.month)}-01`
}

/** Number of days in the month containing the given instant. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Weekday of a `YYYY-MM-DD`, 0 = Sunday. Date-only strings need no timezone. */
export function weekdayOfISO(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return 0
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The Monday of the week containing `day`. */
export function startOfWeekISO(day: string): string {
  const weekday = weekdayOfISO(day)
  return addDaysISO(day, weekday === 0 ? -6 : 1 - weekday)
}

function toDate(value?: string | Date | null): Date | null {
  if (value === undefined || value === null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return isNaN(date.getTime()) ? null : date
}

/** `2026-09-28, 3:30 PM` — the app's default "date with time" rendering. */
export function formatDateTime(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  }).format(date)
}

/** `2026-09-28` rendering, still in Sri Lankan time. */
export function formatDate(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: TIME_ZONE }).format(date)
}

/**
 * Render a calendar date without any timezone shift. A bare `YYYY-MM-DD` is a
 * date, not an instant, so it is read as-is; anything with a time component is
 * converted into Sri Lankan time first.
 */
export function formatCalendarDate(value?: string | null): string {
  if (!value) return '—'
  const raw = value.trim()
  if (!raw) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)))
  }
  return formatDate(raw)
}

/** `3:30 PM` in Sri Lankan time. */
export function formatTime(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date)
}

/** `28 Sep 2026` — the format the operational screens use. */
export function formatDayMonthYear(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

/** `Mon 28 Sep` — used by the today / daily views. */
export function formatWeekdayDayMonth(value?: string | Date | null): string {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(date)
}

/** `September` — month name for a `YYYY-MM` or `YYYY-MM-DD` string. */
export function monthName(value?: string | null): string {
  if (!value) return '—'
  const [y, m] = value.trim().split('-').map(Number)
  if (!y || !m) return '—'
  return new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  )
}

/** `3:30:45 PM` — the audit-log "Time" column wants seconds. */
export function formatTimestamp(value?: string | Date | number | null): string {
  if (value === undefined || value === null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: TIME_ZONE,
  }).format(date)
}
