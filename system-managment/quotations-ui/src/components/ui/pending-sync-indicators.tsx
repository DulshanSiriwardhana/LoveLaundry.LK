import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useIsEntityPending, usePendingChanges } from '../../cache/pending-sync'

/**
 * Small amber/red chip on a record (row/card/detail) whose last edit or delete
 * was saved locally but hasn't reached the server yet. Red once a replay was
 * permanently rejected and needs attention.
 */
export function PendingSyncBadge({
  service,
  entityId,
  className,
}: {
  service: string
  entityId?: string
  className?: string
}) {
  const pending = useIsEntityPending(service, entityId)
  if (!pending) return null
  const failed = pending.status === 'failed'
  return (
    <span
      title={`Saved offline — ${pending.method} ${pending.url}${failed ? ' (rejected by server)' : ' (will sync automatically)'}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        failed
          ? 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-text)]'
          : 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-text)]',
        className,
      )}
    >
      {failed ? <AlertTriangle className="h-2.5 w-2.5" /> : <CloudOff className="h-2.5 w-2.5" />}
      {failed ? 'Sync failed' : 'Pending sync'}
    </span>
  )
}

/**
 * Page-level chip showing how many locally-saved changes relate to the current
 * view (e.g. all gate-pass or delivery edits made while offline).
 */
export function OfflineChangesChip({
  service,
  resource,
  className,
}: {
  service: string
  resource?: string
  className?: string
}) {
  const counts = usePendingChanges(service, resource)
  const total = counts.pending + counts.failed
  if (total === 0) return null
  return (
    <span
      title={`${total} local change${total === 1 ? '' : 's'} saved offline${counts.failed > 0 ? ` — ${counts.failed} failed, open a record to retry` : ' — syncing automatically when online'}`}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        counts.failed > 0
          ? 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger-text)]'
          : 'border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning-text)]',
        className,
      )}
    >
      {counts.failed > 0 ? (
        <AlertTriangle className="h-3 w-3" />
      ) : counts.pending > 0 ? (
        <RefreshCw className="h-3 w-3" />
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      {total} offline change{total === 1 ? '' : 's'}
    </span>
  )
}