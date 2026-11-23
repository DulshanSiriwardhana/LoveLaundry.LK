import type {
  Linen,
  LinenBulkScanResult,
  LinenCustody,
  LinenTransitionList,
} from '../../../types/linen'
import { parseLinenCode } from './linen-code'

/**
 * Pure state for one continuous scanning session.
 *
 * Scans are queued locally and are NOT written to linen when they are read.
 * Pressing OK submits the whole queue in one `POST /linens/bulk-scan` call and
 * the server response settles every queued row. Keeping this module free of
 * React and of the network makes the counters and the retry rules testable.
 *
 * A session exists only in the browser: the server has no session entity. The
 * id is an operator-facing reference for one batch, not a database key.
 */

export type ScanOutcome =
  /** A valid code waiting for the OK batch submission. */
  | 'queued'
  /** Confirmed by the server as part of the OK batch. */
  | 'success'
  /** The same tag was already queued or updated in this session. */
  | 'duplicate'
  /** The read was not a linen tag at all (a Wi-Fi poster, for example). */
  | 'unreadable'
  /** A well-formed code the server could not find. */
  | 'not_found'
  /** The server refused this row. */
  | 'rejected'
  /** The batch call failed or returned no answer for this row. */
  | 'failed'

/** Whether a code was proven to belong to this laundry by the trusted API. */
export type VerificationState =
  /** Lookup still in flight. */
  | 'checking'
  /** `GET /linens/verify/{code}` found this exact tag in this tenant. */
  | 'verified'
  /** The code is not registered here — treat it as a fake/wrong QR. */
  | 'unverified'

export type LinenScanCategory =
  | 'bath_towel'
  | 'pool_towel'
  | 'single_bedsheet'
  | 'double_bedsheet'
  | 'other'

/** Identity fields needed to categorise and prove a scanned tag. */
export interface VerifiedLinen {
  linen_id: string
  category?: string
  item_type?: string
  description?: string
  size?: string
  client_name?: string
  status?: string
}

/** The last live event seen for this tag on `/ws/linen`. */
export interface LinenLiveUpdate {
  at: number
  event: string
  action?: string
  status?: string
  previousStatus?: string
}

/** Wire shape published by bill-service's linen realtime hub. */
export interface LinenRealtimeEvent {
  type?: string
  event?: string
  action?: string
  at?: string
  clock?: number
  linen?: Partial<Linen> & { linen_id?: string; previous_status?: string }
  linen_ids?: string[]
}

export interface ScanRecord {
  /** Normalised linen code, or capped raw text when the read was unreadable. */
  code: string
  outcome: ScanOutcome
  fromStatus?: string
  toStatus?: string
  message?: string
  attemptedAt: number
  resolvedAt?: number
  verification?: VerificationState
  verifiedAt?: number
  identity?: VerifiedLinen
  live?: LinenLiveUpdate
}

export interface ScanSession {
  id: string
  action: string
  actionLabel: string
  toStatus: string
  custody: LinenCustody
  operator: string
  startedAt: number
  endedAt?: number
  /** Newest first, so the visible history strip shows the live edge. */
  records: ScanRecord[]
}

export interface LinenCategorySummary {
  /** Distinct valid tag codes, regardless of how many times each was read. */
  distinct: number
  bathTowels: number
  poolTowels: number
  singleBedsheets: number
  doubleBedsheets: number
  /** Valid tags whose category metadata could not be determined yet. */
  other: number
  verified: number
  unverified: number
}

export interface ScanSummary {
  attempts: number
  queued: number
  successful: number
  uniqueLinens: number
  /** Alias used by the live scanner summary cards. */
  distinctLinens: number
  verifiedLinens: number
  unverifiedLinens: number
  duplicates: number
  unreadable: number
  notFound: number
  rejected: number
  failed: number
  categories: LinenCategorySummary
}

type SummaryBucket = 'queued' | 'successful' | 'duplicates' | 'unreadable' | 'notFound' | 'rejected' | 'failed'

