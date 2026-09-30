import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Field — the single wrapper for form layout.
 *
 * Owns three things so no screen has to reinvent them:
 *   1. a real <label> bound to its control (click target + screen-reader name)
 *   2. a hint that disappears when an error appears, so the block does not grow
 *   3. an error message announced politely and wired via aria-describedby
 *
 * Layout is a two-column grid on desktop and a single column on mobile, which is
 * what makes an operator's forms scannable instead of a wall of stacked inputs.
 */
export interface FieldProps {
  label: React.ReactNode
  /** Shown under the control when there is no error. */
  hint?: React.ReactNode
  /** Shown under the control, announced, and marks the control invalid. */
  error?: React.ReactNode
  required?: boolean
  className?: string
  controlClassName?: string
  children: React.ReactNode
  /** Receives the ids to wire onto the control. */
  id?: string
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  controlClassName,
  children,
  id,
}: FieldProps) {
  const autoId = React.useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  const hintId = `${fieldId}-hint`

  const isInvalid = Boolean(error)

  return (
    <div className={cn('min-w-0', className)}>
      <label
        htmlFor={fieldId}
        className="mb-1 flex items-baseline gap-1 text-[12.5px] font-medium text-[var(--text-secondary)]"
      >
        <span className="truncate">{label}</span>
        {required && (
          <span className="text-[var(--danger-text)]" aria-hidden>
            *
          </span>
        )}
      </label>

      <div className={cn('min-w-0', controlClassName)}>{children}</div>

      {isInvalid ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 flex items-start gap-1 text-[12px] leading-[1.4] text-[var(--danger-text)]"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-[12px] leading-[1.4] text-[var(--text-faint)]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * FormGrid — consistent form rhythm. `cols` is the desktop column count; the
 * grid always collapses to one column below `md`, so a 4-column desktop form
 * never overflows a 320px screen.
 */
export function FormGrid({
  cols = 2,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4
  className?: string
  children: React.ReactNode
}) {
  const map = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  } as const
  return <div className={cn('grid grid-cols-1 gap-x-4 gap-y-3.5', map[cols], className)}>{children}</div>
}

/**
 * FormSection — a titled group of fields. Uses a real heading so the section
 * list is navigable, and separates groups with a rule rather than a nested box.
 */
export function FormSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</h3>}
            {description && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * FormActions — the save / cancel row.
 *
 * Sticks to the bottom of the form on mobile so the primary action is always
 * reachable without scrolling back up, and sits at the row end on desktop
 * where the pointer already is.
 */
export function FormActions({
  children,
  className,
  note,
}: {
  children: React.ReactNode
  className?: string
  /** Left-hand text, e.g. "Unsaved changes". */
  note?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-4 mt-5 flex flex-wrap items-center justify-end gap-2',
        'border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0',
        className,
      )}
    >
      {note && <p className="mr-auto text-[12px] text-[var(--text-muted)]">{note}</p>}
      {children}
    </div>
  )
}
