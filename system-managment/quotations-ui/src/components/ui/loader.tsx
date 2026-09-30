import { cn } from '../../lib/utils'
import { LoadingSpinner } from './loading-spinner'
import { Skeleton } from './skeleton'

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  subtext?: string
  fullScreen?: boolean
  className?: string
}

/**
 * Loader — token-driven loading placeholder.
 *
 * All variants render on the current theme (light, dark, contrast) instead of
 * the hard-coded palette the original component shipped with. `fullScreen`
 * only applies in-page-centred layout; it never tints or covers the shell.
 */
export function Loader({ size = 'md', text = 'Loading...', subtext, fullScreen = false, className = '' }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-2.5',
        fullScreen ? 'min-h-[50vh]' : 'py-5',
        className,
      )}
    >
      <span aria-hidden className={cn(size === 'sm' && 'scale-75', size === 'lg' && 'scale-125')}>
        <LoadingSpinner size="md" />
      </span>
      {text && <p className="text-[13px] font-medium text-[var(--text)]">{text}</p>}
      {subtext && <p className="text-[12px] text-[var(--text-muted)]">{subtext}</p>}
      <span className="sr-only">{text ?? 'Loading'}</span>
    </div>
  )
}

/** SkeletonLoader — kept for API compatibility; thin wrapper over Skeleton. */
export function SkeletonLoader({ count = 5, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}

export function PageLoader({ text = 'Loading page...', subtext }: { text?: string; subtext?: string }) {
  return <Loader size="lg" text={text} subtext={subtext} fullScreen />
}

export function DataLoader({ text = 'Loading data...' }: { text?: string }) {
  return <Loader size="md" text={text} fullScreen />
}

export function ButtonLoader({ text = 'Processing...' }: { text?: string }) {
  return <Loader size="sm" text={text} />
}