const OUTCOME_BUCKET: Record<ScanOutcome, SummaryBucket> = {
  queued: 'queued',
  success: 'successful',
  duplicate: 'duplicates',
  unreadable: 'unreadable',
  not_found: 'notFound',
  rejected: 'rejected',
  failed: 'failed',
}

const MAX_DISPLAY_CODE = 32
const RETRYABLE: ScanOutcome[] = ['not_found', 'rejected', 'failed']

/** Human-readable reason a scan is not allowed, or null when it is fine.
 *
 * Mirrors the server rule: a status missing from the matrix is unrestricted.
 * The browser check is only advisory — the server always re-checks on submit.
 */
export function transitionViolation(
  catalogue: LinenTransitionList | undefined,
  fromStatus: string | undefined,
  toStatus: string,
): string | null {
  const rules = catalogue?.transition_rules || []
  if (!rules.length || !fromStatus) return null
  const rule = rules.find(r => r.from_status === fromStatus)
  if (!rule || rule.to_statuses.includes(toStatus)) return null
  return `Cannot move linen from ${fromStatus.replace(/_/g, ' ').toLowerCase()} to ${toStatus.replace(/_/g, ' ').toLowerCase()}`
}

/** Target states permitted from a given current state under the admin matrix. */
export function allowedNextStatuses(
  catalogue: LinenTransitionList | undefined,
  fromStatus: string | undefined,
): string[] | null {
  const rules = catalogue?.transition_rules || []
  if (!rules.length || !fromStatus) return null
  const rule = rules.find(r => r.from_status === fromStatus)
  return rule ? rule.to_statuses : null
}

export const CATEGORY_LABEL: Record<LinenScanCategory, string> = {
  bath_towel: 'Bath Towel',
  pool_towel: 'Pool Towel',
  single_bedsheet: 'Single Bedsheet',
  double_bedsheet: 'Double Bedsheet',
  other: 'Other linen',
}

export function createSession(input: {
  action: string
  actionLabel: string
  toStatus: string
  custody: LinenCustody
  operator: string
  id?: string
  startedAt?: number
}): ScanSession {
  return {
    id: input.id ?? newSessionId(),
    action: input.action,
    actionLabel: input.actionLabel,
    toStatus: input.toStatus,
    custody: input.custody,
    operator: input.operator,
    startedAt: input.startedAt ?? Date.now(),
    records: [],
  }
}

export function isSessionOpen(session: ScanSession): boolean {
  return session.endedAt === undefined
}

export function endSession(session: ScanSession, endedAt = Date.now()): ScanSession {
  return { ...session, endedAt }
}

/** Add one raw scan. Invalid reads are recorded so the operator can see them;
 * valid codes enter the batch queue unless they are already in this session. */
export function recordScan(session: ScanSession, raw: string, attemptedAt = Date.now()): ScanSession {
  const code = parseLinenCode(raw)

  if (!code) {
    const shown = (raw ?? '').trim().slice(0, MAX_DISPLAY_CODE) || 'empty read'
    return prepend(session, {
      code: shown,
      outcome: 'unreadable',
      message: 'Not a linen tag',
      attemptedAt,
    })
  }

  const previous = session.records.find(
    record => record.code === code && (record.outcome === 'queued' || record.outcome === 'success')
  )
  if (previous) {
    return prepend(session, {
      code,
      outcome: 'duplicate',
      message: 'Already in this session',
      attemptedAt,
      // A repeat read of a known tag must keep its proof and category.
      verification: previous.verification,
      verifiedAt: previous.verifiedAt,
      identity: previous.identity,
    })
  }

  return prepend(session, { code, outcome: 'queued', attemptedAt, verification: 'checking' })
}

/** Codes to send to bulk-scan, oldest first and unique. */
export function queuedCodes(session: ScanSession): string[] {
  return session.records
    .filter(record => record.outcome === 'queued')
    .reverse()
    .map(record => record.code)
}

