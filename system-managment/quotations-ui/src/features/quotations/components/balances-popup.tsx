import { useState } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { ClientWiseEntry } from '../hooks/useBusinessDashboard'
import type { OutstandingAging } from '../services/dashboard.service'
import { Avatar } from '../../../components/ui/avatar'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { Input } from '../../../components/ui/input'

interface BalancesPopupProps {
  open: boolean
  onClose: () => void
  clients: ClientWiseEntry[]
  aging: OutstandingAging
  totalOutstanding: number
  totalRevenue: number
  totalCollected: number
}

type SortKey = 'outstanding' | 'name'

const AGING_BUCKETS: { key: keyof OutstandingAging; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: '30_day', label: '1–30 d' },
  { key: '60_day', label: '31–60 d' },
  { key: '90_day', label: '61–90 d' },
  { key: 'over_90', label: '90+ d' },
]

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function lkr(n: number) {
  return n.toLocaleString('en', { maximumFractionDigits: 0 })
}

/**
 * BalancesPopup — the receivables ledger behind the dashboard's outstanding
 * total. Each client expands into its gate passes, so a single unpaid client
 * can be traced to the delivery that caused it without leaving the dialog.
 */
export function BalancesPopup({
  open,
  onClose,
  clients,
  aging,
  totalOutstanding,
}: BalancesPopupProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sortBy, setSortBy] = useState<SortKey>('outstanding')

  const query = search.trim().toLowerCase()
  const outstandingClients = clients
    .filter((c) => c.outstanding > 0)
    .filter((c) => !query || c.client_name.toLowerCase().includes(query))

  const sorted = [...outstandingClients].sort((a, b) =>
    sortBy === 'outstanding' ? b.outstanding - a.outstanding : a.client_name.localeCompare(b.client_name),
  )

  const agingTotal =
    aging.current + aging['30_day'] + aging['60_day'] + aging['90_day'] + aging.over_90

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="max-h-[92dvh]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle>Outstanding balances</DialogTitle>
            <DialogDescription>
              {outstandingClients.length} client{outstandingClients.length !== 1 ? 's' : ''} with pending
              payments, broken down by gate pass.
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4 p-0 sm:p-0">
          {/* ── Totals ────────────────────────────────────────────────────── */}
          <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:px-5">
            <p className="section-label">Total outstanding</p>
            <p className="mt-1 text-[26px] font-bold leading-none tabular-nums tracking-tight sm:text-[30px]">
              <span className="mr-1.5 text-[14px] font-semibold text-[var(--text-muted)]">LKR</span>
              {lkr(totalOutstanding)}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-5">
              {AGING_BUCKETS.map((b) => {
                const value = aging[b.key] as number
                const pct = agingTotal > 0 ? (value / agingTotal) * 100 : 0
                return (
                  <div key={b.label} className="bg-[var(--surface)] px-2.5 py-2">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {b.label}
                    </dt>
                    <dd className="mt-0.5 text-[12.5px] font-semibold tabular-nums">
                      LKR {lkr(value)}
                      <span className="ml-1 font-normal text-[var(--text-faint)]">
                        {pct.toFixed(0)}%
                      </span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>

          {/* ── Search & sort ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients…"
              aria-label="Search clients"
              className="min-w-[180px] flex-1"
              startAdornment={<Search aria-hidden />}
            />
            <div
              role="group"
              aria-label="Sort clients"
              className="flex gap-0.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
            >
              {(
                [
                  { key: 'outstanding' as const, label: 'Amount' },
                  { key: 'name' as const, label: 'Name' },
                ]
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSortBy(s.key)}
                  aria-pressed={sortBy === s.key}
                  className={`rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors duration-100 ${
                    sortBy === s.key
                      ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-[0_1px_2px_rgb(16_24_40/0.06)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Client ledger ─────────────────────────────────────────────── */}
          {sorted.length === 0 ? (
            <EmptyState
              title={query ? 'No matching clients' : 'Nothing outstanding'}
              description={
                query
                  ? `No client name matches “${search.trim()}”.`
                  : 'Every client is settled up for this period.'
              }
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {sorted.map((client) => {
                const isOpen = Boolean(expanded[client.client_name])
                const detailId = `balances-${client.client_name}`

                return (
                  <li key={client.client_name}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={detailId}
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [client.client_name]: !prev[client.client_name],
                        }))
                      }
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-hover)] sm:px-5"
                    >
                      <ChevronDown
                        aria-hidden
                        className={`size-4 shrink-0 text-[var(--text-faint)] transition-transform duration-150 ${
                          isOpen ? '' : '-rotate-90'
                        }`}
                      />
                      <Avatar name={client.client_name} size="lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{client.client_name}</span>
                        <span className="block text-[11.5px] text-[var(--text-muted)] tabular-nums">
                          {client.gate_pass_count} gate pass{client.gate_pass_count !== 1 ? 'es' : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold tabular-nums">
                          LKR {lkr(client.outstanding)}
                        </span>
                        {client.total_billed > 0 && (
                          <span className="block text-[11px] text-[var(--text-muted)] tabular-nums">
                            {((client.outstanding / client.total_billed) * 100).toFixed(0)}% of billed
                          </span>
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      <div id={detailId} className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:px-5">
                        <dl className="mb-3 grid grid-cols-3 gap-px overflow-hidden rounded-[6px] border border-[var(--border)] bg-[var(--border)]">
                          {[
                            { label: 'Billed', value: client.total_billed },
                            { label: 'Paid', value: client.paid_amount },
                            { label: 'Outstanding', value: client.outstanding },
                          ].map((m) => (
                            <div key={m.label} className="bg-[var(--surface)] px-2.5 py-2">
                              <dt className="section-label">{m.label}</dt>
                              <dd
                                className={`mt-0.5 text-[13px] font-semibold tabular-nums ${
                                  m.label === 'Outstanding' ? 'text-[var(--warning-text)]' : ''
                                }`}
                              >
                                LKR {lkr(m.value)}
                              </dd>
                            </div>
                          ))}
                        </dl>

                        {client.gate_passes && client.gate_passes.length > 0 && (
                          <div className="mb-3">
                            <p className="section-label mb-1.5">Gate passes</p>
                            <ul className="space-y-1.5">
                              {client.gate_passes.map((gp) => (
                                <li
                                  key={gp.gate_pass_number}
                                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-[family-name:var(--font-mono)] text-[12px] font-semibold">
                                      #{gp.gate_pass_number}
                                    </span>
                                    <span aria-hidden className="text-[var(--text-faint)]">
                                      ·
                                    </span>
                                    <span className="text-[11.5px] text-[var(--text-muted)] tabular-nums">
                                      {formatDate(gp.receiving_date)}
                                    </span>
                                  </div>
                                  <ul className="mt-1.5 flex flex-wrap gap-1">
                                    {gp.items.map((item) => (
                                      <li
                                        key={`${item.item_name}-${item.specification}`}
                                        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--border-2)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px]"
                                      >
                                        <span className="font-medium">{item.item_name}</span>
                                        {item.specification && (
                                          <Badge size="xs" tone="neutral">
                                            {item.specification}
                                          </Badge>
                                        )}
                                        <span className="text-[var(--text-muted)] tabular-nums">
                                          ×{item.received}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {client.items && client.items.length > 0 && (
                          <div>
                            <p className="section-label mb-1.5">Pending items</p>
                            <ul className="divide-y divide-[var(--border)] rounded-[6px] border border-[var(--border)] bg-[var(--surface)]">
                              {client.items.map((item) => (
                                <li
                                  key={`${item.item_name}-${item.specification}`}
                                  className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                                >
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[12.5px] font-medium">
                                      {item.item_name}
                                    </span>
                                    {item.specification && (
                                      <Badge size="xs" tone="neutral">
                                        {item.specification}
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-3">
                                    <span className="text-[11.5px] text-[var(--text-muted)] tabular-nums">
                                      {item.delivered}/{item.received} sent
                                    </span>
                                    <span className="w-10 text-right text-[12.5px] font-semibold tabular-nums text-[var(--warning-text)]">
                                      {item.pending}
                                    </span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </DialogBody>

        <DialogFooter className="items-center justify-between sm:justify-between">
          <p className="text-[12px] text-[var(--text-muted)] tabular-nums">
            {sorted.length} client{sorted.length !== 1 ? 's' : ''} · LKR {lkr(totalOutstanding)}
          </p>
          <DialogClose asChild>
            <Button variant="secondary" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
