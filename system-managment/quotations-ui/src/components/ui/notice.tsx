import { cn } from '../../lib/utils'
import { CheckCircle, Warning, Info, XCircle } from '@phosphor-icons/react'

export type NoticeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface NoticeProps {
  tone?: NoticeTone
  title?: React.ReactNode
  children: React.ReactNode
  icon?: React.ReactNode
  className?: string
  /** Right-aligned action, e.g. "Fix this" or "Reopen". */
  action?: React.ReactNode
  /** Renders flat against the panel body instead of as its own inset box. */
  flush?: boolean
}

const TONE: Record<NoticeTone, string> = {
  success: 'border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-text)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-text)]',
  danger: 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-text)]',
  info: 'border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info-text)]',
  neutral: 'border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-secondary)]',
}

const TONE_ICON: Record<NoticeTone, any> = {
  success: CheckCircle,
  warning: Warning,
  danger: XCircle,
  info: Info,
  neutral: Info,
}

/**
 * Notice — an inline, in-flow message inside a panel or a form.
 *
 * Distinct from an alert: a notice is part of the page and does not steal
 * focus. It is used for state that explains itself ("all clear", "3 items still
 * open", "this is a future day"), which is the majority of the coloured boxes
 * this application used to scatter around.
 */
export function Notice({
  tone = 'neutral',
  title,
  children,
  icon,
  className,
  action,
  flush = false,
}: NoticeProps) {
  const Icon = TONE_ICON[tone]

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-[1.5]',
        !flush && 'bg-[var(--surface)]',
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden className="mt-px shrink-0">
        {icon ?? <Icon size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'text-[inherit] opacity-90')}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