/** Every distinct valid code in the session, for verification lookups. */
export function scannedCodes(records: ScanRecord[]): string[] {
  const seen = new Set<string>()
  const codes: string[] = []
  for (const record of records) {
    if (record.outcome === 'unreadable' || !record.code) continue
    if (!parseLinenCode(record.code)) continue
    if (seen.has(record.code)) continue
    seen.add(record.code)
    codes.push(record.code)
  }
  return codes
}

/** Re-open a finished session and put server-rejected rows back in the queue.
 * Unreadable reads have no usable code, so they are dropped and re-scanned. */
export function requeueUnresolved(session: ScanSession): ScanSession {
  const seen = new Set(queuedCodes(session))
  const records = session.records.flatMap(record => {
    if (record.outcome === 'unreadable') return []

    if (RETRYABLE.includes(record.outcome)) {
      if (seen.has(record.code)) return []
      seen.add(record.code)
      return [{ ...record, outcome: 'queued' as const, message: undefined, resolvedAt: undefined }]
    }

    return [record]
  })

  return { ...session, endedAt: undefined, records }
}

/** Settle every queued row from one bulk-scan response. */
export function applyBulkResult(
  session: ScanSession,
  result: LinenBulkScanResult,
  resolvedAt = Date.now()
): ScanSession {
  const processed = new Map<string, LinenBulkScanResult['processed'][number]>()
  for (const row of result.processed ?? []) {
    processed.set(normalise(row.linen_id), row)
  }

  const errors = new Map<string, string>()
  for (const row of result.errors ?? []) {
    errors.set(normalise(row.linen_id), row.error)
  }

  return {
    ...session,
    records: session.records.map(record => {
      if (record.outcome !== 'queued') return record

      const row = processed.get(record.code)
      if (row) {
        return {
          ...record,
          outcome: 'success' as const,
          fromStatus: row.from_status,
          toStatus: row.to_status,
          message: undefined,
          resolvedAt,
        }
      }

      const error = errors.get(record.code)
      if (error) {
        const notFound = /not\s*found|not\s*registered/i.test(error)
        return {
          ...record,
          outcome: notFound ? ('not_found' as const) : ('rejected' as const),
          message: error,
          resolvedAt,
          // The write itself proved the code is not in this tenant.
          verification: notFound ? 'unverified' : record.verification,
        }
      }

      return {
        ...record,
        outcome: 'failed' as const,
        message: 'No result was returned for this code',
        resolvedAt,
      }
    }),
  }
}

/** A transport-level failure settles every queued row so none is left looking
 * as though it might have been submitted. They stay retryable. */
export function failQueued(session: ScanSession, message: string, resolvedAt = Date.now()): ScanSession {
  return {
    ...session,
    records: session.records.map(record =>
      record.outcome === 'queued'
        ? { ...record, outcome: 'failed' as const, message, resolvedAt }
        : record
    ),
  }
}

/** Apply the result of the non-mutating by-code verification lookup. */
export function applyLinenVerification(
  session: ScanSession,
  code: string,
  linen: VerifiedLinen | null,
  at = Date.now()
): ScanSession {
  const key = normalise(code)
  if (!key) return session

  return {
    ...session,
    records: session.records.map(record => {
      if (record.code !== key) return record
      if (!linen) {
        // A transient lookup error must not erase a proof we already have.
        if (record.verification === 'verified') return record
        return { ...record, verification: 'unverified' as const, verifiedAt: at }
      }
      return {
        ...record,
        verification: 'verified' as const,
        verifiedAt: at,
        identity: mergeIdentity(record.identity, { ...linen, linen_id: linen.linen_id || key }),
      }
    }),
  }
}

