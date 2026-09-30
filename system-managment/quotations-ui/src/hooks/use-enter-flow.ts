import { useCallback, useRef } from 'react'

const FLOWABLE = 'input, select, textarea'

function isUsable(el: HTMLElement): boolean {
  if ((el as HTMLInputElement).disabled) return false
  if ((el as HTMLInputElement).readOnly) return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  // Skip hidden elements (offsetParent check approximates visibility; the
  // currently focused element may have zero size in edge cases so keep it).
  return el === document.activeElement || el.offsetWidth > 0 || el.offsetHeight > 0
}

/**
 * Flat/keyboard-friendly form navigation for non-aggregated forms
 * (management dialogs, header blocks, receipt sheets, etc.).
 *
 * Pressing Enter inside an input or <select> moves focus to the next usable
 * field in DOM (visual) order. On the last field Enter keeps its default
 * behaviour — form submission where a submit button exists — so Enter
 * intentionally submits at the end of the flow.
 *
 * <form ref={flow.ref} onKeyDown={flow.handleKeyDown}>…</form>
 */
export function useEnterFlow<T extends HTMLElement = HTMLFormElement>() {
  const ref = useRef<T>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return

    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') {
      return
    }
    if (target.tagName === 'TEXTAREA') return

    const container = ref.current
    if (!container) return

    const fields = Array.from(container.querySelectorAll<HTMLElement>(FLOWABLE)).filter(isUsable)
    const idx = fields.indexOf(target)
    if (idx < 0 || idx >= fields.length - 1) return

    const next = fields[idx + 1]
    next.focus()
    e.preventDefault()
  }, [])

  return { ref, handleKeyDown }
}