import { useEffect, useState } from 'react'
import { FileText, Storefront, X, Phone } from '@phosphor-icons/react'
import api from '../../../api/api'
import type { Quotation } from '../../../types/quotation'
import { Logo } from '../../../components/brand/logo'
import { Button } from '../../../components/ui/button'
import { Badge, type BadgeTone } from '../../../components/ui/badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../../components/ui/dialog'

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  archived: 'neutral',
}

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(dateString),
  )

const lkr = (n: number) => `LKR ${n.toLocaleString('en-LK', { maximumFractionDigits: 2 })}`

const total = (items: any[]) => items.reduce((sum, i) => sum + (i.unit_price || 0), 0)

/**
 * GuestQuotationsPage — the public, unauthenticated price list.
 *
 * This is the shop's shopfront, so it carries no application chrome: a plain
 * masthead, the price list, and a footer with the legal registration number. No
 * sidebar, no scope selector, no sign-in prompt inside the content.
 *
 * The list is a real table on desktop — a price list is tabular data, and
 * comparing per-item prices is the whole point. On mobile it becomes labelled
 * rows rather than a horizontally scrolling table.
 */
export default function GuestQuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Quotation | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const response = await api.get('/quotations/guest/shop')
        if (!cancelled) {
          setQuotations(response.data ?? [])
          setError(null)
        }
      } catch {
        if (!cancelled) setError('Could not load the price list. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" tagline="Shop services" />
          <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-[var(--border-2)] bg-[var(--surface-2)] px-2 py-1 text-[11px] font-medium text-[var(--text-muted)]">
            <Storefront size={13} aria-hidden />
            Public price list
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[var(--text-faint)] uppercase">
            Love Laundry · Reg. No. 40-3064
          </p>
          <h1 className="mt-1 text-[19px] font-semibold tracking-[-0.018em] text-[var(--text-primary)] sm:text-[21px]">
            Shop services and pricing
          </h1>
          <p className="mt-1 max-w-prose text-[13px] text-[var(--text-muted)]">
            Prices below are indicative. Final cost depends on fabric, quantity and turnaround —
            contact us to confirm a booking.
          </p>
        </div>

        {loading ? (
          <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Price list unavailable"
            description={error}
            action={
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Try again
              </Button>
            }
          />
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="No services listed yet"
            description="The price list has not been published. Please check back shortly."
          />
        ) : (
          <>
            {/* Desktop: price list as a table */}
            <div className="hidden overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] sm:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                      Package
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                      Updated
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                      Items
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                      Estimate
                    </th>
                    <th className="w-24 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {quotations.map((q) => (
                    <tr
                      key={q.id}
                      className="cursor-pointer transition-colors duration-100 hover:bg-[var(--surface-hover)]"
                      onClick={() => setSelected(q)}
                    >
                      <td className="px-4 py-3">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {q.quotation_title || 'Service package'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge size="xs" tone={STATUS_TONE[q.status ?? 'draft'] ?? 'neutral'}>
                            {q.status || 'draft'}
                          </Badge>
                          <span className="text-[11.5px] text-[var(--text-faint)]">
                            {q.client_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] whitespace-nowrap text-[var(--text-tertiary)]">
                        {q.created_at ? formatDate(q.created_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-[var(--text-tertiary)]">
                        {q.line_items?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-[var(--text-primary)] whitespace-nowrap">
                        {lkr(total(q.line_items ?? []))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(q)
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: labelled rows, no horizontal scroll */}
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] sm:hidden">
              {quotations.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(q)}
                    className="w-full cursor-pointer px-4 py-3 text-left transition-colors duration-100 active:bg-[var(--surface-hover)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {q.quotation_title || 'Service package'}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge size="xs" tone={STATUS_TONE[q.status ?? 'draft'] ?? 'neutral'}>
                            {q.status || 'draft'}
                          </Badge>
                          {q.created_at && (
                            <span className="text-[11.5px] text-[var(--text-faint)]">
                              {formatDate(q.created_at)}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] text-[var(--text-faint)]">
                          {q.line_items?.length ?? 0} items
                        </span>
                        <span className="mt-0.5 block text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                          {lkr(total(q.line_items ?? []))}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <footer className="mt-10 border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <p className="text-[12px] text-[var(--text-muted)]">
            © 2026 Love Laundry · Reg. No. 40-3064
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--text-faint)]">
            Laundry and linen services for hotels, hospitals and institutions.
          </p>
        </div>
      </footer>

      <Dialog
        open={!!selected}
        onOpenChange={(next) => !next && setSelected(null)}
      >
        <DialogContent size="md">
          <DialogHeader>
            <div className="min-w-0">
              <DialogTitle>{selected?.quotation_title || 'Service package'}</DialogTitle>
              <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-muted)]">
                {selected?.client_name}
              </p>
            </div>
          </DialogHeader>

          <DialogBody>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                    Item
                  </th>
                  <th className="pb-2 text-right text-[11px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                    Unit price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {(selected?.line_items ?? []).map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-3 align-top">
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">
                        {item.item_name}
                      </p>
                      {item.category && (
                        <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                          {item.category}
                        </p>
                      )}
                      {item.notes && (
                        <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)] italic">
                          {item.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-[13px] font-medium tabular-nums whitespace-nowrap text-[var(--text-primary)]">
                      {lkr(item.unit_price || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)]">
                  <th className="pt-2.5 text-left text-[13px] font-semibold text-[var(--text-primary)]">
                    Estimated total
                  </th>
                  <td className="pt-2.5 text-right text-[15px] font-semibold tabular-nums whitespace-nowrap text-[var(--text-primary)]">
                    {lkr(total(selected?.line_items ?? []))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </DialogBody>

          <DialogFooter className="flex-col items-start sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-1.5 text-[11.5px] text-[var(--text-muted)]">
              <Phone size={13} aria-hidden className="mt-px shrink-0" />
              <span>
                To confirm a booking, call{' '}
                <span className="font-medium text-[var(--text-tertiary)]">+94 XX XXX XXXX</span>.
              </span>
            </p>
            <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
              <X size={15} aria-hidden />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