/** Patch every row matching a linen.event frame from `/ws/linen`. */
export function applyLinenLiveEvent(
  session: ScanSession,
  event: LinenRealtimeEvent,
  receivedAt = Date.now()
): ScanSession {
  const codes = new Set<string>()
  if (event.linen?.linen_id) codes.add(normalise(event.linen.linen_id))
  for (const code of event.linen_ids ?? []) {
    if (code) codes.add(normalise(code))
  }
  if (!codes.size) return session

  const update: LinenLiveUpdate = {
    at: parseEventTime(event.at) ?? receivedAt,
    event: event.event || 'linen.event',
    action: event.action,
    status: event.linen?.status,
    previousStatus: event.linen?.previous_status,
  }
  const snapshot = event.linen
    ? toVerifiedLinen(event.linen, normalise(event.linen.linen_id ?? ''))
    : null

  return {
    ...session,
    records: session.records.map(record => {
      if (!codes.has(record.code)) return record
      return {
        ...record,
        live: update,
        identity: snapshot ? mergeIdentity(record.identity, snapshot) : record.identity,
        verification: snapshot ? 'verified' : record.verification,
        verifiedAt: snapshot ? update.at : record.verifiedAt,
      }
    }),
  }
}

/** Classify from the fields the linen service actually stores. Categories are
 * free-form strings in Mongo, so bath/pool towels and single/double sheets are
 * derived from category + item type + description + size. */
export function classifyLinen(identity?: VerifiedLinen | null): LinenScanCategory {
  if (!identity) return 'other'
  const category = upper(identity.category)
  const itemType = upper(identity.item_type)
  const description = upper(identity.description)
  const size = upper(identity.size)
  const text = `${category} ${itemType} ${description} ${size}`

  // A bath mat is a mat, never a bath towel.
  if (text.includes('BATH MAT') || text.includes('BATHMAT')) return 'other'

  const isTowel = ['TOWEL'].some(word => text.includes(word))
  if (isTowel) {
    if (/\bPOOL\b/.test(text)) return 'pool_towel'
    return 'bath_towel'
  }

  const isSheet = text.includes('BEDSHEET') || text.includes('BED SHEET') || text.includes('SHEET')
  if (isSheet) {
    if (/\b(DOUBLE|KING|QUEEN|6FT)\b/.test(text) || /(^|\W)2(\W|$)/.test(size)) {
      return 'double_bedsheet'
    }
    if (/\b(SINGLE|TWIN|5FT|4FT)\b/.test(text) || /(^|\W)1(\W|$)/.test(size)) {
      return 'single_bedsheet'
    }
  }

  return 'other'
}

export function summariseCategories(records: ScanRecord[]): LinenCategorySummary {
  const summary: LinenCategorySummary = {
    distinct: 0,
    bathTowels: 0,
    poolTowels: 0,
    singleBedsheets: 0,
    doubleBedsheets: 0,
    other: 0,
    verified: 0,
    unverified: 0,
  }

  // One linen can be read many times. Keep the newest record per code so its
  // verification proof and category metadata win, then count each code once.
  const unique = new Map<string, ScanRecord>()
  for (const record of records) {
    if (record.outcome === 'unreadable' || !record.code || !parseLinenCode(record.code)) continue
    const existing = unique.get(record.code)
    if (
      !existing ||
      (record.verifiedAt ?? 0) > (existing.verifiedAt ?? 0) ||
      (existing.verifiedAt === record.verifiedAt && record.attemptedAt > existing.attemptedAt)
    ) {
      unique.set(record.code, record)
    }
  }

  for (const record of unique.values()) {
    summary.distinct += 1
    if (record.verification === 'verified') summary.verified += 1
    if (record.verification === 'unverified') summary.unverified += 1
    switch (classifyLinen(record.identity)) {
      case 'bath_towel': summary.bathTowels += 1; break
      case 'pool_towel': summary.poolTowels += 1; break
      case 'single_bedsheet': summary.singleBedsheets += 1; break
      case 'double_bedsheet': summary.doubleBedsheets += 1; break
      default: summary.other += 1
    }
  }
  return summary
}

