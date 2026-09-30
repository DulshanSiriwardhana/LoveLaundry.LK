import type { QueryClient } from '@tanstack/react-query'

/**
 * Central registry of cache keys affected by writes.
 *
 * `refetchOnWindowFocus` is disabled app-wide, so invalidation is the ONLY way
 * a list or dashboard learns that something was created, updated or deleted.
 * Invalidating one narrow key per mutation is what left pages showing stale
 * data until a full browser refresh, so every write resolves its affected keys
 * through this module instead.
 *
 * React Query matches a filter key against a stored key by PREFIX: `['bills']`
 * matches `['bills', 'list', params]` and `['bills', id]`, but never
 * `['shop-bills']`. Each entry below is therefore a namespace root, and a
 * resource that is cached under more than one root lists all of them.
 */

/** Aggregates computed across resources — dashboards, reports, summaries. */
export const DERIVED_KEYS = [
  ['mgmt-dashboard'],
  ['dashboard'],
  ['reports'],
  ['mgmt-pl-report'],
  ['mgmt-daily-report'],
  ['mgmt-monthly-report'],
  ['mgmt-outstanding'],
  ['mgmt-expense-summary'],
  ['mgmt-customer-summary'],
  ['attendance-summary'],
  ['notifications'],
  ['statement'],
  ['client-summary'],
  ['events'],
  ['ai-insights'],
  ['ai-revenue'],
  ['ai-expenses'],
  ['ai-salary'],
  ['ai-risk'],
] as const

/**
 * Namespace roots per resource, grouped by service.
 *
 * management — laundry-management service (`mgmt-*`, plus the few unprefixed
 *   keys those pages read). operations — bill/quotation services, linen and
 *   workers.
 */
export const RESOURCE_KEYS = {
  // ── Management (laundry-management) ────────────────────────────────
  employees: ['mgmt-employees', 'mgmt-attendance-log-employees'],
  attendance: [
    'attendance',
    'attendance-all',
    'attendance-summary',
    'mgmt-attendance-log-records',
    'mgmt-attendance-month',
    'mgmt-attendance-log-employees',
    'mgmt-employees',
  ],
  customers: ['mgmt-customers', 'mgmt-customers-list', 'mgmt-customer-summary'],
  items: ['mgmt-items', 'mgmt-items-list', 'mgmt-categories'],
  categories: ['mgmt-categories', 'mgmt-items'],
  expenses: ['mgmt-expenses', 'mgmt-expense-summary', 'mgmt-expense-cats'],
  transactions: ['mgmt-transactions', 'mgmt-outstanding'],
  mgmtPayments: ['mgmt-payments', 'mgmt-transactions'],
  holidays: ['holidays', 'mgmt-holidays'],
  salary: ['salary-slips', 'advances', 'mgmt-employees'],
  advances: ['advances', 'salary-slips'],
  extraWork: ['extra-work-records', 'extra-work-categories', 'salary-slips'],
  settings: ['company-settings'],
  database: ['database-status'],

  // ── Operations (bill / quotation services) ─────────────────────────
  quotations: ['quotations'],
  gatepasses: [
    'gatepasses',
    'deliveries',
    'bills',
    'shop-bills',
    'payments',
    'ops',
    'returns',
    'events',
  ],
  dispatch: ['dispatch', 'ops'],
  bills: ['bills', 'shop-bills', 'payments', 'loyalty', 'statement'],
  returns: ['returns', 'events', 'ops', 'deliveries'],
  loyalty: ['loyalty', 'shop-bills'],
  linen: ['linens', 'linen-flow', 'workers', 'daily-logs'],
  workers: ['workers', 'linens', 'daily-logs'],
} as const satisfies Record<string, readonly string[]>

export type ResourceKey = keyof typeof RESOURCE_KEYS

function invalidateRoots(qc: QueryClient, roots: readonly (readonly string[])[]): void {
  for (const queryKey of roots) {
    void qc.invalidateQueries({ queryKey: queryKey as unknown as readonly unknown[] })
  }
}

/**
 * Refresh every cross-resource aggregate. Applied globally on successful
 * mutations (see App.tsx) so a write to one screen can never leave a dashboard
 * or report showing pre-write numbers.
 */
export function invalidateDerived(qc: QueryClient): void {
  invalidateRoots(qc, DERIVED_KEYS)
}

/**
 * Refresh everything a write to `resource` can change: the resource's own
 * lists/details plus all derived aggregates.
 */
export function invalidateResource(qc: QueryClient, ...resources: ResourceKey[]): void {
  for (const resource of resources) {
    invalidateRoots(qc, RESOURCE_KEYS[resource] as unknown as readonly (readonly string[])[])
  }
  invalidateDerived(qc)
}
