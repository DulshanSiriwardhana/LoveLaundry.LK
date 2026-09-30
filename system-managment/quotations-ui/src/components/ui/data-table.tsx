import * as React from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../../lib/utils'
import { TableFrame } from './table'

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Header alignment; defaults to the cell alignment. */
  headerAlign?: 'left' | 'center' | 'right'
  align?: 'left' | 'center' | 'right'
  width?: string
  /** Right-align and tabular — money and quantities. */
  numeric?: boolean
  className?: string
  headerClassName?: string
  render?: (row: T, index: number) => React.ReactNode
  /** Rendered into the mobile card instead of a table cell. */
  mobileHidden?: boolean
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyState?: React.ReactNode
  onRowClick?: (row: T) => void
  rowKey?: (row: T) => string | number
  className?: string
  headerClassName?: string
  rowClassName?: string | ((row: T, index: number) => string)
  /** Sticky tbody head. Off for short tables inside dialogs. */
  stickyHeader?: boolean
  dense?: boolean
  /**
   * Mobile representation. Below `md` the table is replaced by a compact
   * record list built from the same columns — primary columns stacked, the
   * rest as label/value rows. Pass `false` to keep the scrolling table on
   * mobile (only correct for genuinely wide data such as a line-item grid).
   */
  mobile?: 'cards' | 'table' | false
  /** Columns promoted to the card's headline area, in order. */
  mobilePrimary?: string[]
  /**
   * Columns kept out of the mobile card's label/value list. A column listed
   * here is instead rendered in the card's trailing action slot, where clicks
   * are stopped so a menu does not also trigger the row navigation.
   */
  mobileHidden?: string[]
  caption?: React.ReactNode
}

const alignClass = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function isInteractive(onRowClick?: (row: any) => void) {
  return Boolean(onRowClick)
}

/**
 * DataTable — the workhorse for operational lists.
 *
 * Desktop: a dense ledger with a sticky header, aligned columns, tabular
 * numerals for money and quantities, and predictable row actions.
 *
 * Mobile: not a shrunken table. Below `md` each row becomes a tappable record
 * card — headline columns on top, remaining columns as label/value pairs — so
 * nothing is hidden and nothing overflows. Row click still works, so the whole
 * card is the target and the touch area is generous.
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyState,
  onRowClick,
  rowKey,
  className,
  headerClassName,
  rowClassName,
  stickyHeader = true,
  dense = false,
  mobile = 'cards',
  mobilePrimary,
  mobileHidden,
  caption,
}: DataTableProps<T>) {
  const interactive = isInteractive(onRowClick)

  // Headline columns for the mobile card: explicit list, else the first two
  // non-numeric columns, which are almost always the identity of a record.
  const primaryKeys =
    mobilePrimary?.length
      ? mobilePrimary
      : columns
          .filter((c) => !c.numeric && c.align !== 'right' && !c.mobileHidden)
          .slice(0, 2)
          .map((c) => c.key)

  // Columns the mobile card hides are rendered in its action slot instead.
  const actionColumns = (mobileHidden ?? []).length
    ? columns.filter((c) => mobileHidden!.includes(c.key))
    : []
  const detailColumns = columns.filter(
    (c) => !primaryKeys.includes(c.key) && !(mobileHidden ?? []).includes(c.key),
  )

  return (
    <>
      {/* ── Desktop / tablet ─────────────────────────────────────────────── */}
      <div className={cn('hidden md:block', className)}>
        <TableFrame>
          <table className={cn('ledger', dense && 'ledger-dense')}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className={cn(!stickyHeader && '[&_th]:static', headerClassName)}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      alignClass[col.headerAlign ?? col.align ?? 'left'],
                      col.numeric && 'num',
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="!p-0">
                    {emptyState ?? <TableEmpty />}
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const key = rowKey ? rowKey(row) : idx
                  return (
                    <tr
                      key={key}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={
                        onRowClick
                          ? (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                onRowClick(row)
                              }
                            }
                          : undefined
                      }
                      tabIndex={onRowClick ? 0 : undefined}
                      className={cn(
                        interactive && 'cursor-pointer',
                        typeof rowClassName === 'function' ? rowClassName(row, idx) : rowClassName,
                      )}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            alignClass[col.align ?? 'left'],
                            col.numeric && 'num',
                            col.className,
                          )}
                        >
                          {col.render ? col.render(row, idx) : formatCell(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TableFrame>
      </div>

      {/* ── Mobile ───────────────────────────────────────────────────────── */}
      {mobile === 'cards' && (
        <div className={cn('space-y-2 md:hidden', className)}>
          {data.length === 0 ? (
            emptyState ?? <TableEmpty />
          ) : (
            data.map((row, idx) => {
              const key = rowKey ? rowKey(row) : idx
              const primary = primaryKeys
                .map((k) => columns.find((c) => c.key === k))
                .filter(Boolean) as Column<T>[]
              return (
                <div
                  key={key}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-3',
                    onRowClick && 'active:bg-[var(--surface-hover)]',
                    typeof rowClassName === 'function' ? rowClassName(row, idx) : rowClassName,
                  )}
                >
                  {(primary.length > 0 || actionColumns.length > 0) && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {primary.map((col, i) => (
                          <div
                            key={col.key}
                            className={cn(
                              'truncate',
                              i === 0
                                ? 'text-[13.5px] font-semibold text-[var(--text-primary)]'
                                : 'text-[12.5px] text-[var(--text-tertiary)]',
                            )}
                          >
                            {col.render ? col.render(row, idx) : formatCell(row[col.key])}
                          </div>
                        ))}
                      </div>

                      {actionColumns.length > 0 && (
                        <div
                          className="flex shrink-0 items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {actionColumns.map((col) => (
                            <React.Fragment key={col.key}>
                              {col.render ? col.render(row, idx) : formatCell(row[col.key])}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {detailColumns.length > 0 && (
                    <dl className="mt-2.5 space-y-1 border-t border-[var(--border)] pt-2.5">
                      {detailColumns.map((col) => (
                        <div key={col.key} className="flex items-baseline justify-between gap-3">
                          <dt className="shrink-0 text-[12px] text-[var(--text-muted)]">
                            {typeof col.header === 'string' ? col.header : col.key}
                          </dt>
                          <dd
                            className={cn(
                              'min-w-0 truncate text-right text-[12.5px] text-[var(--text-secondary)]',
                              col.numeric && 'tabular-nums',
                            )}
                          >
                            {col.render ? col.render(row, idx) : formatCell(row[col.key])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </>
  )
}

function TableEmpty() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-2.5 flex size-9 items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-faint)]">
        <Inbox className="size-[18px]" aria-hidden />
      </div>
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">Nothing to show yet</p>
      <p className="mt-1 max-w-sm text-[12.5px] leading-[1.55] text-[var(--text-muted)]">
        There are no records to display here yet.
      </p>
    </div>
  )
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
