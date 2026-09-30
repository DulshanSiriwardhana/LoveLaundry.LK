import { cn } from '../../lib/utils'

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'accent'

interface BadgeProps {
  children: React.ReactNode
  className?: string
  tone?: BadgeTone
  /** Pre-rename prop name. */
  variant?: BadgeTone | 'default' | 'secondary'
  /** Small filled dot — lets a status be recognised without reading the word. */
  dot?: boolean
  /** Monospace, for reference numbers rather than states. */
  mono?: boolean
  /** `xs` inside table cells and dense lists, `sm` for standalone chips. */
  size?: 'xs' | 'sm'
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-tertiary)]',
  brand: 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)]',
  success: 'border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success-text)]',
  warning: 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-text)]',
  danger: 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-text)]',
  info: 'border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info-text)]',
  accent: 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]',
}

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--text-faint)]',
  brand: 'bg-[var(--brand)]',
  success: 'bg-[var(--success-text)]',
  warning: 'bg-[var(--warning-text)]',
  danger: 'bg-[var(--danger-text)]',
  info: 'bg-[var(--info-text)]',
  accent: 'bg-[var(--accent-text)]',
}

/** Pre-rename names mapped onto the current tones. */
const ALIASES: Record<string, BadgeTone> = {
  default: 'brand',
  secondary: 'neutral',
  // `purple` predates the accent token family and is still passed by callers
  // that were never renamed.
  purple: 'accent',
}

/**
 * Badge — a status or a short qualifier. Deliberately squared (4px) and quiet:
 * pills read as decoration, rectangles read as data. Use `dot` when the badge
 * is a state, and no dot when it is a category.
 */
export function Badge({
  children,
  className,
  tone,
  variant,
  dot,
  mono,
  size = 'sm',
  ...rest
}: BadgeProps & Record<string, unknown>) {
  const resolved = (tone ?? (variant ? ALIASES[variant] ?? (variant as BadgeTone) : 'neutral')) as BadgeTone
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-sm border whitespace-nowrap',
        size === 'xs'
          ? 'gap-1 px-1.5 py-px text-[10.5px] leading-[1.5]'
          : 'gap-1.5 px-1.5 py-0.5 text-[11.5px] leading-[1.45]',
        mono && 'font-[family-name:var(--font-mono)] text-[11px] tabular-nums',
        TONE[resolved],
        className,
      )}
      {...rest}
    >
      {dot && <span aria-hidden className={cn('status-dot', DOT[resolved])} />}
      <span className="truncate">{children}</span>
    </span>
  )
}
