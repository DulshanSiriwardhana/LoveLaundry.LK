import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Bath,
  BedDouble,
  BedSingle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Layers3,
  Radio,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Waves,
} from 'lucide-react'
import { companySettingsApi } from '../../management/api/management-api'
import { useAuth } from '../../../context/AuthContext'
import {
  linenKeys,
  useBulkScan,
  useLinenTransitions,
  useLinenVerifications,
  useMissingInCycle,
} from '../hooks/useLinen'
import { useLinenCamera } from '../hooks/useLinenCamera'
import { useLinenLiveFeed, type LinenFeedStatus } from '../hooks/useLinenLiveFeed'
import { useReducedMotion } from '../../feature-pack/hooks'
import { CustodyGroupPanel, ScanSelectHero, ScanStatCard } from '../components/scan-step-cards'
import { LinenLiveBadge } from '../components/linen-live-badge'
import { parseLinenCode } from '../lib/linen-code'
import {
  CATEGORY_LABEL,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  applyBulkResult,
  applyLinenLiveEvent,
  applyLinenVerification,
  classifyLinen,
  createSession,
  transitionViolation,
  daysSince,
  endSession,
  failQueued,
  failedTotal,
  filterRecords,
  queuedCodes,
  recordScan,
  requeueUnresolved,
  scannedCodes,
  summarise,
  type LinenLiveUpdate,
  type LinenRealtimeEvent,
  type ScanRecord,
  type ScanSession,
  type ScanSummary,
  type VerificationState,
} from '../lib/scan-session'
import {
  LINEN_STATUS_CONFIG,
  type Linen,
  type LinenBulkScanResult,
  type LinenStatus,
  type LinenTransition,
  type LinenTransitionList,
} from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Breadcrumb } from '../../../components/ui/breadcrumb'

type Phase = 'select' | 'scanning' | 'summary'

const TONE_BADGE = {
  green: 'success',
  amber: 'warning',
  red: 'danger',
  blue: 'neutral',
  neutral: 'neutral',
} as const

/** Used only when the management service has not answered yet. The real value
 * is admin-defined in Company Settings and persisted server-side. */
const DEFAULT_MISSING_AFTER_DAYS = 7

