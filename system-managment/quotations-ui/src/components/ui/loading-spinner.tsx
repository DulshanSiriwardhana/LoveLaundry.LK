import { cn } from '../../lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const SIZE = { sm: 'size-4 border-2', md: 'size-6 border-2', lg: 'size-8 border-2' } as const

/**
 * LoadingSpinner — reserved for whole-view loads. Inside a region, use a
 * skeleton so the surrounding layout stays put.
 */
export function LoadingSpinner({ size = 'md', label, className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-2.5 py-8', className)}
    >
      <span
        aria-hidden
        className={cn(
          'animate-spin rounded-full border-[var(--border-2)] border-t-[var(--brand)]',
          SIZE[size],
        )}
      />
      {label && <p className="text-[12.5px] text-[var(--text-muted)]">{label}</p>}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  )
}
