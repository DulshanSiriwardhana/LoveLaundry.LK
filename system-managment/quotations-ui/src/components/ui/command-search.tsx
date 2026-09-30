import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlass, ArrowRight, FilePlus, Receipt, ClipboardText, ShoppingCart, FileText, X,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useQuotations } from '../../features/quotations/hooks/useQuotations'
import { cn } from '../../lib/utils'
import { Dialog, DialogContent, DialogTitle } from './dialog'

interface CommandSearchProps {
  open: boolean
  onClose: () => void
}

interface NavTarget {
  label: string
  keywords: string
  path: string
}

const NAV_ITEMS: NavTarget[] = [
  { label: 'New Quotation', keywords: 'quote new quotation create', path: '/quotations/new' },
  { label: 'Quotations', keywords: 'quotations quotes list price', path: '/quotations' },
  { label: 'Bills', keywords: 'bills invoices list', path: '/bills' },
  { label: 'Client Statement', keywords: 'statement client ledger history balance', path: '/statements' },
  { label: 'New Bill', keywords: 'bill create bill invoice', path: '/bills/new' },
  { label: 'Gate Passes', keywords: 'gate passes receiving received', path: '/gate-passes' },
  { label: 'New Gate Pass', keywords: 'gate pass new receive', path: '/gate-passes/new' },
  { label: 'Deliveries', keywords: 'deliveries sent delivery', path: '/deliveries' },
  { label: 'New Delivery', keywords: 'delivery new deliver', path: '/deliveries/new' },
  { label: 'Returns', keywords: 'returns refunds', path: '/returns' },
  { label: 'Record Return', keywords: 'return new record', path: '/returns/new' },
  { label: 'Dashboard', keywords: 'home dashboard overview', path: '/' },
  { label: 'Business Intelligence', keywords: 'business dashboard analytics insights', path: '/business-dashboard' },
  { label: 'Customers', keywords: 'customers clients', path: '/customers' },
  { label: 'Reports', keywords: 'reports export sales', path: '/reports' },
  { label: 'Users', keywords: 'users staff accounts', path: '/users' },
  { label: 'Shop Bills', keywords: 'shop bills cash', path: '/shop-bills' },
  { label: 'Create Shop Bill', keywords: 'shop bill create new', path: '/shop-bills/new' },
  { label: 'Staff Management', keywords: 'workers staff employees', path: '/workers' },
  { label: 'Daily Tasks', keywords: 'daily tasks work', path: '/workers/daily-tasks' },
  { label: 'Management Dashboard', keywords: 'management overview', path: '/management' },
  { label: 'All Transactions', keywords: 'transactions all management', path: '/management/transactions' },
  { label: 'Manage Customers', keywords: 'management customers', path: '/management/customers' },
  { label: 'Items & Categories', keywords: 'items categories management', path: '/management/items' },
  { label: 'Expense Management', keywords: 'expenses management', path: '/management/expenses' },
  { label: 'Employees & Salaries', keywords: 'employees salaries management', path: '/management/employees' },
  { label: 'Salary Advances', keywords: 'advances salary loans', path: '/management/advances' },
  { label: 'Holiday Calendar', keywords: 'holidays calendar', path: '/management/holidays' },
  { label: 'Extra Work', keywords: 'extra work overtime', path: '/management/extra-work' },
  { label: 'Attendance', keywords: 'attendance present', path: '/management/attendance' },
  { label: 'Payments', keywords: 'payments management', path: '/management/payments' },
  { label: 'Linen Dashboard', keywords: 'linen tracking dashboard', path: '/linen' },
]

const QUICK_ACTIONS: { label: string; path: string; icon: Icon }[] = [
  { label: 'New Quotation', path: '/quotations/new', icon: FilePlus },
  { label: 'New Bill', path: '/bills/new', icon: Receipt },
  { label: 'New Gate Pass', path: '/gate-passes/new', icon: ClipboardText },
  { label: 'New Shop Bill', path: '/shop-bills/new', icon: ShoppingCart },
]

/**
 * Rendered as an element, never invoked as a function.
 *
 * Phosphor icons are `React.forwardRef` objects, not plain functions, so
 * `Icon({ size: 14 })` throws "is not a function" the moment the palette is
 * opened with an empty field. Because this renders inside the layout, the throw
 * reached the route error boundary and replaced the whole page with
 * "Error 500 — Unexpected Error" instead of failing locally.
 */
function QuickActionIcon({ path }: { path: string }) {
  const Icon = QUICK_ACTIONS.find((a) => a.path === path)?.icon ?? FileText
  return <Icon size={14} />
}

type Result =
  | { kind: 'page'; key: string; label: string; path: string }
  | { kind: 'quotation'; key: string; label: string; sub: string; path: string }