const FEED_LABEL: Record<LinenFeedStatus, string> = {
  live: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

const FEED_TONE: Record<LinenFeedStatus, 'success' | 'warning' | 'neutral'> = {
  live: 'success',
  connecting: 'warning',
  reconnecting: 'warning',
  offline: 'neutral',
}

function statusLabel(status?: string): string {
  if (!status) return '—'
  return LINEN_STATUS_CONFIG[status as LinenStatus]?.label ?? status
}

function timeOfDay(ms?: number): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LinenSession() {
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const operator = user?.user_name ?? 'unknown'
  const { data: catalogue, isLoading: catalogueLoading, error: catalogueError, refetch: refetchCatalogue } = useLinenTransitions()
  const bulkMutation = useBulkScan()

  const [phase, setPhase] = useState<Phase>('select')
  const [target, setTarget] = useState<LinenTransition | null>(null)
  const [location, setLocation] = useState('')
  const [session, setSession] = useState<ScanSession | null>(null)
  const [apiResult, setApiResult] = useState<LinenBulkScanResult | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const verificationStampRef = useRef(new Map<string, string>())
  const qc = useQueryClient()

  // Read-only for operators; the value itself is written by an admin in
  // Company Settings. A failed settings call falls back to the same default as
  // the management backend so the scanner still behaves predictably.
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get().then(response => response.data),
    staleTime: 5 * 60_000,
  })
  const missingAfterDays = useMemo(() => {
    const value = Number(companySettings?.linen_missing_after_days)
    return Number.isFinite(value) && value >= 1 && value <= 365
      ? Math.round(value)
      : DEFAULT_MISSING_AFTER_DAYS
  }, [companySettings])

  const { data: missingLinens, isLoading: missingLoading } = useMissingInCycle(
    missingAfterDays,
    phase !== 'select'
  )
  const isAdmin = ['ADMIN', 'PLATFORM_ADMIN'].includes(String(user?.role_id ?? '').toUpperCase())

  const focusScanner = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  useEffect(() => {
    if (phase === 'scanning') focusScanner()
  }, [phase, focusScanner])

  const handleLiveEvent = useCallback((event: LinenRealtimeEvent) => {
    setSession(current => (current ? applyLinenLiveEvent(current, event) : current))
    qc.invalidateQueries({ queryKey: linenKeys.missing() })
  }, [qc])
  const liveFeed = useLinenLiveFeed(handleLiveEvent, phase !== 'select')

  const verificationCodes = useMemo(
    () => (session ? scannedCodes(session.records) : []),
    [session]
  )
  const verifications = useLinenVerifications(verificationCodes, phase !== 'select')

  // React Query hands back a fresh array each render. The stamp map makes the
  // patch idempotent so verified/unverified tags never trigger a render loop.
  useEffect(() => {
    const pending = verifications.filter(result => {
      const stamp = `${session?.id ?? ''}:${result.state}:${result.dataUpdatedAt}:${result.errorUpdatedAt}`
      return verificationStampRef.current.get(result.code) !== stamp
    })
    if (!pending.length) return
    for (const result of pending) {
      verificationStampRef.current.set(
        result.code,
        `${session?.id ?? ''}:${result.state}:${result.dataUpdatedAt}:${result.errorUpdatedAt}`
      )
    }
    setSession(current => {
      if (!current) return current
      let next = current
      for (const result of pending) {
        if (result.state === 'success' && result.linen) {
          next = applyLinenVerification(next, result.code, result.linen, Date.now())
          const violation = transitionViolation(catalogue, result.linen.status, session?.toStatus ?? target?.to_status ?? '')
          if (violation) {
            next = {
              ...next,
              records: next.records.map(record => record.code === result.code
                ? { ...record, message: violation }
                : record),
            }
          }
        } else if (result.state === 'error') {
          // 404 is the meaningful case: this QR is not a registered linen here.
          next = applyLinenVerification(next, result.code, null, Date.now())
        }
      }
      return next
    })
  }, [verifications, session?.id, catalogue, target])

  const processScan = useCallback((raw: string) => {
    if (phase !== 'scanning' || bulkMutation.isPending) return

    if (!parseLinenCode(raw)) {
      toast.warning('That read was not a linen tag')
    }
    setSession(current => (current ? recordScan(current, raw) : current))
    setCodeInput('')
    focusScanner()
  }, [bulkMutation.isPending, focusScanner, phase])

  const camera = useLinenCamera({ onCode: raw => processScan(raw) })

  const beginSession = useCallback((transition: LinenTransition) => {
    setSession(createSession({
      action: transition.action,
      actionLabel: transition.label,
      toStatus: transition.to_status,
      custody: transition.custody,
      operator,
    }))
    setTarget(transition)
    setApiResult(null)
    setCodeInput('')
    setFilter('')
    setPhase('scanning')
  }, [operator])

  /**
   * OK is the only write point in the whole flow. Every valid scan has been
   * queued locally up to here; one bulk request updates the linen and its
   * response becomes the summary.
   */
  const commitBatch = useCallback(async () => {
    if (!session || !target || phase !== 'scanning' || bulkMutation.isPending) return

    const codes = queuedCodes(session)
    if (!codes.length) {
      toast.warning('Scan at least one linen before pressing OK')
      focusScanner()
      return
    }

    try {
      const response = await bulkMutation.mutateAsync({
        codes,
        action: target.action,
        location: location.trim() || undefined,
      })
      setSession(current => (current ? endSession(applyBulkResult(current, response)) : current))
      setApiResult(response)
      setPhase('summary')
      camera.stop()
    } catch {
      // The request never landed: keep every code retryable and stay on the
      // scanning screen so the operator can press OK again.
      setSession(current => (current ? failQueued(current, 'Batch was not submitted') : current))
      focusScanner()
    }
  }, [bulkMutation, camera, focusScanner, location, phase, session, target])

  const retryUnresolved = useCallback(() => {
    setSession(current => (current ? requeueUnresolved(current) : current))
    setApiResult(null)
    setFilter('')
    setPhase('scanning')
  }, [])

  const startNewSession = useCallback(() => {
    camera.stop()
    setSession(null)
    setTarget(null)
    setApiResult(null)
    setLocation('')
    setCodeInput('')
    setFilter('')
    setPhase('select')
  }, [camera])

  const discardSession = useCallback(() => {
    if (!window.confirm('Discard this session? No linen has been updated yet.')) return
    startNewSession()
  }, [startNewSession])

  const summary = useMemo(() => (session ? summarise(session) : null), [session])
  const visibleRecords = useMemo(
    () => (session ? filterRecords(session.records, filter) : []),
    [session, filter]
  )

  // Queued scans exist only in this tab. Warn before an accidental reload or
  // navigation away loses the batch; after OK the summary is locally complete.
  useEffect(() => {
    if (phase !== 'scanning' || !session || !queuedCodes(session).length) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase, session])

  // ── 1. Pick the destination state from the server catalogue ─────────────
  if (phase === 'select' || !session || !target) {
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Linen' }, { label: 'Scan Session' }]} />
        <div className="flex justify-end"><LinenLiveBadge /></div>

        <ScanSelectHero
          title="Scan Session"
          description="Choose a state, scan continuously, then press OK once to update every linen in the batch."
          note="Nothing is written to linen while you scan — valid tags are held until you press OK."
          groups={catalogue?.groups ?? []}
        />

        {catalogueLoading && (
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-8 text-center text-sm text-[var(--text-muted)]">
              <RefreshCw size={15} className="mr-2 inline animate-spin" /> Loading states from the linen service…
            </CardContent>
          </Card>
        )}

        {catalogueError && (
          <Card className="border border-[var(--danger-border)] bg-[var(--danger-soft)] shadow-sm">
            <CardContent className="p-5 text-center">
              <p className="text-sm font-medium text-[var(--danger-text)]">
                The linen service did not answer, so no states can be listed. The picker is intentionally server-driven.
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetchCatalogue()}>
                <RefreshCw size={12} className="mr-1" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!catalogueLoading && !catalogueError && !catalogue?.groups?.length && (
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-8 text-center text-sm text-[var(--text-muted)]">
              No scan actions are available from the linen service.
            </CardContent>
          </Card>
        )}

        {catalogue?.groups.map((group, index) => (
          <CustodyGroupPanel
            key={group.custody}
            group={group}
            index={index}
            onSelect={beginSession}
          />
        ))}
      </div>
    )
  }

  // ── 3. Summary after the OK batch ───────────────────────────────────────
  if (phase === 'summary' && summary) {
    const unresolved = failedTotal(summary)
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Linen' }, { label: 'Scan Session' }, { label: 'Summary' }]} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
              Session Summary
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              <span className="font-[family-name:var(--font-mono)]">{session.id}</span> · {target.label} → {statusLabel(session.toStatus)} · {timeOfDay(session.startedAt)}–{timeOfDay(session.endedAt)}
              {location.trim() ? ` · ${location.trim()}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unresolved > 0 && (
              <Button variant="outline" size="sm" onClick={retryUnresolved}>
                <RefreshCw size={12} className="mr-1" /> Retry / Correct
              </Button>
            )}
            <Button variant="secondary" size="sm" asChild>
              <Link to="/linen/inventory">View Inventory</Link>
            </Button>
            <Button variant="primary" size="sm" onClick={startNewSession}>
              New Session
            </Button>
          </div>
        </div>

        {unresolved > 0 && (
          <Card className="border border-[var(--warning-border)] bg-[var(--warning-soft)] shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[var(--warning-text)]" />
              <div>
                <p className="text-sm font-medium text-[var(--warning-text)]">
                  {unresolved} scan(s) did not update linen.
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {summary.notFound} not registered, {summary.rejected} rejected, {summary.failed} could not be reached and {summary.unreadable} were not valid tags.
                  Retry / Correct puts the usable codes back in the queue so they can be submitted in one more batch.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Scans', value: summary.attempts, tone: 'slate' as const, icon: <ScanLine size={12} /> },
            { label: 'Linen updated', value: summary.successful, tone: 'green' as const, icon: <CheckCircle2 size={12} /> },
            { label: 'Not updated', value: unresolved, tone: 'rose' as const, icon: <AlertTriangle size={12} /> },
            { label: 'Duplicates', value: summary.duplicates, tone: 'amber' as const, icon: <Layers3 size={12} /> },
          ].map((stat, index) => (
            <ScanStatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              tone={stat.tone}
              icon={stat.icon}
              index={index}
            />
          ))}
        </div>

        <DistinctSummaryCards summary={summary} />

        <MissingInCyclePanel
          items={missingLinens?.items ?? []}
          total={missingLinens?.total ?? 0}
          days={missingAfterDays}
          loading={missingLoading}
          isAdmin={isAdmin}
        />

        {apiResult && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-[var(--border)] shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Updated by the linen service</h2>
                  <Badge tone="success" size="xs" dot>{apiResult.total_processed}</Badge>
                </div>
                {apiResult.processed.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-muted)]">No linen was updated.</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {apiResult.processed.map(row => (
                      <li key={row.linen_id} className="scan-soft-row flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs">
                        <CheckCircle2 size={13} className="flex-shrink-0 text-[var(--success-text)]" />
                        <span className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">{row.linen_id}</span>
                        <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                          {statusLabel(row.from_status)} <ArrowRight size={10} /> {statusLabel(row.to_status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] shadow-sm">
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Not updated by the linen service</h2>
                  <Badge tone={apiResult.total_errors ? 'warning' : 'neutral'} size="xs" dot>{apiResult.total_errors}</Badge>
                </div>
                {apiResult.errors.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[var(--text-muted)]">No server-side errors.</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {apiResult.errors.map(row => (
                      <li key={row.linen_id} className="scan-soft-row flex items-start gap-2 rounded border border-[var(--danger-border)] bg-[var(--danger-soft)] px-2 py-1.5 text-xs">
                        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-[var(--danger-text)]" />
                        <div className="min-w-0">
                          <p className="font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">{row.linen_id}</p>
                          <p className="text-[10px] text-[var(--danger-text)]">{row.error}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <SessionHistory
          records={visibleRecords}
          total={session.records.length}
          filter={filter}
          setFilter={setFilter}
        />
      </div>
    )
  }

  // ── 2. Continuous scan → scan → scan → OK ───────────────────────────────
  const queuedCount = summary?.queued ?? 0

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Scan Session' }]} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
            {target.label} <span className="text-[var(--brand)]">→</span> {statusLabel(session.toStatus)}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Keep passing tags. Each valid tag is queued once; Press OK when the batch is complete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!camera.active ? (
            <Button variant="secondary" size="sm" onClick={camera.start} disabled={camera.starting}>
              {camera.starting ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
              {camera.starting ? 'Starting…' : 'Camera'}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={camera.stop}>
              <CameraOff size={14} /> Stop Camera
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={discardSession} disabled={bulkMutation.isPending}>
            Discard
          </Button>
          <Button variant="primary" size="sm" onClick={() => void commitBatch()} disabled={!queuedCount} loading={bulkMutation.isPending}>
            <CheckCircle2 size={14} /> OK — Update {queuedCount} {queuedCount === 1 ? 'Item' : 'Items'}
          </Button>
        </div>
      </motion.div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <ScanLine size={11} /> <span className="font-[family-name:var(--font-mono)]">{session.id}</span>
        </span>
        <span className="inline-flex items-center gap-1"><UserRound size={11} /> {session.operator}</span>
        <span className="inline-flex items-center gap-1"><Clock size={11} /> started {timeOfDay(session.startedAt)}</span>
        <Badge tone="neutral" size="xs" dot>Scanning</Badge>
        <Badge tone={FEED_TONE[liveFeed.status]} size="xs" dot title="Live linen updates over websocket">
          <Radio size={10} /> {FEED_LABEL[liveFeed.status]}
        </Badge>
        <span className="text-[var(--text-tertiary)]">Nothing written to linen until OK</span>
      </div>

      <TransitionGuide
        actionLabel={target.label}
        toStatus={session.toStatus}
        catalogue={catalogue}
        violationMode={catalogue?.violation_mode}
        onOpenSettings={isAdmin}
      />

      {camera.error && (
        <Card className="border border-[var(--danger-border)] bg-[var(--danger-soft)] shadow-sm">
          <CardContent className="p-4 text-xs text-[var(--danger-text)]">{camera.error}</CardContent>
        </Card>
      )}

      <div
        ref={camera.containerRef}
        className="relative overflow-hidden rounded-md border border-[var(--border)] bg-black"
        style={{ display: camera.active || camera.starting ? 'block' : 'none', minHeight: 260 }}
      >
        {camera.active && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-52 w-52 rounded-2xl border-2 border-white/60" />
          </div>
        )}
        {camera.active && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-black/40 p-2 text-center text-xs text-white/80">
            Keep passing tags — every read is captured automatically
          </div>
        )}
      </div>

      <Card className="scan-input-card border border-[var(--brand-border)] bg-[var(--brand-soft)] shadow-sm">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                value={codeInput}
                onChange={event => setCodeInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    processScan(event.currentTarget.value)
                  }
                }}
                placeholder="Scan or type a linen ID (LL-XXXXXX)"
                autoComplete="off"
                disabled={bulkMutation.isPending}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-3 pl-10 pr-4 font-[family-name:var(--font-mono)] text-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
              />
            </div>
            <Button variant="primary" onClick={() => processScan(codeInput)} disabled={!codeInput.trim() || bulkMutation.isPending} className="px-5">
              <ScanLine size={14} /> Record scan
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={location}
              onChange={event => setLocation(event.target.value)}
              placeholder="Location / station (optional, applied on OK)"
              disabled={bulkMutation.isPending}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-50"
            />
            <p className="max-w-md text-[11px] text-[var(--text-muted)]">
              Focus returns here after every scan, so a keyboard-wedge scanner can keep reading without a tap.
            </p>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Scans', value: summary.attempts, tone: 'slate' as const, icon: <ScanLine size={12} /> },
              { label: 'Ready for OK', value: summary.queued, tone: 'green' as const, icon: <CheckCircle2 size={12} /> },
              { label: 'Duplicates', value: summary.duplicates, tone: 'amber' as const, icon: <Layers3 size={12} /> },
              { label: 'Needs attention', value: failedTotal(summary), tone: 'rose' as const, icon: <AlertTriangle size={12} /> },
            ].map((stat, index) => (
              <ScanStatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                tone={stat.tone}
                icon={stat.icon}
                index={index}
                compact
              />
            ))}
          </div>
          <DistinctSummaryCards summary={summary} compact />
        </div>
      )}

      <MissingInCyclePanel
        items={missingLinens?.items ?? []}
        total={missingLinens?.total ?? 0}
        days={missingAfterDays}
        loading={missingLoading}
        isAdmin={isAdmin}
        compact
      />

      <SessionHistory
        records={visibleRecords}
        total={session.records.length}
        filter={filter}
        setFilter={setFilter}
        compact
      />

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={() => void commitBatch()} disabled={!queuedCount} loading={bulkMutation.isPending}>
          <CheckCircle2 size={16} /> OK — Update Linen
        </Button>
      </div>
    </div>
  )
}

/** A calmer, guided header for the active scan tab. It explains where linen is
 * moving and what the admin's rules allow, instead of a bare action title. */
function TransitionGuide({
  actionLabel,
  toStatus,
  catalogue,
  violationMode,
  onOpenSettings,
}: {
  actionLabel: string
  toStatus: string
  catalogue?: LinenTransitionList
  violationMode?: 'block' | 'warn'
  onOpenSettings: boolean
}) {
  const reduceMotion = useReducedMotion()
  const rules = catalogue?.transition_rules || []
  const sources = rules
    .filter(rule => rule.to_statuses.includes(toStatus))
    .map(rule => rule.from_status)

  return (
    <Card className="scan-guide border border-[var(--brand-border)] bg-gradient-to-br from-[var(--brand-soft)] to-[var(--surface)] shadow-sm">
      <CardContent className="p-4">
        <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="scan-guide-pill inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white">
            <ScanLine size={13} /> {actionLabel}
          </span>
          <motion.span
            aria-hidden="true"
            animate={reduceMotion ? undefined : { x: [0, 3, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="text-[var(--brand)]"
          >
            <ArrowRight size={14} />
          </motion.span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{statusLabel(toStatus)}</span>
          <span className="ml-auto text-[11px] text-[var(--text-muted)]">
            {rules.length === 0
              ? 'No transition rules configured — all states allowed'
              : violationMode === 'warn'
                ? 'Invalid scans are allowed with a recorded warning'
                : 'Invalid scans are blocked automatically'}
          </span>
        </div>
        {rules.length > 0 && (
          <div className="relative z-10 mt-3 border-t border-[var(--brand-border)] pt-3">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              {sources.length
                ? `Allowed from: ${sources.map(s => statusLabel(s)).join(', ')}`
                : 'This target state has no configured source states.'}
            </p>
            {onOpenSettings && (
              <Link
                to="/management/company-settings"
                className="mt-1 inline-block text-[11px] text-[var(--brand-text)] underline underline-offset-2"
              >
                Edit scan rules in Company Settings
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DistinctSummaryCards({ summary, compact }: { summary: ScanSummary; compact?: boolean }) {
  const cards = [
    { label: 'Distinct linen', value: summary.distinctLinens, tone: 'brand' as const, icon: <Layers3 size={12} /> },
    { label: 'Bath towels', value: summary.categories.bathTowels, tone: 'amber' as const, icon: <Bath size={12} /> },
    { label: 'Pool towels', value: summary.categories.poolTowels, tone: 'slate' as const, icon: <Waves size={12} /> },
    { label: 'Single bedsheets', value: summary.categories.singleBedsheets, tone: 'accent' as const, icon: <BedSingle size={12} /> },
    { label: 'Double bedsheets', value: summary.categories.doubleBedsheets, tone: 'green' as const, icon: <BedDouble size={12} /> },
    { label: 'Verified tags', value: summary.verifiedLinens, tone: 'green' as const, icon: <ShieldCheck size={12} /> },
  ]

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Distinct linen summary
        </h2>
        <p className="text-[11px] text-[var(--text-muted)]">
          {summary.verifiedLinens} verified · {summary.unverifiedLinens} unregistered/fake
        </p>
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        {cards.map((card, index) => (
          <ScanStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            tone={card.tone}
            icon={card.icon}
            index={index}
          />
        ))}
      </div>
      {summary.categories.other > 0 && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {summary.categories.other} other/unclassified {summary.categories.other === 1 ? 'item' : 'items'} —
          their category is not on the tag yet.
        </p>
      )}
    </section>
  )
}

function MissingInCyclePanel({
  items,
  total,
  days,
  loading,
  isAdmin,
  compact,
}: {
  items: Linen[]
  total: number
  days: number
  loading: boolean
  isAdmin: boolean
  compact?: boolean
}) {
  const shown = items.slice(0, compact ? 5 : 8)

  return (
    <Card className="border border-[var(--warning-border)] shadow-sm">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Missing in cycle
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Admin window: <span className="font-semibold text-[var(--text-primary)]">{days} days</span>
              {' '}without a scan · flagged items appear immediately
              {isAdmin && (
                <>
                  {' · '}
                  <Link to="/management/company-settings" className="underline underline-offset-2">
                    Change window
                  </Link>
                </>
              )}
            </p>
          </div>
          <Badge tone={total ? 'warning' : 'success'} size="xs" dot>{total}</Badge>
        </div>

        {loading ? (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">Checking linen cycle…</p>
        ) : total === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">
            No linen has passed the {days}-day window.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {shown.map(linen => {
              const elapsed = daysSince(linen.last_scanned_date)
              const category = classifyLinen({
                linen_id: linen.linen_id,
                category: linen.category,
                item_type: linen.item_type,
                description: linen.description,
                size: linen.size,
              })
              return (
                <li key={linen.id} className="scan-soft-row min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--text-primary)]">
                      {linen.linen_id}
                    </span>
                    <Badge tone="warning" size="xs">{statusLabel(linen.status)}</Badge>
                  </div>
                  <p className="mt-1 break-words text-[11px] text-[var(--text-secondary)]">
                    {CATEGORY_LABEL[category]}
                    {linen.client_name ? ` · ${linen.client_name}` : ''}
                  </p>
                  <p className="mt-0.5 break-words text-[11px] tabular-nums text-[var(--text-muted)]">
                    Last scan: {elapsed === null ? 'never' : elapsed === 0 ? 'today' : `${elapsed} day${elapsed === 1 ? '' : 's'} ago`}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {total > shown.length && (
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">
            + {total - shown.length} more in the linen inventory.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function VerificationBadge({ state }: { state?: VerificationState }) {
  if (state === 'verified') {
    return <Badge tone="success" size="xs" dot><ShieldCheck size={10} /> Verified</Badge>
  }
  if (state === 'unverified') {
    return <Badge tone="danger" size="xs" dot title="This code is not registered in this laundry"><ShieldAlert size={10} /> Fake QR</Badge>
  }
  return <Badge tone="neutral" size="xs" dot>Checking</Badge>
}

function LiveBadge({ live }: { live?: LinenLiveUpdate }) {
  if (!live) return null
  return (
    <Badge
      tone="success"
      size="xs"
      dot
      title={`${live.event}${live.status ? ` · ${statusLabel(live.status)}` : ''} · ${timeOfDay(live.at)}`}
    >
      <Radio size={10} /> Live
    </Badge>
  )
}

interface SessionHistoryProps {
  records: ScanRecord[]
  total: number
  filter: string
  setFilter: (value: string) => void
  compact?: boolean
}

function SessionHistory({ records, total, filter, setFilter, compact }: SessionHistoryProps) {
  return (
    <Card className="border border-[var(--border)] shadow-sm">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Scan history {filter ? `(${records.length} of ${total})` : `(${total})`}
          </h2>
          <input
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder="Filter by code, category, status or result…"
            aria-label="Filter scan history"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] sm:w-56"
          />
        </div>

        {records.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--text-muted)]">
            {total ? 'No scan matches that filter.' : 'Nothing scanned yet — pass the first tag.'}
          </p>
        ) : (
          <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-0.5">
            {records.map((record, index) => {
              const tone = TONE_BADGE[OUTCOME_TONE[record.outcome]]
              const category = record.identity ? CATEGORY_LABEL[classifyLinen(record.identity)] : null
              return (
                <li
                  key={`${record.code}-${record.attemptedAt}-${index}`}
                  className="scan-soft-row min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-all font-[family-name:var(--font-mono)] text-xs font-semibold text-[var(--text-primary)]">
                        {record.code}
                      </p>
                      <p className="mt-0.5 break-words text-[11px] text-[var(--text-muted)]">
                        {category ?? 'Category pending'}
                        {record.identity?.client_name ? ` · ${record.identity.client_name}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {record.outcome === 'unreadable' ? (
                        <Badge tone="warning" size="xs">Invalid read</Badge>
                      ) : (
                        <VerificationBadge state={record.verification} />
                      )}
                      <LiveBadge live={record.live} />
                      <Badge tone={tone} size="xs">
                        {record.outcome === 'success' && <CheckCircle2 size={10} />}
                        {OUTCOME_LABEL[record.outcome]}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
                    <span className="break-words">
                      {record.message ?? (record.outcome === 'queued' ? 'Held locally until OK' : '—')}
                    </span>
                    <span className="inline-flex break-words items-center gap-1 tabular-nums">
                      {statusLabel(record.fromStatus)} <ArrowRight size={10} /> {statusLabel(record.toStatus)}
                    </span>
                    {record.live && (
                      <span className="break-words text-[var(--info-text)]">
                        Live: {record.live.status ? statusLabel(record.live.status) : record.live.event} · {timeOfDay(record.live.at)}
                      </span>
                    )}
                    <span className="tabular-nums sm:ml-auto">{timeOfDay(record.attemptedAt)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
