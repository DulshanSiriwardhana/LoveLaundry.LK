import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRight, CaretLeft, CaretRight, ClipboardText, Clock, Flag, Package, Plus, Receipt, CalendarBlank,
  ArrowCounterClockwise, Truck, Wallet, CheckCircle, XCircle, WarningCircle, ShieldWarning,
  FileText, Pulse,
} from '@phosphor-icons/react'
import { cn } from '../../../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { StatCard } from '../../../components/ui/stat-card'
import { EmptyState } from '../../../components/ui/empty-state'
import { Notice } from '../../../components/ui/notice'
import { PageHeader } from '../../../components/ui/page-header'
import { Badge } from '../../../components/ui/badge'
import { Input, Select } from '../../../components/ui/input'
import { SmartConfirm } from '../../../components/ops/smart-confirm'
import { useGatePasses, useReopenLegacyBatch, invalidateDeliveryData } from '../../quotations/hooks/useGatePasses'
import { useDeliveries } from '../../quotations/hooks/useDeliveries'
import { usePendingGatePassItems } from '../../quotations/hooks/useNotifications'
import { returns as returnsApi } from '../../quotations/services/returns.service'
import type { ReturnCreate, ReturnItem } from '../../../types/operations'
import {
  useAdjustments, useApproveAdjustment, useRejectAdjustment,
  useCloseDay, useDayClose, useDayExpenses, useDayMoney, useEvents,
  usePendingGatePasses, usePendingResend, useReconciliationIssues,
} from '../hooks/useDailyOps'
import { opsKeys } from '../hooks/useDailyOps'
import type { Adjustment, DayCloseTotals } from '../services/ops.service'

// ── Date helpers (local calendar day, no timezone drift) ──────────────────────

function localISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return localISO(dt)
}

function dayOf(iso?: string | null): string {
  return iso ? String(iso).slice(0, 10) : ''
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(ts?: string): string {
  if (!ts) return ''
  const dt = new Date(ts)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtMoney(n: number): string {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })
}

const EVENT_LABEL: Record<string, string> = {
  GATEPASS_CREATED: 'Gate pass received',
  GATEPASS_STATUS_CHANGED: 'Gate pass status changed',
  DELIVERY_CREATED: 'Delivery dispatched',
  BILL_CREATED: 'Bill created',
  PAYMENT_RECORDED: 'Payment recorded',
  ADJUSTMENT_REQUESTED: 'Adjustment requested',
  ADJUSTMENT_APPROVED: 'Adjustment approved',
  ADJUSTMENT_REJECTED: 'Adjustment rejected',
  RETURN_RECORDED: 'Return recorded',
  DAY_CLOSED: 'Day closed',
}

function eventLabel(type: string): string {
  return EVENT_LABEL[type] || type.replace(/_/g, ' ').toLowerCase()
}

// ── Quick actions ─────────────────────────────────────────────────────────────

/**
 * QuickActions — the six things an operator does in a shift.
 *
 * One visual treatment for all six. Previously each action had its own fill
 * colour, which meant the most important thing on the page was decided by hue
 * rather than by use frequency, and the row read as five competing buttons.
 * `Receive` and `Deliver` — the two that actually run the floor — are marked
 * with a badge instead of a fill.
 */
const QUICK_ACTIONS = [
  { to: '/gate-passes/new', label: 'Receive', hint: 'New gate pass', icon: ClipboardText, primary: true },
  { to: '/deliveries/new', label: 'Deliver', hint: 'Record delivery', icon: Truck, primary: true },
  { to: '/bills/new', label: 'Bill', hint: 'Create bill', icon: FileText },
  { to: '/returns/new', label: 'Return', hint: 'Record return', icon: ArrowCounterClockwise },
  { to: '/management/expenses', label: 'Expense', hint: 'Record expense', icon: Receipt },
  { to: '/management/attendance-log', label: 'Attendance', hint: 'Log staff', icon: CalendarBlank },
]

