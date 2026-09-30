import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Card — a bordered block of related content.
 *
 * Separation comes from the hairline border, not a shadow, so a page of cards
 * reads as one document rather than a pile of floating boxes. `hover` only
 * exists for cards that are themselves a link or a click target.
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Only for cards that are themselves a link or click target. */
  hover?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[10px] border border-[var(--border)] bg-[var(--surface)]',
        hover && 'card-interactive cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'

/**
 * CardHeader — a 48px-tall band that separates a block's title from its body.
 * The bottom rule is what makes a stack of panels scannable; keep it.
 */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5',
        className,
      )}
      {...props}
    />
  )
}

/**
 * CardContent — padded by default. Pass `flush` for a table or list that should
 * run to the card's edges; the surrounding header/footer rules still frame it.
 */
export function CardContent({
  className,
  flush = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn(flush ? '' : 'p-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3',
        className,
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-[13px] font-semibold leading-snug tracking-[-0.006em] text-[var(--text-primary)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[12.5px] text-[var(--text-muted)]', className)} {...props} />
}
