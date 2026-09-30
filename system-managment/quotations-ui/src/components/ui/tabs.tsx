import * as React from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  count?: number
  disabled?: boolean
}

/**
 * Tabs — a view switch within one page, never navigation between pages.
 * Implemented as a proper ARIA tablist with arrow-key roving focus, and
 * horizontally scrollable on narrow screens instead of wrapping into a
 * confusing second row.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  className,
  'aria-label': ariaLabel = 'Views',
}: {
  items: TabItem[]
  value: string
  onValueChange: (v: string) => void
  className?: string
  'aria-label'?: string
}) {
  const listRef = React.useRef<HTMLDivElement>(null)

  const enabled = items.filter((i) => !i.disabled)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const idx = enabled.findIndex((i) => i.value === value)
    if (idx === -1) return
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length
    if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = enabled.length - 1
    const target = enabled[next]
    onValueChange(target.value)
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(target.value)}"]`)
      ?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        'scroll-fade -mb-px flex gap-0.5 overflow-x-auto border-b border-[var(--border)]',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-value={item.value}
            aria-selected={active}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium whitespace-nowrap',
              'transition-colors duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset',
              item.disabled && 'cursor-not-allowed opacity-45',
              active
                ? 'border-[var(--brand)] text-[var(--brand-text)]'
                : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-2)] hover:text-[var(--text-primary)]',
            )}
          >
            {item.icon && <span className="[&_svg]:size-4">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-[3px] px-1 text-[11px] font-semibold tabular-nums',
                  active
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                    : 'bg-[var(--surface-3)] text-[var(--text-muted)]',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