function QuickActions() {
  return (
    <nav aria-label="Quick actions">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((a) => (
          <li key={a.to}>
            <Link
              to={a.to}
              className="flex h-full items-center gap-2.5 rounded-[8px] border border-[var(--border-2)] bg-[var(--surface)] px-3 py-2.5 transition-colors duration-100 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <a.icon size={16} aria-hidden className="shrink-0 text-[var(--text-muted)]" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">
                    {a.label}
                  </span>
                  {a.primary && (
                    <Badge size="xs" tone="brand">
                      Main
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[var(--text-faint)]">
                  {a.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ── Attention queue ───────────────────────────────────────────────────────────

function AttentionQueue() {
  const { data: adjustments, isLoading: loadingAdj } = useAdjustments('REQUESTED')
  const { data: recon, isLoading: loadingRecon } = useReconciliationIssues()
  const approve = useApproveAdjustment()
  const reject = useRejectAdjustment()
  const batchReopen = useReopenLegacyBatch()
  const [confirm, setConfirm] = useState<{ adjustment: Adjustment; action: 'approve' | 'reject' } | null>(null)
  const [batchConfirm, setBatchConfirm] = useState(false)

  const pendingAdj = adjustments ?? []
  const issues = recon?.items ?? []
  const legacyCount = issues.filter(i => i.legacy_marked).length
  const clear = pendingAdj.length === 0 && issues.length === 0

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldWarning size={16} aria-hidden className="text-[var(--text-faint)]" />
          Needs attention
        </CardTitle>
        {!clear && (
          <Badge tone="danger" size="xs" dot>
            {pendingAdj.length + issues.length} open
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loadingAdj || loadingRecon ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : clear ? (
          <Notice tone="success" title="All clear">
            No pending adjustments and no reconciliation issues.
          </Notice>
        ) : (
          <>
            {pendingAdj.length > 0 && (
              <div>
                <p className="section-label">Quantity adjustments awaiting approval</p>
                <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[7px] border border-[var(--border)]">
                  {pendingAdj.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {a.item_name}
                          {a.specification && (
                            <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                              {a.specification}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[12px] text-[var(--text-muted)]">
                          <span className="tabular-nums">
                            {a.original_qty} → {a.corrected_qty}
                          </span>
                          {a.reason && ` · ${a.reason}`}
                          {a.requested_by && ` · by ${a.requested_by}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirm({ adjustment: a, action: 'reject' })}
                          aria-label={`Reject adjustment for ${a.item_name}`}
                        >
                          <XCircle size={15} aria-hidden />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ adjustment: a, action: 'approve' })}
                          aria-label={`Approve adjustment for ${a.item_name}`}
                        >
                          <CheckCircle size={15} aria-hidden />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {issues.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="section-label">Reconciliation issues</p>
                  {legacyCount > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setBatchConfirm(true)}
                      disabled={batchReopen.isPending}
                      title="Reopen every pass closed by the old note flow with no delivery records"
                    >
                      <ArrowCounterClockwise size={14} aria-hidden />
                      {batchReopen.isPending ? 'Reopening…' : `Reopen ${legacyCount} legacy`}
                    </Button>
                  )}
                </div>
                <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-[7px] border border-[var(--border)]">
                  {issues.slice(0, 8).map((row) => (
                    <li key={row.id}>
                      <Link
                        to={`/gate-passes/${row.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 hover:bg-[var(--surface-hover)]"
                      >
                        <WarningCircle size={15} aria-hidden className="shrink-0 text-[var(--warning-text)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                            #{row.gate_pass_number} · {row.client_name}
                          </p>
                          <p className="truncate text-[12px] text-[var(--text-muted)]">
                            {row.issues.map((i) => i.code).join(', ')}
                            {row.legacy_marked && ' · legacy marked'}
                          </p>
                        </div>
                        <CaretRight size={14} aria-hidden className="shrink-0 text-[var(--text-faint)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>

      <SmartConfirm
        open={Boolean(confirm)}
        title={confirm?.action === 'approve' ? 'Approve adjustment?' : 'Reject adjustment?'}
        message={
          confirm
            ? `${confirm.adjustment.item_name}${confirm.adjustment.specification ? ` (${confirm.adjustment.specification})` : ''} — ${confirm.adjustment.reason}`
            : undefined
        }
        changes={
          confirm && confirm.action === 'approve'
            ? [{ label: 'Received quantity', from: confirm.adjustment.original_qty, to: confirm.adjustment.corrected_qty }]
            : undefined
        }
        confirmLabel={confirm?.action === 'approve' ? 'Approve' : 'Reject'}
        loading={approve.isPending || reject.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          const done = () => setConfirm(null)
          if (confirm.action === 'approve') approve.mutate(confirm.adjustment.id, { onSuccess: done, onError: done })
          else reject.mutate(confirm.adjustment.id, { onSuccess: done, onError: done })
        }        }
      />

      <SmartConfirm
        open={batchConfirm}
        title={legacyCount > 0 ? `Reopen ${legacyCount} legacy gate pass${legacyCount !== 1 ? 'es' : ''}?` : 'Reopen legacy gate passes?'}
        message="These passes were closed by the old note flow with no delivery records — their balances are hidden and they do not appear in Pending to Deliver. Reopening flags each legacy closure in the journal (LEGACY_CLOSED_WITHOUT_DELIVERY) and moves them back to Received. No quantities are fabricated."
        confirmLabel="Reopen all eligible"
        loading={batchReopen.isPending}
        onCancel={() => setBatchConfirm(false)}
        onConfirm={() => {
          setBatchConfirm(false)
          batchReopen.mutate()
        }}
      />
    </Card>
  )
}

// ── Pending deliveries ────────────────────────────────────────────────────────

function PendingDeliveries() {
  const { data, isLoading } = usePendingGatePasses()
  const rows = (data ?? []).filter(r => r.total_pending > 0)

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <Package size={16} aria-hidden className="text-[var(--text-faint)]" />
          Pending to deliver
        </CardTitle>
        {rows.length > 0 && (
          <Button asChild size="sm">
            <Link to="/deliveries/new">
              <Truck size={14} aria-hidden />
              Deliver
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            bare
            icon={<Truck size={18} />}
            title="Nothing pending"
            description="Every received item has been delivered."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <li key={r.gate_pass_id}>
                <Link
                  to={`/gate-passes/${r.gate_pass_id}`}
                  className="-mx-1 flex items-center gap-3 rounded-[6px] px-1 py-2.5 transition-colors duration-100 hover:bg-[var(--surface-hover)]"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] border border-[var(--warning-border)] bg-[var(--warning-soft)] text-[11px] font-semibold tabular-nums text-[var(--warning-text)]">
                    {r.total_pending}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                      {r.client_name}
                    </span>
                    <span className="block truncate text-[12px] text-[var(--text-muted)]">
                      #{r.gate_pass_number} ·{' '}
                      {r.items
                        .filter((i) => i.pending_qty > 0)
                        .map((i) => `${i.item_name} ×${i.pending_qty}`)
                        .join(', ')}
                    </span>
                  </span>
                  <CaretRight size={14} aria-hidden className="shrink-0 text-[var(--text-faint)]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Day money ─────────────────────────────────────────────────────────────────

const MONEY_TONE: Record<string, string> = {
  green: 'text-[var(--success-text)]',
  amber: 'text-[var(--warning-text)]',
  red: 'text-[var(--danger-text)]',
}

/**
 * A figure, not a tile. Money is a ledger, so these read as label-over-value
 * rows with a hairline frame rather than as coloured cards; the accent colour
 * is only applied when the number itself is the message.
 */
function MoneyTile({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'amber' | 'red' }) {
  return (
    <div className="rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className={cn('mt-0.5 text-[16px] font-semibold tabular-nums', accent ? MONEY_TONE[accent] : 'text-[var(--text-primary)]')}>
        {fmtMoney(value)}
      </p>
    </div>
  )
}

function ReturnsOwedCard() {
  const { data: pending, isLoading } = usePendingResend()

  const records = (pending ?? []) as Array<{ return_id: string; client_name: string; items: Array<{ item_name: string; returned_qty: number }>; created_at: string }>
  const owedPieces = records.reduce(
    (sum, r) => sum + (Array.isArray(r.items) ? r.items.reduce((t, i) => t + (i.returned_qty || 0), 0) : 0),
    0,
  )

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <ArrowCounterClockwise size={16} aria-hidden className="text-[var(--text-faint)]" />
          Returns owed to clients
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : records.length === 0 ? (
          <Notice tone="success">No pending resends — every return item is settled.</Notice>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[var(--text-muted)]">
              <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                {owedPieces}
              </span>{' '}
              piece{owedPieces !== 1 ? 's' : ''} still owed across {records.length} return
              {records.length !== 1 ? 's' : ''}
            </p>
            <ul className="divide-y divide-[var(--border)]">
              {records.slice(0, 4).map((r) => (
                <li key={r.return_id} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                  <span className="truncate font-medium text-[var(--text-primary)]">{r.client_name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
                    {Array.isArray(r.items) ? r.items.reduce((t, i) => t + (i.returned_qty || 0), 0) : 0} pcs
                  </span>
                </li>
              ))}
            </ul>
            <Button asChild variant="link" size="sm">
              <Link to="/returns">
                Review returns
                <ArrowRight size={13} aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TodayMoney({ date }: { date: string }) {
  const { data: money, isLoading } = useDayMoney(date)
  const { data: expenseRows } = useDayExpenses(date)
  const expenses = ((expenseRows ?? []) as any[]).reduce((sum, item) => sum + (item.total || 0), 0)
  const outstanding = money?.outstanding_amount ?? 0
  const net = (money?.collected_amount ?? 0) - expenses

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <Wallet size={16} aria-hidden className="text-[var(--text-faint)]" />
          Money for the day
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MoneyTile label="Billed today" value={money?.billed_amount ?? 0} />
              <MoneyTile label="Collected today" value={money?.collected_amount ?? 0} accent="green" />
              <MoneyTile label="Expenses today" value={expenses} accent="red" />
              <MoneyTile label="Net for day" value={net} accent={net < 0 ? 'amber' : undefined} />
            </div>
            <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--border)] pt-2.5 text-[12px] text-[var(--text-muted)]">
              <div className="flex items-baseline gap-1.5">
                <dt>Outstanding receivable</dt>
                <dd className={cn('font-semibold tabular-nums', outstanding > 0 ? 'text-[var(--warning-text)]' : 'text-[var(--text-primary)]')}>
                  {fmtMoney(outstanding)}
                </dd>
                <span>across {money?.open_bills_count ?? 0} open bills</span>
              </div>
              {money && (
                <div className="hidden items-baseline gap-1.5 sm:flex">
                  <dt>
                    {money.bills_created} bill{money.bills_created !== 1 ? 's' : ''} created
                  </dt>
                  <dd aria-hidden>·</dd>
                  <dt className="sr-only">Payments recorded</dt>
                  <dd>
                    {money.payments_count} payment{money.payments_count !== 1 ? 's' : ''} recorded
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Fast return entry ─────────────────────────────────────────────────────────

const RETURN_ACTIONS_FAST = [
  { value: 'RECEIVE_BACK', label: 'Receive Back' },
  { value: 'RE_WASH', label: 'Re-wash' },
  { value: 'DISCARD', label: 'Discard' },
  { value: 'COMPENSATE', label: 'Compensate' },
]

const RETURN_REASONS_FAST = [
  { value: 'WRONG_ITEM', label: 'Wrong item' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'MISSING', label: 'Missing' },
  { value: 'OTHER', label: 'Other' },
]

interface ReturnLine {
  qty: number
  action: string
  reason: string
}

const gpItemKey = (name: string, spec?: string) => `${name}||${spec ?? ''}`

function FastReturnCard() {
  const qc = useQueryClient()
  const { data: gatepasses } = useGatePasses()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [gpId, setGpId] = useState<string>('')
  const [lines, setLines] = useState<Record<string, ReturnLine>>({})

  const create = useMutation({
    mutationFn: (body: ReturnCreate) => returnsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: opsKeys.all })
      invalidateDeliveryData(qc)
      toast.success('Return recorded')
      setGpId('')
      setLines({})
      setSearch('')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail || e?.message || 'Failed to record return'),
  })

  const gp = (gatepasses ?? []).find(g => g.id === gpId) || null

  const matches = (gatepasses ?? [])
    .filter(g => g.status && g.status !== 'CANCELLED')
    .filter(g => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        String(g.gate_pass_number ?? '').toLowerCase().includes(q) ||
        String(g.client_name ?? '').toLowerCase().includes(q)
      )
    })
    .slice(0, 8)

  const totalQty = Object.values(lines).reduce((s, l) => s + l.qty, 0)

  const updateLine = (key: string, patch: Partial<ReturnLine>) =>
    setLines(prev => {
      const base = prev[key] ?? { qty: 0, action: 'RECEIVE_BACK', reason: 'OTHER' }
      return { ...prev, [key]: { ...base, ...patch } }
    })

  const submit = () => {
    if (!gp) return
    const items: ReturnItem[] = Object.entries(lines)
      .filter(([, l]) => l.qty > 0)
      .map(([key, l]) => {
        const [name, spec] = key.split('||')
        const pendingResend = l.action === 'RECEIVE_BACK' || l.action === 'RE_WASH'
        return {
          item_name: name,
          specification: spec || undefined,
          returned_qty: l.qty,
          action: l.action as any,
          reason: l.reason as any,
          condition: 'GOOD' as any,
          resend_status: pendingResend ? ('PENDING' as const) : undefined,
        }
      })
    if (items.length === 0) {
      toast.error('Enter a quantity for at least one item')
      return
    }
    create.mutate({
      gate_pass_id: gp.id!,
      client_name: gp.client_name,
      items: items as any,
    })
  }

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <ArrowCounterClockwise size={16} aria-hidden className="text-[var(--text-faint)]" />
          Fast return entry
        </CardTitle>
        <Button size="sm" variant={open ? 'ghost' : 'secondary'} onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : 'Quick return'}
          {!open && <Plus size={14} aria-hidden />}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="pt-4 space-y-4">
          {!gp ? (
            <div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search gate pass number or client…"
                aria-label="Search gate passes"
              />
              <div className="mt-2 max-h-52 divide-y divide-[var(--border)] overflow-y-auto rounded-[7px] border border-[var(--border)]">
                {matches.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGpId(g.id!)}
                    className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left transition-colors duration-100 hover:bg-[var(--surface-hover)]"
                  >
                    <span className="min-w-0">
                      <span className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-muted)]">
                        #{g.gate_pass_number}
                      </span>
                      <span className="ml-2 truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {g.client_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                      {(g.items ?? []).reduce((s, i) => s + (i.received_qty || 0), 0)} pcs
                    </span>
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="px-3 py-4 text-center text-[12px] text-[var(--text-muted)]">
                    No gate passes match
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 rounded-[7px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                    #{gp.gate_pass_number} · {gp.client_name}
                  </p>
                  <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
                    {(gp.items ?? []).reduce((s, i) => s + (i.received_qty || 0), 0)} pcs received
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setGpId('')}>
                  Clear
                </Button>
              </div>

              <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[7px] border border-[var(--border)]">
                {(gp.items ?? []).filter(i => (i.received_qty || 0) > 0).map(it => {
                  const key = gpItemKey(it.item_name, it.specification)
                  const line = lines[key] ?? { qty: 0, action: 'RECEIVE_BACK', reason: 'OTHER' }
                  const max = it.received_qty || 0
                  return (
                    <div key={key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {it.item_name}
                          {it.specification && (
                            <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
                              {it.specification}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] tabular-nums text-[var(--text-muted)]">{max} received</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={max}
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(key, { qty: Math.min(max, parseInt(e.target.value) || 0) })
                          }
                          aria-label={`Quantity to return for ${it.item_name}`}
                          className="h-8 w-16 text-right"
                        />
                        <Select
                          value={line.action}
                          onChange={(e) => updateLine(key, { action: e.target.value })}
                          aria-label={`Action for ${it.item_name}`}
                          className="h-8 w-[7.5rem] text-[12px]"
                        >
                          {RETURN_ACTIONS_FAST.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </Select>
                        <Select
                          value={line.reason}
                          onChange={(e) => updateLine(key, { reason: e.target.value })}
                          aria-label={`Reason for ${it.item_name}`}
                          title="Reason"
                          className="hidden h-8 w-[7.5rem] text-[12px] sm:block"
                        >
                          {RETURN_REASONS_FAST.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] tabular-nums text-[var(--text-muted)]">
                  {totalQty} piece{totalQty !== 1 ? 's' : ''} to return
                </p>
                <Button variant="warning" disabled={create.isPending || totalQty === 0} onClick={submit}>
                  <ArrowCounterClockwise size={15} aria-hidden />
                  {create.isPending ? 'Recording…' : 'Record return'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── Daily timeline ────────────────────────────────────────────────────────────

function DailyTimeline({ date }: { date: string }) {
  const { data, isLoading } = useEvents(date)
  const events = data ?? []

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <Pulse size={16} aria-hidden className="text-[var(--text-faint)]" />
          Activity timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            bare
            icon={<Clock size={18} />}
            title="No activity recorded"
            description="Movements for this day will appear here as they are entered."
          />
        ) : (
          <ol className="relative">
            {/* A single hairline spine ties the entries together; each event is
                a dot on it, so the column reads as one day rather than a stack
                of unrelated rows. */}
            <span aria-hidden className="absolute top-2 bottom-2 left-[3.25rem] w-px bg-[var(--border)]" />
            {events.map((e, i) => (
              <li key={e.id || i} className="relative flex items-start gap-3 py-1.5">
                <span className="w-11 shrink-0 pt-0.5 text-right text-[11px] font-medium tabular-nums text-[var(--text-faint)]">
                  {fmtTime(e.occurred_at)}
                </span>
                <span
                  aria-hidden
                  className="relative z-1 mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand)] ring-3 ring-[var(--surface)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-[var(--text-primary)]">
                    <span className="font-medium">{eventLabel(e.event_type)}</span>
                    {e.item_deltas && e.item_deltas.length > 0 && (
                      <span className="text-[var(--text-muted)]">
                        {' · '}
                        {e.item_deltas
                          .map((d) => `${d.item_name} ${d.before ?? '—'}→${d.after ?? '—'}`)
                          .join(', ')}
                      </span>
                    )}
                  </p>
                  {(e.user_name || e.reason) && (
                    <p className="truncate text-[11px] text-[var(--text-faint)]">
                      {e.user_name || 'system'}
                      {e.reason ? ` · ${e.reason}` : ''}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

// ── Close day ─────────────────────────────────────────────────────────────────

function useDayTotals(date: string) {
  const { data: gatepasses } = useGatePasses()
  const { data: deliveries } = useDeliveries()
  const { data: adjustments } = useAdjustments('REQUESTED')
  const { data: recon } = useReconciliationIssues()
  const { data: money } = useDayMoney(date)
  const { data: expenseRows } = useDayExpenses(date)
  const { data: pendingItems } = usePendingGatePassItems()

  return useMemo<DayCloseTotals>(() => {
    const gps = (gatepasses ?? []).filter(
      gp => dayOf(gp.receiving_date) === date && gp.status !== 'CANCELLED',
    )
    const piecesReceived = gps.reduce(
      (sum, gp) => sum + (gp.items ?? []).reduce((s, it) => s + (it.received_qty || 0), 0),
      0,
    )
    const dels = (deliveries ?? []).filter(
      d => dayOf(d.delivery_date) === date && d.status !== 'CANCELLED',
    )
    const piecesDelivered = dels.reduce(
      (sum, d) => sum + (d.items ?? []).reduce((s, it) => s + (it.quantity || 0), 0),
      0,
    )
    // Outstanding is a *balance* figure, so it comes from the server rather than
    // being rebuilt here. This used to credit every delivery line to the
    // delivery's own gate_pass_id, so a delivery spanning two passes put every
    // piece on one of them and made the other look fully outstanding — and it
    // ignored returns, so pieces already given back still looked owed.
    const piecesOutstanding = (pendingItems ?? []).reduce((sum, e) => {
      if (dayOf(e.receiving_date) !== date) return sum
      return sum + (e.pending || 0)
    }, 0)
    const expenses = ((expenseRows ?? []) as any[]).reduce((sum, item) => sum + (item.total || 0), 0)
    return {
      gate_pass_count: gps.length,
      pieces_received: piecesReceived,
      delivery_count: dels.length,
      pieces_delivered: piecesDelivered,
      pieces_outstanding: piecesOutstanding,
      pending_adjustments: (adjustments ?? []).length,
      reconciliation_issues: (recon?.items ?? []).length,
      billed_amount: money?.billed_amount ?? 0,
      collected_amount: money?.collected_amount ?? 0,
      expenses_amount: expenses,
      outstanding_amount: money?.outstanding_amount ?? 0,
    }
  }, [gatepasses, deliveries, adjustments, recon, date, money, expenseRows, pendingItems])
}

const DAY_TOTAL_ROWS: { key: keyof DayCloseTotals; label: string; flag?: 'ok' | 'warn' }[] = [
  { key: 'gate_pass_count', label: 'Gate passes received' },
  { key: 'pieces_received', label: 'Pieces received' },
  { key: 'delivery_count', label: 'Deliveries recorded' },
  { key: 'pieces_delivered', label: 'Pieces delivered' },
  { key: 'pieces_outstanding', label: 'Pieces outstanding', flag: 'warn' },
]

const DAY_MONEY_ROWS: { key: keyof DayCloseTotals; label: string; accent?: 'green' | 'amber' | 'red' }[] = [
  { key: 'billed_amount', label: 'Billed' },
  { key: 'collected_amount', label: 'Collected', accent: 'green' },
  { key: 'expenses_amount', label: 'Expenses', accent: 'red' },
]

function CloseDayCard({ date }: { date: string }) {
  const totals = useDayTotals(date)
  const { data: closed, isLoading: loadingClosed } = useDayClose(date)
  const close = useCloseDay()
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)

  const isFuture = date > localISO()
  const openFlags = totals.pending_adjustments + totals.reconciliation_issues
  const closedAt = closed && typeof closed.meta === 'object' && closed.meta
    ? String((closed.meta as { closed_at?: string }).closed_at ?? '')
    : ''

  const summaryRows = DAY_TOTAL_ROWS.map(row => ({ ...row, value: totals[row.key] }))
  const netForDay = totals.collected_amount - totals.expenses_amount
  const moneyTiles = [
    ...DAY_MONEY_ROWS.map(row => ({ ...row, value: totals[row.key] as number })),
    { key: 'net', label: 'Net for day', accent: (netForDay < 0 ? 'amber' : 'green') as 'amber' | 'green', value: netForDay },
  ]

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2">
          <Flag size={16} aria-hidden className="text-[var(--text-faint)]" />
          Close day
        </CardTitle>
        {closed && (
          <Badge tone="success" size="xs" dot>
            Closed{closedAt ? ` · ${fmtTime(closedAt)}` : ''}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {loadingClosed ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {summaryRows.map((row) => (
                <div key={row.key} className="rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <dt className="text-[11px] text-[var(--text-muted)]">{row.label}</dt>
                  <dd
                    className={cn(
                      'mt-0.5 text-[16px] font-semibold tabular-nums',
                      row.flag === 'warn' && row.value > 0
                        ? 'text-[var(--warning-text)]'
                        : 'text-[var(--text-primary)]',
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="section-label mb-2">Money for the day</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {moneyTiles.map((tile) => (
                  <MoneyTile key={tile.key} label={tile.label} value={tile.value} accent={tile.accent} />
                ))}
              </div>
            </div>

            {openFlags > 0 && (
              <Notice tone="warning">
                {totals.pending_adjustments} pending adjustment
                {totals.pending_adjustments !== 1 ? 's' : ''}
                {totals.pending_adjustments > 0 && totals.reconciliation_issues > 0 ? ' and ' : ''}
                {totals.reconciliation_issues > 0
                  ? `${totals.reconciliation_issues} reconciliation issue${totals.reconciliation_issues !== 1 ? 's' : ''}`
                  : ''}{' '}
                still open. Resolve them in Needs attention before closing.
              </Notice>
            )}

            {closed && (
              <Notice tone="success" title="Day already closed">
                Re-close to record a fresh snapshot of the current numbers.
                {closed.reason ? ` Note: “${closed.reason}”` : ''}
              </Notice>
            )}

            {isFuture && (
              <Notice tone="neutral">
                This is a future day — pick today or an earlier day to close.
              </Notice>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note for this day's close (e.g. late deliveries due)"
                aria-label="Closing note"
                className="flex-1"
              />
              <Button
                disabled={close.isPending || isFuture}
                title={isFuture ? 'Can close past or today’s day — not a future day' : undefined}
                onClick={() => setConfirm(true)}
              >
                <Flag size={15} aria-hidden />
                {closed ? 'Re-close day' : 'Close day'}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <SmartConfirm
        open={confirm}
        title={closed ? 'Re-close the day?' : 'Close the day?'}
        message="This writes an end-of-day snapshot into the journal; the numbers below are frozen at this moment."
        changes={[
          ...summaryRows.map(row => ({ label: row.label, from: row.value, to: row.value })),
          ...moneyTiles.map(tile => ({ label: tile.label, from: fmtMoney(tile.value), to: fmtMoney(tile.value) })),
          ...(openFlags > 0
            ? [{ label: 'Open items needing attention', from: openFlags, to: openFlags }]
            : []),
        ]}
        confirmLabel={closed ? 'Re-close day' : 'Close day'}
        loading={close.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false)
          close.mutate({ date, totals, note: note.trim() || undefined })
        }}
      />
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const [date, setDate] = useState(localISO())
  const isToday = date === localISO()

  const { data: gatepasses } = useGatePasses()
  const { data: deliveries } = useDeliveries()
  const { data: adjustments } = useAdjustments('REQUESTED')
  const { data: recon } = useReconciliationIssues()

  const kpis = useMemo(() => {
    const gps = (gatepasses ?? []).filter(
      gp => dayOf(gp.receiving_date) === date && gp.status !== 'CANCELLED',
    )
    const itemsReceived = gps.reduce(
      (sum, gp) => sum + (gp.items ?? []).reduce((s, it) => s + (it.received_qty || 0), 0),
      0,
    )
    const dels = (deliveries ?? []).filter(
      d => dayOf(d.delivery_date) === date && d.status !== 'CANCELLED',
    )
    const itemsDelivered = dels.reduce(
      (sum, d) => sum + (d.items ?? []).reduce((s, it) => s + (it.quantity || 0), 0),
      0,
    )
    return {
      gatePasses: gps.length,
      itemsReceived,
      deliveries: dels.length,
      itemsDelivered,
      pendingAdjustments: (adjustments ?? []).length,
      reconIssues: (recon?.items ?? []).length,
    }
  }, [gatepasses, deliveries, adjustments, recon, date])

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title={isToday ? 'Today' : fmtDay(date)}
        subtitle={
          isToday
            ? `${fmtDay(date)} · Love Laundry daily operations`
            : 'Reviewing a past day'
        }
        actions={<DateStepper date={date} onChange={setDate} isToday={isToday} />}
      />

      <QuickActions />

      <section aria-label="Volume for the day" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Gate passes in" value={kpis.gatePasses} to="/gate-passes" />
        <StatCard label="Items received" value={kpis.itemsReceived} to="/gate-passes" />
        <StatCard label="Deliveries out" value={kpis.deliveries} to="/deliveries" />
        <StatCard label="Items delivered" value={kpis.itemsDelivered} to="/deliveries" />
        <StatCard
          label="Pending adjustments"
          value={kpis.pendingAdjustments}
          tone={kpis.pendingAdjustments > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          label="Reconciliation issues"
          value={kpis.reconIssues}
          tone={kpis.reconIssues > 0 ? 'danger' : 'neutral'}
        />
      </section>

      <TodayMoney date={date} />

      <ReturnsOwedCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionQueue />
        <PendingDeliveries />
      </div>

      <FastReturnCard />

      <DailyTimeline date={date} />

      <CloseDayCard date={date} />

      <div className="flex justify-end">
        <Button asChild variant="secondary" size="sm">
          <Link to="/dashboard">Open full dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

/**
 * DateStepper — previous / date / next, plus a way back to today.
 *
 * `max` is pinned to today because the daily-operations figures are a running
 * ledger: there is no "future day" of movements to look at, and allowing one
 * invites closing a day that has not happened. A disabled next button says
 * that far better than a silent no-op.
 */
function DateStepper({
  date,
  onChange,
  isToday,
}: {
  date: string
  onChange: (d: string) => void
  isToday: boolean
}) {
  const atToday = date >= localISO()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="secondary"
        size="icon"
        onClick={() => onChange(shiftISO(date, -1))}
        aria-label="Previous day"
      >
        <CaretLeft size={15} aria-hidden />
      </Button>

      <label className="sr-only" htmlFor="ops-day">
        Operating day
      </label>
      <Input
        id="ops-day"
        type="date"
        value={date}
        max={localISO()}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-8 w-[9.5rem] text-[12.5px]"
      />

      <Button
        variant="secondary"
        size="icon"
        onClick={() => onChange(shiftISO(date, 1))}
        disabled={atToday}
        aria-label="Next day"
        title={atToday ? 'Already at today' : undefined}
      >
        <CaretRight size={15} aria-hidden />
      </Button>

      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(localISO())}>
          Today
        </Button>
      )}
    </div>
  )
}
