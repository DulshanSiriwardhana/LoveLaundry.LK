import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

export interface FastEntryApi<Row> {
  rows: Row[]
  updateRow: (index: number, patch: Partial<Row>) => void
  removeRow: (index: number) => void
  focusCell: (rowIndex: number, colIndex: number) => void
}

export interface FastEntryColumn<Row> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  className?: string
  render: (row: Row, rowIndex: number, api: FastEntryApi<Row>) => ReactNode
}

interface FastEntryTableProps<Row> {
  rows: Row[]
  columns: FastEntryColumn<Row>[]
  onChange: (rows: Row[]) => void
  makeRow: () => Row
  /** "Repeat last" — copy the final row so bulk entry of similar lines is one click. */
  onRepeatLast?: () => void
  addLabel?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
  getRowKey?: (row: Row, index: number) => string
}

/**
 * Keyboard-first entry grid.
 *
 * Arrow Up/Down and Enter move between rows in the same column (Enter on the
 * last row appends a new one), so a whole gate pass or delivery can be typed
 * without ever touching the mouse. Column cells are supplied by the caller via
 * `render`, which receives an `api` for programmatic focus/update/remove.
 */
export function FastEntryTable<Row>({
  rows,
  columns,
  onChange,
  makeRow,
  onRepeatLast,
  addLabel = 'Add row',
  emptyLabel = 'No rows yet',
  disabled = false,
  className,
  getRowKey,
}: FastEntryTableProps<Row>) {
  const gridRef = useRef<HTMLDivElement>(null)

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    const cell = gridRef.current?.querySelector<HTMLElement>(
      `[data-cell="${rowIndex}:${colIndex}"]`,
    )
    if (!cell) return
    const focusable = cell.querySelector<HTMLElement>(
      'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])',
    )
    ;(focusable ?? cell).focus()
  }, [])

  const updateRow = useCallback(
    (index: number, patch: Partial<Row>) => {
      onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    },
    [rows, onChange],
  )

  const removeRow = useCallback(
    (index: number) => {
      onChange(rows.filter((_, i) => i !== index))
    },
    [rows, onChange],
  )

  const addRow = useCallback(() => {
    onChange([...rows, makeRow()])
  }, [rows, onChange, makeRow])

  const api: FastEntryApi<Row> = { rows, updateRow, removeRow, focusCell }

  const handleCellKeyDown = (
    e: KeyboardEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
  ) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault()
      if (rowIndex === rows.length - 1) {
        addRow()
        requestAnimationFrame(() => focusCell(rows.length, colIndex))
      } else {
        focusCell(rowIndex + 1, colIndex)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIndex > 0) focusCell(rowIndex - 1, colIndex)
    }
  }

  const alignClass = (align?: FastEntryColumn<Row>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <div ref={gridRef} className={cn('overflow-x-auto rounded-xl border border-[var(--border)]', className)}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]">
            {columns.map(col => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide',
                  alignClass(col.align),
                  col.className,
                )}
                scope="col"
              >
                {col.header}
              </th>
            ))}
            <th className="w-10 px-2" scope="col" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-3 py-8 text-center text-[13px]"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={getRowKey ? getRowKey(row, rowIndex) : rowIndex} className="group hover:bg-[var(--surface-hover)]">
                {columns.map((col, colIndex) => (
                  <td
                    key={col.key}
                    data-cell={`${rowIndex}:${colIndex}`}
                    tabIndex={-1}
                    onKeyDown={e => handleCellKeyDown(e, rowIndex, colIndex)}
                    className={cn('px-3 py-1.5 align-middle outline-none', alignClass(col.align), col.className)}
                  >
                    {col.render(row, rowIndex, api)}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeRow(rowIndex)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                    aria-label={`Remove row ${rowIndex + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={addRow} disabled={disabled}>
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Button>
        {onRepeatLast && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRepeatLast}
            disabled={disabled || rows.length === 0}
          >
            Repeat last
          </Button>
        )}
        <span className="ml-auto text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          ↑↓ / Enter to move · Enter on last row adds one
        </span>
      </div>
    </div>
  )
}