/**
 * CommandSearch — the one search surface for pages and records.
 *
 * Flat, ordered result list with a roving tab stop: everything is reachable by
 * ArrowUp/ArrowDown and Enter, which matters because this is opened by
 * keyboard. Quick actions are shown only when the field is empty, so results
 * get the full height once typing starts.
 */
export function CommandSearch({ open, onClose }: CommandSearchProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const { data: quotations = [] } = useQuotations()
  const listRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()

  const results = useMemo<Result[]>(() => {
    const out: Result[] = []

    if (!q) {
      return QUICK_ACTIONS.map((a) => ({
        kind: 'page' as const,
        key: `quick-${a.path}`,
        label: a.label,
        path: a.path,
      }))
    }

    for (const item of NAV_ITEMS) {
      if (`${item.label} ${item.keywords}`.toLowerCase().includes(q)) {
        out.push({ kind: 'page', key: `page-${item.path}`, label: item.label, path: item.path })
      }
    }

    for (const quo of quotations) {
      const haystack = [
        quo.client_name,
        quo.quotation_title ?? '',
        ...(quo.line_items ?? []).map((li) => li.item_name),
      ]
        .join(' ')
        .toLowerCase()
      if (haystack.includes(q)) {
        out.push({
          kind: 'quotation',
          key: `quo-${quo.id}`,
          label: quo.client_name,
          sub: `${quo.quotation_title || 'Price list'} · ${quo.line_items?.length ?? 0} items`,
          path: `/quotations/${quo.id}`,
        })
      }
    }

    return out
  }, [q, quotations])

  // Keep the roving index inside the current result set.
  useEffect(() => {
    setActive(0)
  }, [q])

  // Scroll the highlighted row into view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, results.length])

  const go = useCallback(
    (path: string) => {
      onClose()
      setQuery('')
      navigate(path)
    },
    [navigate, onClose],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[active]
      if (target) go(target.path)
    }
  }

  const recent = !q && quotations.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
          setQuery('')
        }
      }}
    >
      <DialogContent size="lg" hideClose className="sm:max-w-[600px]">
        <DialogTitle className="sr-only">Search pages and quotations</DialogTitle>

      <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
        <MagnifyingGlass size={17} aria-hidden className="shrink-0 text-[var(--text-faint)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Search pages and quotations"
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `cmd-${results[active].key}` : undefined}
          placeholder="Search pages, hotels, quotations…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]"
        />
        <kbd className="hidden shrink-0 rounded-[3px] border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-faint)] sm:inline">
          Esc
        </kbd>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex size-7 shrink-0 items-center justify-center rounded-[6px] text-[var(--text-faint)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <div
        ref={listRef}
        role="listbox"
        aria-label="Search results"
        className="max-h-[min(380px,55dvh)] overflow-y-auto p-1.5"
      >
        {results.length > 0 ? (
          <>
            <p className="px-2 pt-1 pb-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-[var(--text-faint)] uppercase">
              {q
                ? `${results.length} result${results.length === 1 ? '' : 's'}`
                : 'Quick actions'}
            </p>
            {results.map((r, i) => {
              const isActive = i === active
              return (
                <div
                  key={r.key}
                  id={`cmd-${r.key}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.path)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-2',
                    isActive && 'bg-[var(--surface-hover)]',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-[6px] border text-[11.5px] font-semibold',
                      isActive
                        ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)]',
                    )}
                  >
                    {r.kind === 'page' && !q ? (
                      <QuickActionIcon path={r.path} />
                    ) : (
                      r.label.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                      {r.label}
                    </span>
                    {r.kind === 'quotation' && (
                      <span className="block truncate text-[11.5px] text-[var(--text-muted)]">
                        {r.sub}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className={cn(
                      'shrink-0 transition-opacity',
                      isActive ? 'text-[var(--text-tertiary)]' : 'text-transparent',
                    )}
                  />
                </div>
              )
            })}

            {/* Recent quotations only when the field is empty, below the actions. */}
            {recent && (
              <>
                <p className="px-2 pt-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.05em] text-[var(--text-faint)] uppercase">
                  Recent quotations
                </p>
                {quotations.slice(0, 4).map((quo) => (
                  <div
                    key={`recent-${quo.id}`}
                    role="option"
                    aria-selected={false}
                    tabIndex={-1}
                    onClick={() => go(`/quotations/${quo.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-2 hover:bg-[var(--surface-hover)]"
                  >
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] text-[11.5px] font-semibold text-[var(--text-muted)]"
                    >
                      {quo.client_name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {quo.client_name}
                      </span>
                      <span className="block truncate text-[11.5px] text-[var(--text-muted)]">
                        {quo.quotation_title || 'Price list'}
                      </span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </>
        ) : q ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              No matches for “{query}”
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Try a hotel name, item name, or a page like “bills”.
            </p>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">No quotations yet</p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Create a quotation to search it here.
            </p>
          </div>
        )}
      </div>
      </DialogContent>
    </Dialog>
  )
}
