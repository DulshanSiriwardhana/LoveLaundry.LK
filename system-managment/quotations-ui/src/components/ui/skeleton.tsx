import { cn } from '../../lib/utils'

/**
 * Skeleton — placeholder for content that is still loading.
 *
 * Sized by the shape it replaces (a row is short, a panel is tall) so the
 * layout does not jump when data lands. The sweep is slow and one-directional,
 * because a fast or looping shimmer reads as "something is wrong".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-[6px] bg-[var(--skeleton-from)]', className)}
    />
  )
}

/** A ledger-shaped placeholder: header rules plus body rows. */
export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)]" aria-busy="true" aria-live="polite">
      <div className="flex gap-4 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-[var(--border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-2.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[30%]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A panel-shaped placeholder matching the standard panel header + body. */
export function SkeletonPanel({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-[10px] border border-[var(--border)] p-4', className)} aria-busy="true">
      <Skeleton className="h-3.5 w-40" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>
  )
}
