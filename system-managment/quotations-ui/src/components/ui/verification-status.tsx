import { cn } from '../../lib/utils'

export type VerificationStatusValue = 'VERIFIED' | 'SYNCING' | 'PENDING' | 'FAILED'

interface VerificationStatusProps {
  status?: VerificationStatusValue | string
  className?: string
  showLabel?: boolean
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  VERIFIED: {
    label: 'Verified',
    icon: '✓',
    className: 'bg-[var(--success-soft)] text-[var(--success-text)] border-[var(--success-border)]',
  },
  SYNCING: {
    label: 'Syncing',
    icon: '⏳',
    className: 'bg-[var(--info-soft)] text-[var(--info-text)] border-[var(--info-border)]',
  },
  PENDING: {
    label: 'Pending',
    icon: '⏳',
    className: 'bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning-border)]',
  },
  FAILED: {
    label: 'Sync Failed',
    icon: '⚠',
    className: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger-border)]',
  },
}

export function VerificationStatus({ status, className, showLabel = true }: VerificationStatusProps) {
  const key = (status || 'PENDING').toUpperCase()
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.PENDING

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        config.className,
        className
      )}
      title={`${config.label} — Main/Secondary sync state`}
    >
      <span aria-hidden>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}