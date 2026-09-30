import * as React from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: number | string
  trendLabel?: string
  description?: string
  tone?: Tone
  /** Pre-rename prop; mapped onto `tone`. */
  color?: 'red' | 'green' | 'blue' | 'amber' | 'purple' | 'gray'
  className?: string
  to?: string
  onClick?: () => void
}

const LEGACY: Record<string, Tone> = {
  red: 'brand',
  green: 'success',
  blue: 'info',
  amber: 'warning',
  purple: 'info',
  gray: 'neutral',
}

const ICON_TONE: Record<Tone, string> = {
  neutral: 'text-[var(--text-faint)]',
  brand: 'text-[var(--brand-text)]',
  success: 'text-[var(--success-text)]',
  warning: 'text-[var(--warning-text)]',
  danger: 'text-[var(--danger-text)]',
  info: 'text-[var(--info-text)]',
}

/**
 * StatCard — one number, its label, and optionally its movement.
 *
 * The icon is 16px and monochrome. A 40px coloured tile next to every figure
 * is decoration that competes with the number; here the tone is reserved for
 * the trend, where it actually carries meaning.
 */
export function StatCard({
  label,
  value,
  icon,
  trend,
  trendLabel,
  description,
  tone,
  color,
  className,
  to,
  onClick,
}: StatCardProps) {
  const navigate = useNavigate()
  const resolved: Tone = tone ?? (color ? LEGACY[color] : 'neutral')
  const clickable = Boolean(to || onClick)

  const trendNum = typeof trend === 'number' ? trend : undefined
  const trendStr = typeof trend === 'string' ? trend : undefined
  const isPositive = trendNum !== undefined && trendNum > 0
  const isNegative = trendNum !== undefined && trendNum < 0
  const note = description || trendLabel

  const activate = () => {
    if (onClick) onClick()
    else if (to) navigate(to)
  }

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${label}: ${value}` : undefined}
      onClick={clickable ? activate : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                activate()
              }
            }
          : undefined
      }
      className={cn(
        'min-w-0 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3',
        clickable &&
          'card-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[11.5px] font-medium tracking-[0.01em] text-[var(--text-muted)]">
          {label}
        </p>
        {icon && (
          <span className={cn('flex size-4 shrink-0 items-center justify-center [&_svg]:size-4', ICON_TONE[resolved])}>
            {icon}
          </span>
        )}
      </div>

      <p className="mt-1 truncate text-[21px] leading-[1.15] font-semibold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
        {value}
      </p>

      {(trendNum !== undefined || trendStr || note) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {trendNum !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums',
                isPositive
                  ? 'text-[var(--success-text)]'
                  : isNegative
                    ? 'text-[var(--danger-text)]'
                    : 'text-[var(--text-faint)]',
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : isNegative ? (
                <TrendingDown className="size-3" aria-hidden />
              ) : null}
              {isPositive ? '+' : ''}
              {trendNum.toFixed(1)}%
            </span>
          )}
          {trendStr && (
            <span className="text-[11.5px] font-medium text-[var(--text-tertiary)]">{trendStr}</span>
          )}
          {note && !trendStr && (
            <span className="truncate text-[11.5px] text-[var(--text-faint)]">{note}</span>
          )}
        </div>
      )}
    </div>
  )
}
