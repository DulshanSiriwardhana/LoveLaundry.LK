import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Spreadsheet-style keyboard navigation for tabular data entry.
 *
 * Typical flow per row: field → Enter → next field → … → Enter → next row.
 * On the very last cell, Enter/Tab appends a new row (via `onAppendRow`)
 * and moves focus into it.
 *
 * Keys:
 *  - Enter            → next cell (row-major); appends at end
 *  - Tab / Shift+Tab  → next / previous cell (row-major); appends at end
 *  - ArrowDown/Up     → same column, next/previous row (text inputs only —
 *                       native increment behaviour of number inputs and the
 *                       selection behaviour of <select> is preserved)
 *  - Escape           → clears the active cell highlight
 *
 * Usage:
 *   const grid = useDataGrid({ columns: 5, rows: items.length, onAppendRow: addItem })
 *   <div onKeyDown={grid.handleKeyDown}>          // once, on the rows container
 *     {items.map((it, ri) => (
 *       <input ref={grid.registerCell(ri, 0)} ... />
 *     ))}
 *   </div>
 *
 * `registerCell(r, c)` returns a ref callback; combine it with an existing
 * ref using `mergeRefs` (e.g. react-hook-form's register()-returned ref).
 */
export interface DataGridOptions {
  columns: number
  rows: number
  /** Called when Enter/Tab lands past the final cell — defaults to no-op. */
  onAppendRow?: () => void
  /** Called when navigation reaches the very end and no onAppendRow is set. */
  onEnd?: () => void
}

export interface ActiveCell {
  row: number
  col: number
}

const cellKey = (row: number, col: number) => `${row}:${col}`

export function useDataGrid({ columns, rows, onAppendRow, onEnd }: DataGridOptions) {
  const cells = useRef<Map<string, HTMLElement>>(new Map())
  const [active, setActive] = useState<ActiveCell | null>(null)
  const [pending, setPending] = useState<ActiveCell | null>(null)

  const focusCell = useCallback((row: number, col: number) => {
    const el = cells.current.get(cellKey(row, col))
    if (el) {
      el.focus()
      setActive({ row, col })
      return true
    }
    return false
  }, [])

  const moveNext = useCallback((row: number, col: number) => {
    if (col < columns - 1) {
      focusCell(row, col + 1)
      return
    }
    if (row < rows - 1) {
      focusCell(row + 1, 0)
      return
    }
    // End of the grid: append a fresh row and park the cursor on its first cell.
    if (onAppendRow) {
      onAppendRow()
      setPending({ row: rows, col: 0 })
    } else if (onEnd) {
      onEnd()
    }
  }, [columns, rows, focusCell, onAppendRow, onEnd])

  const movePrev = useCallback((row: number, col: number) => {
    if (col > 0) {
      focusCell(row, col - 1)
    } else if (row > 0) {
      focusCell(row - 1, columns - 1)
    }
  }, [columns, focusCell])

  /** Advance focus exactly like pressing Enter at the given (or active) cell. */
  const advance = useCallback((row?: number, col?: number) => {
    const cur = row !== undefined && col !== undefined ? { row, col } : active
    if (!cur) return
    moveNext(cur.row, cur.col)
  }, [active, moveNext])

  /**
   * Attach to the container holding all grid cells (bubble phase). Uses the
   * currently focused cell (tracked via registerCell's internal onfocus hook).
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const cur = active
    if (!cur) return
    const { row, col } = cur
    const target = e.target as HTMLInputElement

    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) movePrev(row, col)
      else moveNext(row, col)
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      moveNext(row, col)
      return
    }

    const nativeArrows =
      target.tagName !== 'INPUT' ||
      (target.type !== 'text' && target.type !== 'search') ||
      Boolean(target.list)

    if (e.key === 'ArrowDown' && !nativeArrows && row < rows - 1) {
      e.preventDefault()
      focusCell(row + 1, col)
      return
    }
    if (e.key === 'ArrowUp' && !nativeArrows && row > 0) {
      e.preventDefault()
      focusCell(row - 1, col)
      return
    }

    if (e.key === 'Escape') setActive(null)
  }, [active, rows, moveNext, movePrev, focusCell])

  // When a new row is appended, focus its first cell once it renders.
  useEffect(() => {
    if (!pending) return
    const el = cells.current.get(cellKey(pending.row, pending.col))
    if (el) {
      el.focus()
      setActive(pending)
      setPending(null)
    }
  }, [pending, rows])

  /** Ref callback for a grid cell. Assigns focus tracking on focus. */
  const registerCell = useCallback((row: number, col: number) => (el: HTMLElement | null) => {
    const key = cellKey(row, col)
    if (el) {
      cells.current.set(key, el)
      el.onfocus = () => setActive({ row, col })
    } else {
      cells.current.delete(key)
    }
  }, [])

  const clearActive = useCallback(() => setActive(null), [])

  return { registerCell, focusCell, advance, handleKeyDown, active, clearActive }
}

/** Compose multiple refs (React 19: use the built-in `ref` prop or this helper). */
export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (el: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(el)
      else if (ref && typeof ref === 'object' && 'current' in ref) {
        ;(ref as React.MutableRefObject<T | null>).current = el
      }
    }
  }
}