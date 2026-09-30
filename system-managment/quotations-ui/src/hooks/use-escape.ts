import { useEffect } from 'react'

/**
 * Close-on-Escape for custom modals/dialogs that don't use Radix Dialog.
 * `active` is usually the modal's open state; `onEscape` called on Escape key.
 */
export function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onEscape])
}