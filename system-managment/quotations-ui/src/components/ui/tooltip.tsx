import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Tooltip — for meaning that is not obvious from the icon alone.
 *
 * CSS-driven (no JS measurement, no portal) and therefore instant. It is not
 * keyboard-focusable and never carries information that is unavailable
 * elsewhere: the trigger still needs its own `aria-label` or `title`.
 */
export function Tooltip({
  content,
  side = 'top',
  children,
  className,
}: {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
  className?: string
}) {
  if (!content) return children

  const pos: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'top-1/2 right-full -translate-y-1/2 mr-1.5',
    right: 'top-1/2 left-full -translate-y-1/2 ml-1.5',
  }

  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-[220px] rounded-[6px] px-2 py-1',
          'text-[11.5px] leading-[1.4] font-medium text-white',
          'bg-[var(--text-primary)] shadow-[var(--shadow-md)]',
          'opacity-0 transition-opacity duration-100 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          pos[side],
        )}
      >
        {content}
      </span>
    </span>
  )
}
