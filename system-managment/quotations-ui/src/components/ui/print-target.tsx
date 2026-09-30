import type { CSSProperties, ReactNode } from 'react'

/**
 * Off-screen host for a print template.
 *
 * `display: none` must NOT be used for this. `react-to-print` clones the target
 * subtree into the browser's print document; a `display: none` ancestor means
 * nothing in the subtree is laid out, so the printed output comes out blank.
 * Positioning the host off-screen keeps the subtree laid out (and therefore
 * measurable and printable) while remaining invisible on screen.
 *
 * The width is pinned to A4 at 96dpi so the sheet paginates like real paper
 * instead of reflowing to the viewport width.
 */
const hostStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: '-10000px',
  width: '794px',
  pointerEvents: 'none',
  zIndex: -1,
}

export function PrintTarget({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" style={hostStyle}>
      {children}
    </div>
  )
}
