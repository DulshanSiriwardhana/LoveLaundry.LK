import type { Query, QueryClient } from '@tanstack/react-query'

/**
 * local_cache_db configuration.
 *
 * Bump this whenever the cache schema or the way dehydrated data is
 * interpreted changes — the whole persisted cache is discarded on mismatch,
 * which is preferable to rendering corrupt/outdated structures.
 */
export const CACHE_VERSION = '20260920-v1'

/** Default TTL for a persisted snapshot until it is considered too old to
 *  restore at all (freshness after restore is handled by per-resource
 *  staleTime + background revalidation). */
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7

/**
 * Whitelist of query-key first segments that are persisted to IndexedDB.
 * Only read/list/master resources the frontend needs on startup are cached
 * (bounded, and never a blind copy of every API response).
 */
export const CACHE_RESOURCES = new Set<string>([
  // Operations (bill_service / quotation-service)
  'gatepasses',
  'bills',
  'deliveries',
  'dispatch',
  'returns',
  'quotations',
  'payments',
  'loyalty',
  'notifications',
  'dashboard',
  'reports',
  // Shop bills
  'shop-bills',
  'legacy-invoices',
  // Workers
  'workers',
  'daily-logs',
  // Linen
  'linens',
  // Management (laundry-management service)
  'mgmt-dashboard',
  'employees',
  'customers',
  'items',
  'categories',
  'expenses',
  'transactions',
  'payments',
  'attendance',
  'salary',
  'advances',
  'holidays',
  'extra-work',
  'company-settings',
])

/** Per-resource staleness (ms). A query is "stale" and refreshed in the
 *  background once this elapses after its last success. Anything not listed
 *  falls back to the global QueryClient default (60s). */
export const STALE_TIMES: Record<string, number> = {
  // Dashboards are heavy remote aggregations — refresh frequently.
  'mgmt-dashboard': 60_000,
  dashboard: 60_000,
  reports: 120_000,
  notifications: 60_000,
  // Money-critical lists.
  'shop-bills': 180_000,
  bills: 180_000,
  'legacy-invoices': 300_000,
  payments: 180_000,
  transactions: 180_000,
  // Master lists / operational records.
  quotations: 300_000,
  gatepasses: 300_000,
  deliveries: 300_000,
  returns: 300_000,
  dispatch: 300_000,
  loyalty: 300_000,
  'daily-logs': 300_000,
  // Reference/HR data changes rarely.
  workers: 600_000,
  employees: 600_000,
  customers: 600_000,
  items: 600_000,
  categories: 600_000,
  'company-settings': 600_000,
  linens: 600_000,
  // Salary-related — mid-stale to keep payroll numbers fresh.
  salary: 180_000,
  advances: 300_000,
  'extra-work': 300_000,
  expenses: 300_000,
  attendance: 120_000,
  // Holidays only change annually.
  holidays: 1_800_000,
}

/** Persist only whitelisted queries that actually hold data. */
export function shouldPersistQuery(query: Query): boolean {
  const first = Array.isArray(query.queryKey) ? String(query.queryKey[0] ?? '') : String(query.queryKey ?? '')
  return CACHE_RESOURCES.has(first) && query.state.data !== undefined
}

/** Per-resource staleness for a key, defaulting to the global 60s. */
export function stalenessFor(queryKey: readonly unknown[]): number {
  const first = String(queryKey[0] ?? '')
  return STALE_TIMES[first] ?? 60_000
}

/**
 * Applies per-resource staleTime overrides so different resources use
 * different freshness rules instead of one arbitrary value.
 */
export function configureQueryDefaults(queryClient: QueryClient): void {
  for (const [resource, staleTime] of Object.entries(STALE_TIMES)) {
    queryClient.setQueryDefaults([resource], { staleTime })
  }
}