import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumb — position, not decoration. Collapses to "‹ Back" once there is
 * more than two levels, because a five-crumb trail on a 320px screen is a
 * second navigation bar that pushes the page title out of view.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length) return null

  if (items.length > 2) {
    const parent = items[items.length - 2]
    return (
      <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
        <Link
          to={parent.href ?? '#'}
          onClick={(e) => {
            if (!parent.href) e.preventDefault()
          }}
          className="inline-flex min-w-0 items-center gap-1 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ChevronRight className="size-3.5 shrink-0 rotate-180" aria-hidden />
          <span className="truncate">{parent.label}</span>
        </Link>
      </nav>
    )
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[12.5px]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight className="size-3 shrink-0 text-[var(--text-faint)]" aria-hidden />
              )}
              {item.href && !isLast ? (
                <Link
                  to={item.href}
                  className="truncate text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn(
                    'truncate',
                    isLast ? 'font-medium text-[var(--text-secondary)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
