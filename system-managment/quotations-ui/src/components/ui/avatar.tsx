import { cn } from '../../lib/utils'

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-7 text-[11px]',
  lg: 'size-9 text-[13px]',
} as const

/**
 * Avatar — initials for a person or an account.
 *
 * Deliberately monochrome. A photograph of a laundromat client tells the
 * operator nothing and a coloured initial adds a hue that competes with the
 * status colours; the initials identify, the tone elsewhere informs. Where an
 * image is genuinely the subject (a profile page) use `src` instead.
 *
 * `initials` may be passed explicitly; otherwise the first two words of `name`
 * are used, which reads better than a single letter in a list of clients.
 */
export function Avatar({
  name,
  initials,
  src,
  size = 'md',
  className,
}: {
  name: string
  initials?: string
  src?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  const label =
    initials ??
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn('shrink-0 rounded-full object-cover', SIZES[size], className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        'border border-[var(--border-2)] bg-[var(--surface-3)] font-semibold uppercase leading-none',
        'text-[var(--text-muted)]',
        SIZES[size],
        className,
      )}
    >
      {label || '—'}
    </span>
  )
}
