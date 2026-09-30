import { cn } from '../../lib/utils'
import { Card } from './card'
import { Button } from './button'
import { AlertCircle, Inbox, LockKeyhole, SearchX, WifiOff } from 'lucide-react'

type EmptyKind = 'default' | 'search' | 'first-run' | 'permission' | 'offline'

const KIND_ICON = {
  default: Inbox,
  search: SearchX,
  'first-run': Inbox,
  permission: LockKeyhole,
  offline: WifiOff,
} as const

const KIND_TITLE: Record<EmptyKind, string> = {
  default: 'Nothing here yet',
  search: 'No matches',
  'first-run': 'Nothing to show yet',
  permission: 'Not available to your role',
  offline: 'You are offline',
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
  /** Chooses the default icon and headline for the reason data is missing. */
  kind?: EmptyKind
  className?: string
  /** Drops the surrounding panel — use when already inside a panel body. */
  bare?: boolean
}

/**
 * EmptyState — says what is missing and what to do about it.
 *
 * A quiet hairline panel rather than a dashed void with a decorative glyph: an
 * empty table is information, not an error. Icons are 18px, never hero-sized.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  kind = 'default',
  className,
  bare = false,
}: EmptyStateProps) {
  const Icon = KIND_ICON[kind]
  const Wrapper: any = bare ? 'div' : Card

  return (
    <Wrapper
      className={cn(
        'flex flex-col items-center justify-center px-6 py-10 text-center',
        !bare && 'rounded-[10px] border border-dashed border-[var(--border-2)] bg-[var(--surface-2)]',
        className,
      )}
    >
      <div className="mb-2.5 flex size-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-faint)]">
        {icon ?? <Icon className="size-[18px]" aria-hidden />}
      </div>
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
        {title ?? KIND_TITLE[kind]}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-[12.5px] leading-[1.55] text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </Wrapper>
  )
}

interface TableEmptyRowProps {
  colSpan: number
  title?: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

/**
 * TableEmptyRow — the in-table form of <EmptyState>.
 *
 * Real <table> markup cannot host a block panel inside a cell, so the same
 * visual language is rendered into a single full-width row. Use this instead of
 * an ad-hoc `<td className="py-8 text-center text-gray-400">No rows</td>` so
 * every table in the system empties the same way.
 */
export function TableEmptyRow({
  colSpan,
  title = 'Nothing to show yet',
  description,
  icon,
  className,
}: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn('px-4 py-10 text-center', className)}>
        <div className="flex flex-col items-center justify-center">
          <div className="mb-2.5 flex size-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-faint)]">
            {icon ?? <Inbox className="size-[18px]" aria-hidden />}
          </div>
          <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</p>
          {description && (
            <p className="mt-1 max-w-sm text-[12.5px] leading-[1.55] text-[var(--text-muted)]">
              {description}
            </p>
          )}
        </div>
      </td>
    </tr>
  )
}

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  /** Secondary action, e.g. "Go to dashboard". */
  action?: React.ReactNode
}

/**
 * ErrorState — says what failed, what it means, and offers the way out.
 * Deliberately not a full-bleed red block: an error inside a panel should not
 * shout louder than the data it replaced.
 */
export function ErrorState({
  title = 'Could not load this data',
  description = 'The request did not complete. Check the connection and try again.',
  onRetry,
  retryLabel = 'Try again',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-[10px] border border-[var(--danger-border)] bg-[var(--danger-soft)] px-6 py-8 text-center',
        className,
      )}
    >
      <div className="mb-2.5 flex size-9 items-center justify-center rounded-[8px] border border-[var(--danger-border)] bg-[var(--surface)] text-[var(--danger-text)]">
        <AlertCircle className="size-[18px]" aria-hidden />
      </div>
      <p className="text-[13.5px] font-semibold text-[var(--danger-text)]">{title}</p>
      <p className="mt-1 max-w-sm text-[12.5px] leading-[1.55] text-[var(--text-tertiary)]">
        {description}
      </p>
      {(onRetry || action) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </div>
  )
}
