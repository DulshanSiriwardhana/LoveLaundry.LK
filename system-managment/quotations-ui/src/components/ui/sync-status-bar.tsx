import { RefreshCw, CloudOff, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useSyncStatus, type ResourceSyncState, type SyncStatus } from '../../cache/useSyncStatus'

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatLastUpdated(ts: number | null): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff >= 0 && diff < 30_000) return 'Updated just now'
  return `Last updated: ${DATE_FMT.format(new Date(ts))}`
}

const CONF: Record<SyncStatus, { dot: string; text: string; label: (s: ResourceSyncState) => string; Icon?: typeof RefreshCw }> = {
  fresh: {
    dot: 'bg-[var(--success-text)]',
    text: 'text-[var(--success-text)]',
    label: (s) => formatLastUpdated(s.lastUpdated),
    Icon: CheckCircle2,
  },
  syncing: {
    dot: 'bg-[var(--info-text)]',
    text: 'text-[var(--info-text)]',
    label: () => 'Updating…',
    Icon: Loader2,
  },
  stale: {
    dot: 'bg-[var(--warning-text)]',
    text: 'text-[var(--text-muted)]',
    label: (s) => `${formatLastUpdated(s.lastUpdated)} · Cached`,
    Icon: RefreshCw,
  },
  offline: {
    dot: 'bg-[var(--danger-text)]',
    text: 'text-[var(--danger-text)]',
    label: (s) => `${formatLastUpdated(s.lastUpdated)} · Offline`,
    Icon: CloudOff,
  },
  error: {
    dot: 'bg-[var(--danger-text)]',
    text: 'text-[var(--danger-text)]',
    label: (s) => `${formatLastUpdated(s.lastUpdated)} · Sync unavailable`,
    Icon: AlertTriangle,
  },
  'no-data': {
    dot: 'bg-[var(--text-faint)]',
    text: 'text-[var(--text-faint)]',
    label: () => 'Loading…',
    Icon: Loader2,
  },
}

export interface SyncStatusBarProps {
  queryKey: readonly unknown[]
  label?: string
  className?: string
}

/** Shows live cache/sync status ("Last updated: … · Updating/Offline") for
 *  a resource identified by a query-key prefix. Rendering is driven by the
 *  React Query cache, never by blocked network waits. */
export function SyncStatusBar({ queryKey, label, className = '' }: SyncStatusBarProps) {
  const sync = useSyncStatus(queryKey)
  const cfg = CONF[sync.status]
  const Icon = cfg.Icon

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm ${cfg.text} ${className}`}
      title={`Local cache status for ${label ?? String(queryKey[0] ?? '')}`}
      role="status"
      aria-live="polite"
    >
      {Icon ? (
        <Icon
          className={`h-3 w-3 ${sync.updating ? 'animate-spin' : ''}`}
        />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      )}
      {label ? <span className="opacity-70">{label}:</span> : null}
      <span>{cfg.label(sync)}</span>
    </div>
  )
}

export default SyncStatusBar