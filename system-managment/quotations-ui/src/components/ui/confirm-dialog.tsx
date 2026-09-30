import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, Loader2, TriangleAlert } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'primary'
  loading?: boolean
  /** Rendered above the buttons — e.g. the exact change being committed. */
  detail?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}

/**
 * ConfirmDialog — one confirmation pattern for the whole app.
 *
 * Built on the shared Dialog so size, footer order, mobile sheet behaviour and
 * focus handling are identical everywhere. Focus lands on Cancel for
 * destructive actions, Escape cancels, and the destructive tone is carried by
 * the icon, the tint and the confirm button together.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  detail,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  const tone =
    variant === 'danger'
      ? { icon: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger-border)]' }
      : variant === 'warning'
        ? { icon: 'bg-[var(--warning-soft)] text-[var(--warning-text)] border-[var(--warning-border)]' }
        : { icon: 'bg-[var(--info-soft)] text-[var(--info-text)] border-[var(--info-border)]' }

  const Icon = variant === 'danger' ? TriangleAlert : variant === 'warning' ? AlertTriangle : TriangleAlert

  // Escape to cancel, suppressed while the action is in flight so a half
  // committed request cannot be abandoned.
  useEffect(() => {
    if (!open || loading) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !loading) onCancel() }}>
      <DialogContent
        size="sm"
        onOpenAutoFocus={(e) => {
          if (variant === 'danger') {
            e.preventDefault()
            cancelRef.current?.focus()
          }
        }}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <DialogHeader className="border-0 pb-0 pr-10">
          <div className="flex items-start gap-3">
            <div className={cn(tone.icon, 'flex size-9 shrink-0 items-center justify-center rounded-[8px] border')}>
              <Icon className="size-[18px]" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle id={titleId}>{title}</DialogTitle>
              {(message || description) && (
                <DialogDescription id={bodyId}>{message || description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          {detail}
        </DialogBody>

        <DialogFooter>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading} className="sm:min-w-[84px]">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'primary' ? 'primary' : variant === 'warning' ? 'warning' : 'danger'}
            onClick={onConfirm}
            disabled={loading}
            className="sm:min-w-[84px]"
          >
            {loading && <Loader2 className="animate-spin" aria-hidden />}
            {loading ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
