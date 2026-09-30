import { useEffect } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '../ui/button'

export interface ConfirmChange {
  label: string
  from?: string | number
  to?: string | number
}

interface SmartConfirmProps {
  open: boolean
  title: string
  /** Explicit before → after list. Renders as a diff so nothing is committed blind. */
  changes?: ConfirmChange[]
  message?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A confirm dialog that shows the user exactly what is about to change.
 * Used by every write in the fast-entry flows so accidental keystrokes can't
 * silently corrupt quantities.
 */
export function SmartConfirm({
  open,
  title,
  changes,
  message,
  confirmLabel = 'Confirm',
  loading = false,
  onConfirm,
  onCancel,
}: SmartConfirmProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !loading && onCancel()} />
      <div
        className="relative w-full max-w-md mx-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {message && (
              <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                {message}
              </p>
            )}
          </div>
        </div>

        {changes && changes.length > 0 && (
          <div className="max-h-64 overflow-y-auto px-5 py-3">
            <table className="w-full text-[13px]">
              <tbody className="divide-y divide-[var(--border)]">
                {changes.map((c, i) => (
                  <tr key={`${c.label}-${i}`}>
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {c.label}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {c.from !== undefined && (
                        <span style={{ color: 'var(--text-tertiary)' }}>{c.from}</span>
                      )}
                      {c.from !== undefined && c.to !== undefined && (
                        <ArrowRight className="inline mx-1.5 h-3 w-3" style={{ color: 'var(--text-tertiary)' }} />
                      )}
                      {c.to !== undefined && (
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {c.to}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