export function summarise(session: ScanSession): ScanSummary {
  const summary: ScanSummary = {
    attempts: session.records.length,
    queued: 0,
    successful: 0,
    uniqueLinens: 0,
    distinctLinens: 0,
    verifiedLinens: 0,
    unverifiedLinens: 0,
    duplicates: 0,
    unreadable: 0,
    notFound: 0,
    rejected: 0,
    failed: 0,
    categories: summariseCategories(session.records),
  }

  const successfulCodes = new Set<string>()
  for (const record of session.records) {
    summary[OUTCOME_BUCKET[record.outcome]] += 1
    if (record.outcome === 'success') successfulCodes.add(record.code)
  }
  summary.uniqueLinens = successfulCodes.size
  summary.distinctLinens = summary.categories.distinct
  summary.verifiedLinens = summary.categories.verified
  summary.unverifiedLinens = summary.categories.unverified
  return summary
}

/** Every attempt that did not result in a linen update. */
export function failedTotal(summary: ScanSummary): number {
  return summary.unreadable + summary.notFound + summary.rejected + summary.failed
}

export const OUTCOME_TONE: Record<ScanOutcome, 'green' | 'amber' | 'red' | 'blue' | 'neutral'> = {
  success: 'green',
  queued: 'blue',
  duplicate: 'amber',
  unreadable: 'amber',
  not_found: 'red',
  rejected: 'red',
  failed: 'red',
}

export const OUTCOME_LABEL: Record<ScanOutcome, string> = {
  success: 'Updated',
  queued: 'Queued',
  duplicate: 'Duplicate',
  unreadable: 'Not a linen tag',
  not_found: 'Not registered',
  rejected: 'Rejected',
  failed: 'Failed',
}

export function filterRecords(records: ScanRecord[], term: string): ScanRecord[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return records
  return records.filter(record =>
    [
      record.code,
      record.fromStatus,
      record.toStatus,
      record.message,
      OUTCOME_LABEL[record.outcome],
      record.identity && CATEGORY_LABEL[classifyLinen(record.identity)],
      record.identity?.client_name,
      record.live?.status,
    ]
      .filter(Boolean)
      .some(field => String(field).toLowerCase().includes(needle))
  )
}

/** Whole days between a timestamp and now; null for missing/invalid dates. */
export function daysSince(value?: string | number | Date | null, now = Date.now()): number | null {
  if (value === undefined || value === null || value === '') return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((now - ms) / 86_400_000))
}

/** One definition of "missing in cycle", shared by the scanner and its tests. */
export function isMissingInCycle(
  linen: Pick<Linen, 'status' | 'last_scanned_date'>,
  days: number,
  now = Date.now()
): boolean {
  if (!Number.isFinite(days) || days < 1) return false
  if (linen.status === 'RETIRED') return false
  if (linen.status === 'MISSING') return true
  const elapsed = daysSince(linen.last_scanned_date, now)
  return elapsed === null || elapsed >= days
}

function prepend(session: ScanSession, record: ScanRecord): ScanSession {
  return { ...session, records: [record, ...session.records] }
}

function normalise(code: string): string {
  return String(code ?? '').trim().toUpperCase()
}

function upper(value?: string): string {
  return String(value ?? '').trim().toUpperCase()
}

function toVerifiedLinen(snapshot: Partial<Linen> & { linen_id?: string }, fallbackCode: string): VerifiedLinen {
  return {
    linen_id: snapshot.linen_id || fallbackCode,
    category: snapshot.category,
    item_type: snapshot.item_type,
    description: snapshot.description,
    size: snapshot.size,
    client_name: snapshot.client_name,
    status: snapshot.status,
  }
}

function mergeIdentity(existing: VerifiedLinen | undefined, incoming: VerifiedLinen): VerifiedLinen {
  return {
    linen_id: incoming.linen_id || existing?.linen_id || '',
    category: incoming.category ?? existing?.category,
    item_type: incoming.item_type ?? existing?.item_type,
    description: incoming.description ?? existing?.description,
    size: incoming.size ?? existing?.size,
    client_name: incoming.client_name ?? existing?.client_name,
    status: incoming.status ?? existing?.status,
  }
}

function parseEventTime(value?: string): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function newSessionId(): string {
  const stamp = new Date().toISOString().slice(11, 16).replace(':', '')
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `S-${stamp}-${random}`
}
