import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  backTo?: string
  /** Trail shown above the title. */
  breadcrumb?: BreadcrumbItem[]
  /** Small line above the title, e.g. a hotel or record reference. */
  eyebrow?: React.ReactNode
  className?: string
  /** Extra content below the title row, e.g. a filter row. */
  children?: React.ReactNode
}

/**
 * PageHeader — the consistent top of every screen.
 *
 * Three bands, in order: breadcrumb (where am I), title (what is this), and
 * actions (what can I do). Actions wrap onto their own full-width row below
 * `sm` so a phone never gets two half-width buttons fighting for the same line,
 * and the title truncates rather than pushing the actions off-screen.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  breadcrumb,
  eyebrow,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-4 min-w-0', className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumb items={breadcrumb} className="mb-1.5" />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {backTo && (
            <Link
              to={backTo}
              aria-label="Go back"
              title="Go back"
              className={cn(
                'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px]',
                'border border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-secondary)]',
                'transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
              )}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="mb-0.5 truncate text-[11.5px] font-medium tracking-[0.02em] text-[var(--text-muted)] uppercase">
                {eyebrow}
              </p>
            )}
            <h1 className="text-dashboard-title !truncate">{title}</h1>
            {subtitle && <p className="text-page-subtitle !line-clamp-2">{subtitle}</p>}
          </div>
        </div>

        {actions && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        )}
      </div>

      {children && <div className="mt-3">{children}</div>}
    </header>
  )
}
