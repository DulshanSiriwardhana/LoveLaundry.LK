import { cn } from '../../lib/utils'

const CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  PAID: { label: 'Paid', cls: 'bg-[var(--success-soft)] text-[var(--success-text)] border-[var(--success-border)]', dot: 'var(--success-text)' },
  PARTIALLY_PAID: { label: 'Partial', cls: 'bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning-border)]', dot: 'var(--warning-text)' },
  PENDING: { label: 'Pending', cls: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger-border)]', dot: 'var(--danger-text)' },
  ISSUED: { label: 'Issued', cls: 'bg-[var(--brand-soft)] text-[var(--brand-text)] border-[var(--brand-border)]', dot: 'var(--warning-text)' },
  DRAFT: { label: 'Draft', cls: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]', dot: 'var(--text-faint)' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-[var(--surface-3)] text-[var(--text-tertiary)] border-[var(--border)]', dot: 'var(--text-tertiary)' },
}

/**
 * Standardized payment-status indicator so paid / partially-paid / unpaid
 * bills are identifiable at a glance everywhere (list, detail, reports).
 */
export function BillStatusBadge({
  status,
  showDot = true,
  className,
}: {
  status?: string | null
  showDot?: boolean
  className?: string
}) {
  if (!status) return null
  const cfg = CONFIG[status] ?? { label: status, cls: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]', dot: 'var(--text-faint)' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        cfg.cls,
        className,
      )}
    >
      {showDot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: cfg.dot }}
        />
      )}
      {cfg.label}
    </span>
  )
}

export const BILL_PAYMENT_STATUSES = ['PAID', 'PARTIALLY_PAID', 'PENDING', 'ISSUED', 'DRAFT', 'CANCELLED'] as const

export const BILL_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIALLY_PAID', label: 'Partial' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const
