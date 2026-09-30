import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Input } from './input'

/**
 * Toolbar — the single row above a data set: scope/search on the left, filters
 * in the middle, page actions on the right. Below `sm` the three groups stack
 * and the actions take the full width, so a phone user gets one control per
 * row instead of a squeezed, overlapping cluster.
 */
export function Toolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function ToolbarGroup({
  children,
  className,
  align = 'start',
}: {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2',
        align === 'end' ? 'sm:ml-auto sm:justify-end' : '',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * SearchInput — a search field that reads as a field, not a button: the icon
 * sits inside the control, the clear affordance only appears once there is
 * text, and Escape clears. `inputRef` is exposed so pages can drive it from a
 * keyboard shortcut.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder = 'Search…',
  className,
  inputRef,
  onKeyDown,
  ...rest
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  className?: string
  inputRef?: React.Ref<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className={cn('relative min-w-0 flex-1 sm:max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--text-faint)]"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation()
            onValueChange('')
          }
          onKeyDown?.(e)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        hasPrefix
        hasSuffix={Boolean(value)}
        className="[&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
