import { CloudSlash, WarningCircle, ArrowsClockwise, Spinner } from '@phosphor-icons/react'
import { useOfflineSync } from '../../cache/offline-hooks'
import { drain, retryFailedSync } from '../../cache/sync-engine'
import { cn } from '../../lib/utils'

/**
 * Floating pill showing the local offline/write-queue status. Never blocks
 * the UI — it is a passive indicator with an optional retry action.
 */
export function OfflineSyncBar() {
  const sync = useOfflineSync()
  const queued = sync.pending + sync.syncing

  if (sync.failed > 0) {
    return (
      <Bar tone="error" onClick={() => void retryFailedSync()}>
        <WarningCircle weight="fill" className="h-3.5 w-3.5" />
        <span>
          {sync.failed} saved change{sync.failed === 1 ? '' : 's'} was rejected while offline
        </span>
        <span className="ml-1 font-semibold underline underline-offset-2">Retry</span>
      </Bar>
    )
  }

  if (!sync.online && queued > 0) {
    return (
      <Bar tone="warn">
        <CloudSlash weight="fill" className="h-3.5 w-3.5" />
        <span>
          Offline — {queued} change{queued === 1 ? '' : 's'} saved locally, will sync automatically
        </span>
      </Bar>
    )
  }

  if (!sync.online) {
    return (
      <Bar tone="muted">
        <CloudSlash weight="fill" className="h-3.5 w-3.5" />
        <span>Offline — showing saved data</span>
      </Bar>
    )
  }

  if (queued > 0) {
    return (
      <Bar tone="info" onClick={() => void drain()}>
        {sync.syncing > 0 ? (
          <Spinner weight="fill" className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowsClockwise className="h-3.5 w-3.5" />
        )}
        <span>
          {sync.syncing > 0
            ? `Syncing ${queued} saved change${queued === 1 ? '' : 's'}…`
            : `${queued} saved change${queued === 1 ? '' : 's'} waiting to sync`}
        </span>
        {sync.syncing === 0 && <span className="ml-1 font-semibold underline underline-offset-2">Sync now</span>}
      </Bar>
    )
  }

  return null
}

function Bar({
  tone,
  onClick,
  children,
}: {
  tone: 'error' | 'warn' | 'muted' | 'info'
  onClick?: () => void
  children: React.ReactNode
}) {
  const tones: Record<string, string> = {
    error: 'bg-red-600 text-white',
    warn: 'bg-amber-500 text-white',
    muted: 'bg-slate-700 text-white',
    info: 'bg-sky-600 text-white',
  }
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onClick}
      className={cn(
        'fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 cursor-default items-center gap-2 rounded-full px-4 py-2 text-xs font-medium shadow-lg',
        tones[tone],
        onClick && 'cursor-pointer',
      )}
    >
      {children}
    </div>
  )
}