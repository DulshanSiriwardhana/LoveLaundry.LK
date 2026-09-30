import { cn } from '../../lib/utils'

interface FilterBarProps {
  children: React.ReactNode
  className?: string
}

/**
 * FilterBar — a row of mutually-exclusive filters.
 * Scrolls horizontally below `sm` instead of wrapping, so the row height stays
 * predictable and the row of chips never doubles in height mid-list.
 */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label="Filters"
      className={cn(
        'scroll-fade -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible',
        className,
      )}
    >
      {children}
    </div>
  )
}

export { FilterChip } from './filter-chip'
