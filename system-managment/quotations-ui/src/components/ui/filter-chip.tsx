import { cn } from '../../lib/utils'

interface FilterChipProps {
  label: string
  active?: boolean
  count?: number
  onClick?: () => void
  className?: string
  /** Marks the filter as currently applied with `aria-pressed`. */
  pressed?: boolean
}

/**
 * FilterChip — a toggle in a FilterBar.
 * Flat fill when active, outlined when not. Counts are part of the label so a
 * screen reader announces "Pending (12)" rather than two disconnected strings.
 */
export function FilterChip({ label, active, count, onClick, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2.5 py-1.5',
        'text-[12.5px] font-medium whitespace-nowrap transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1',
        active
          ? 'border-[var(--brand)] bg-[var(--brand)] text-white'
          : 'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'rounded-[3px] px-1 text-[11px] font-semibold tabular-nums',
            active ? 'bg-white/20 text-white' : 'bg-[var(--surface-3)] text-[var(--text-muted)]',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
