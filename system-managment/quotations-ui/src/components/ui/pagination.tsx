import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PaginationProps {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
  className?: string
  /** Noun for the range summary, e.g. "bills". */
  itemLabel?: string
}

/**
 * Pagination — offset-based, matching the API contract.
 *
 * The count is stated in words as well as numbers ("1–25 of 148 bills") so the
 * operator always knows the size of the set they are paging through, and the
 * current page is rendered in the brand colour rather than an arbitrary accent.
 * On mobile the numbered pages collapse to Prev/Page x of y/Next, because a
 * five-button cluster plus a count does not fit a 320px screen.
 */
export function Pagination({ total, limit, offset, onChange, className, itemLabel }: PaginationProps) {
  if (total <= 0) return null

  const limitSafe = Math.max(1, limit)
  const currentPage = Math.floor(offset / limitSafe) + 1
  const totalPages = Math.max(1, Math.ceil(total / limitSafe))
  const start = offset + 1
  const end = Math.min(offset + limitSafe, total)

  const pages = pageWindow(currentPage, totalPages)

  const summary = (
    <p className="text-[12.5px] text-[var(--text-muted)]">
      <span className="tabular-nums">
        {start.toLocaleString()}–{end.toLocaleString()}
      </span>{' '}
      of <span className="font-medium text-[var(--text-secondary)] tabular-nums">{total.toLocaleString()}</span>
      {itemLabel ? ` ${itemLabel}` : ''}
    </p>
  )

  const navBtn =
    'inline-flex h-8 items-center justify-center gap-1 rounded-[6px] border px-2 text-[12.5px] font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-40'

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2', className)}
    >
      {/* Range summary — full text on desktop, page counter on mobile. */}
      <div className="order-2 min-w-0 sm:order-1">
        <span className="hidden sm:inline">{summary}</span>
        <span className="text-[12.5px] text-[var(--text-muted)] sm:hidden">
          Page <span className="font-medium text-[var(--text-secondary)] tabular-nums">{currentPage}</span> of{' '}
          <span className="font-medium text-[var(--text-secondary)] tabular-nums">{totalPages}</span>
        </span>
      </div>

      <div className="order-1 flex items-center gap-1 sm:order-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, offset - limitSafe))}
          disabled={currentPage === 1}
          className={cn(
            navBtn,
            'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <ol className="hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === 'gap' ? (
              <li key={`gap-${i}`} className="px-1 text-[12.5px] text-[var(--text-faint)]" aria-hidden>
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onChange((p - 1) * limitSafe)}
                  aria-current={p === currentPage ? 'page' : undefined}
                  aria-label={`Page ${p}`}
                  className={cn(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-[6px] border px-2 text-[12.5px] font-medium tabular-nums transition-colors duration-100',
                    p === currentPage
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
                      : 'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                  )}
                >
                  {p}
                </button>
              </li>
            ),
          )}
        </ol>

        <button
          type="button"
          onClick={() => onChange(Math.min((totalPages - 1) * limitSafe, offset + limitSafe))}
          disabled={currentPage === totalPages}
          className={cn(
            navBtn,
            'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
          )}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}

/** 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const out: Array<number | 'gap'> = [1]
  const from = Math.max(2, current - 1)
  const to = Math.min(total - 1, current + 1)

  if (from > 2) out.push('gap')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < total - 1) out.push('gap')
  out.push(total)

  return out
}
