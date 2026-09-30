import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Table — the ledger surface.
 *
 * Density over decoration: 10px/12px cells, 13px text, hairline row rules, a
 * sticky header, and no zebra striping (it fights with hover and with status
 * fills). Horizontal scroll is contained here, never on the page, so a wide
 * ledger on a 360px screen scrolls inside its own frame with the header frozen.
 *
 * `responsive` opts out of the desktop minimum width for tables that genuinely
 * fit a narrow screen; everything else gets `min-width` and a local scrollbar.
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <TableFrame>
      <table className={cn('ledger', className)} {...props} />
    </TableFrame>
  )
}

/** Scroll container + edge shadows. Use when composing a table by hand. */
export function TableFrame({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('scroll-fade ledger-wrap', className)} {...props}>
      {children}
    </div>
  )
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(className)} {...props} />
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />
}

export function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t-2 border-[var(--border-2)] bg-[var(--surface-2)] font-medium', className)}
      {...props}
    />
  )
}

export function TableRow({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn(interactive && 'cursor-pointer', className)} {...props} />
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn(className)} {...props} />
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn(className)} {...props} />
}
