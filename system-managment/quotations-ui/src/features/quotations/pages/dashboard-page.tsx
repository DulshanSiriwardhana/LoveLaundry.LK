import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, AlertTriangle, TrendingUp, Users, Package, Clock,
  Download, Activity, ArrowUpRight, ArrowDownRight,
  BarChart3, Target, Layers, Timer, Eye, Truck,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, Bar, Legend, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Avatar } from '../../../components/ui/avatar'
import { Badge } from '../../../components/ui/badge'
import { Notice } from '../../../components/ui/notice'
import { Tabs } from '../../../components/ui/tabs'
import { DataTable } from '../../../components/ui/data-table'
import { DropdownMenu } from '../../../components/ui/dropdown-menu'
import { PageHeader } from '../../../components/ui/page-header'
import { Skeleton } from '../../../components/ui/skeleton'
import { StatCard } from '../../../components/ui/stat-card'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { useDashboardOverview, type DashboardOverviewData, type DashboardPeriod } from '../hooks/useBusinessDashboard'
import { reports } from '../services/reports.service'
import { BalancesPopup } from '../components/balances-popup'
import { toast } from 'sonner'

const TOOLTIP_STYLE = {
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  fontSize: 12,
  boxShadow: '0 4px 12px rgb(16 24 40 / 0.08)',
} as const

const EXPORT_TARGETS = [
  ['gatepasses', 'Gate Passes'],
  ['bills', 'Bills'],
  ['deliveries', 'Deliveries'],
] as const

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

function pctNum(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return ((cur - prev) / Math.max(1, prev)) * 100
}

function fmt(lkr: number) {
  if (lkr >= 1_000_000) return `${(lkr / 1_000_000).toFixed(1)}M`
  if (lkr >= 1_000) return `${(lkr / 1_000).toFixed(1)}K`
  return lkr.toFixed(0)
}

function ActionBadge({ action }: { action: string }) {
  const a = (action || '').toUpperCase()
  const tone = a.includes('DELETE') || a.includes('REMOVE') || a.includes('CANCEL')
    ? 'danger'
    : a.includes('CREATE') || a.includes('ADD') || a.includes('PAYMENT')
      ? 'success'
      : 'neutral'
  return <Badge size="xs" tone={tone} mono>{a.replace(/_/g, ' ')}</Badge>
}

function fmtTimeAgo(ts: string | null) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── KPI Cards ────────────────────────────────────────────────────────────────

function KpiCards({ data }: { data: DashboardOverviewData }) {
  const { current: c, previous: p } = data
  const kpis = [
    { label: 'Revenue', value: `LKR ${fmt(c.revenue)}`, trend: pctNum(c.revenue, p.revenue), to: '/bills' },
    { label: 'Collected', value: `LKR ${fmt(c.collected)}`, trend: pctNum(c.collected, c.collected), to: '/bills' },
    { label: 'Outstanding', value: `LKR ${fmt(c.outstanding)}`, trend: pctNum(c.outstanding, c.outstanding), to: '/bills' },
    { label: 'Collection Rate', value: `${c.collectionRate.toFixed(1)}%`, trend: pctNum(c.collectionRate, c.collectionRate), to: '/bills' },
    { label: 'Gate Passes', value: c.gatePasses, trend: pctNum(c.gatePasses, p.gatePasses), to: '/gate-passes' },
    { label: 'Active Clients', value: c.activeClients, trend: pctNum(c.activeClients, c.activeClients), to: '/customers' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {kpis.map((k) => (
        <StatCard key={k.label} label={k.label} value={k.value} trend={k.trend} to={k.to} />
      ))}
    </div>
  )
}

// ── Charts Row ───────────────────────────────────────────────────────────────

function ChartsRow({ data }: { data: DashboardOverviewData }) {
  const series = data.current.revenueSeries || []
  const pieData = (data.current.paymentStatus || []).filter(s => s.value > 0)

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* Revenue vs Collection */}
      <Card>
        <CardHeader className="border-b border-[var(--border)] pb-3">
          <CardTitle className="text-[14px]">Revenue vs Collection</CardTitle>
        </CardHeader>
        <CardContent className="h-[240px] pt-4">
          {series.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[13px]" style={{ color: 'var(--text-muted)' }}>No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success-text)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--success-text)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tick={{ fontSize: 10.5, fill: 'var(--text-muted)' }}
                  tickFormatter={(v: number) => fmt(v)}
                />
                <RechartsTooltip
                  cursor={{ stroke: 'var(--border-strong)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`LKR ${v.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand)" fill="url(#gradRevenue)" strokeWidth={2} name="Revenue" />
                <Area type="monotone" dataKey="collected" stroke="var(--success-text)" fill="url(#gradCollected)" strokeWidth={2} name="Collected" />
                <Legend wrapperStyle={{ fontSize: 11.5, color: 'var(--text-muted)' }} iconType="plainline" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payment status breakdown */}
      <Card>
        <CardHeader className="border-b border-[var(--border)] pb-3">
          <CardTitle className="text-[14px]">Payment Status</CardTitle>
        </CardHeader>
        <CardContent flush className="py-2">
          {pieData.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No bills yet</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {pieData.map((s) => {
                const total = pieData.reduce((a, b) => a + b.value, 0)
                const pct = total > 0 ? (s.value / total) * 100 : 0
                return (
                  <li key={s.name} className="px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] font-medium">{s.name}</span>
                      <span className="text-[12.5px] font-semibold tabular-nums">
                        LKR {fmt(s.value)}
                        <span className="ml-1.5 font-normal text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: s.color || 'var(--info-text)' }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Tables Row ───────────────────────────────────────────────────────────────

function TablesRow({ data }: { data: DashboardOverviewData }) {
  const topClients = (data.current.topClients || []).slice(0, 5)
  const allPendingGPs = data.current.pendingGatePasses || []
  const maxRevenue = Math.max(...topClients.map(c => c.revenue), 1)
  const totalPending = data.current.itemsPending || 0

  // Group pending by client
  const clientsMap = new Map<string, { items: { item_name: string; specification: string; pending: number }[]; total: number }>()
  for (const gp of allPendingGPs) {
    const client = gp.client_name
    if (!clientsMap.has(client)) clientsMap.set(client, { items: [], total: 0 })
    const entry = clientsMap.get(client)!
    for (const item of gp.items || []) {
      entry.items.push({ item_name: item.item_name, specification: item.specification || '', pending: item.pending })
      entry.total += item.pending
    }
  }
  const pendingClients = Array.from(clientsMap.entries())
    .sort((a, b) => b[1].total - a[1].total)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Top Clients */}
      <Card>
        <CardHeader className="border-b border-[var(--border)] pb-3">
          <CardTitle className="flex items-center gap-2 text-[14px]">
            <Users className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Top Clients
          </CardTitle>
        </CardHeader>
        <CardContent flush>
          <DataTable
            data={topClients}
            rowKey={(c) => c.client_name}
            stickyHeader={false}
            mobilePrimary={['client']}
            columns={[
              {
                key: 'client',
                header: 'Client',
                render: (c) => (
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={c.client_name} />
                    <span className="truncate font-medium">{c.client_name}</span>
                  </div>
                ),
              },
              {
                key: 'revenue',
                header: 'Revenue',
                numeric: true,
                render: (c) => (
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-semibold">LKR {fmt(c.revenue)}</span>
                    <div className="h-1.5 w-[60px] overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)]"
                        style={{ width: `${(c.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'outstanding',
                header: 'Outstanding',
                numeric: true,
                render: (c) => (
                  <span
                    className={
                      c.outstanding > 0
                        ? 'font-semibold text-[var(--warning-text)]'
                        : 'text-[var(--text-faint)]'
                    }
                  >
                    LKR {fmt(c.outstanding)}
                  </span>
                ),
              },
              {
                key: 'bills',
                header: 'Bills',
                numeric: true,
                render: (c) => <span className="text-[var(--text-muted)]">{c.bills}</span>,
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Pending Balance */}
      <Card className={totalPending > 0 ? 'border-[var(--warning-border)]' : ''}>
        <CardHeader className="border-b border-[var(--border)] pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <Package className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Pending Balance
            </CardTitle>
            {totalPending > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-[var(--warning-text)] tabular-nums">
                  {totalPending}
                </span>
                <Link to="/deliveries/new">
                  <Button size="sm" variant="primary">
                    <Truck className="h-3 w-3" /> Deliver
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          {pendingClients.length === 0 ? (
            <div className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>All deliveries are up to date</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {pendingClients.map(([client, data]) => (
                <div key={client} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={client} size="sm" />
                      <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{client}</span>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-[var(--warning-text)]">
                      {data.total}
                    </span>
                  </div>
                  <div className="ml-8 space-y-1">
                    {(data.items ?? []).map((item, j) => (
                      <div key={`${item.item_name}-${j}`} className="flex items-center gap-2 text-[12px]">
                        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{item.item_name}</span>
                        {item.specification && (
                          <Badge size="xs" tone="neutral">
                            {item.specification}
                          </Badge>
                        )}
                        <span className="font-semibold text-[var(--warning-text)]">{item.pending} pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Alerts ───────────────────────────────────────────────────────────────────

function AlertBanners({ data }: { data: DashboardOverviewData }) {
  if (data.alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {data.alerts.map((a) => (
        <Notice
          key={a.id}
          tone={a.severity === 'high' ? 'danger' : a.severity === 'medium' ? 'warning' : 'info'}
          icon={<AlertTriangle className="size-4" />}
        >
          {a.message}
        </Notice>
      ))}
    </div>
  )
}

// ── Recent Activity ──────────────────────────────────────────────────────────

function ActivityTimeline({ data }: { data: DashboardOverviewData }) {
  if (data.activity.length === 0) return null

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[14px]">
            <Activity className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Recent Activity
          </CardTitle>
          <Link to="/reports" className="text-[12px] font-medium hover:underline" style={{ color: 'var(--text-muted)' }}>
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-[var(--border)]">
          {data.activity.map((a, i) => (
            <div key={a.id || i} className="flex items-center gap-3 py-2.5">
              <ActionBadge action={a.action} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] truncate">
                  <span className="font-medium">{a.user_id}</span>
                  {' '}
                  <span style={{ color: 'var(--text-muted)' }}>{a.action.toLowerCase().replace(/_/g, ' ')}</span>
                  {' '}
                  {a.entity && <span className="font-medium">{a.entity}</span>}
                </p>
              </div>
              <span className="text-[11px] shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Clock className="h-3 w-3" />
                {fmtTimeAgo(a.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Balances Overview ────────────────────────────────────────────────────────

function BalancesOverview({ data, onShowDetails }: { data: DashboardOverviewData; onShowDetails: () => void }) {
  const { current: c } = data
  const totalRevenue = c.revenue
  const totalCollected = c.collected
  const totalOutstanding = c.outstanding
  const collectedPct = totalRevenue > 0 ? (totalCollected / totalRevenue) * 100 : 0
  const outstandingPct = totalRevenue > 0 ? (totalOutstanding / totalRevenue) * 100 : 0

  const clients = (data.clientWise || [])
    .filter(cl => cl.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 8)
  const maxClientOutstanding = Math.max(...clients.map(c => c.outstanding), 1)

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-label">Total outstanding</p>
            <p className="mt-1 text-[28px] font-bold leading-none tabular-nums tracking-tight sm:text-[32px]">
              <span className="mr-1 text-[14px] font-semibold text-[var(--text-muted)]">LKR</span>
              {totalOutstanding.toLocaleString('en', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {[
              { label: 'Collected', value: `LKR ${fmt(totalCollected)}`, sub: `${collectedPct.toFixed(0)}%` },
              { label: 'Pending', value: `LKR ${fmt(totalOutstanding)}`, sub: `${outstandingPct.toFixed(0)}%` },
              { label: 'Bills', value: String(c.billCount), sub: `${c.paidBills} paid` },
            ].map((m) => (
              <div key={m.label}>
                <p className="section-label">{m.label}</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums">{m.value}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full bg-[var(--brand)]"
            style={{ width: `${collectedPct}%` }}
            title={`Collected ${collectedPct.toFixed(0)}%`}
          />
          <div
            className="h-full bg-[var(--border-2)]"
            style={{ width: `${outstandingPct}%` }}
            title={`Outstanding ${outstandingPct.toFixed(0)}%`}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10.5px] text-[var(--text-muted)]">
          <span>Collected {collectedPct.toFixed(0)}%</span>
          <span>Outstanding {outstandingPct.toFixed(0)}%</span>
        </div>
        {totalOutstanding > 0 && (
          <div className="mt-3 flex justify-end">
            <Button size="xs" variant="secondary" onClick={onShowDetails}>
              <Eye className="h-3.5 w-3.5" />
              Full details
            </Button>
          </div>
        )}
      </div>

      {/* Per-client breakdown */}
      {clients.length > 0 && (
        <CardContent className="pt-4">
          <p className="section-label mb-3">Outstanding by client</p>
          <div className="space-y-4">
            {clients.map((cl) => {
              const barPct = (cl.outstanding / maxClientOutstanding) * 100
              return (
                <div
                  key={cl.client_name}
                  className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={cl.client_name} />
                      <span className="truncate text-[13px] font-medium">{cl.client_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] font-semibold tabular-nums">
                        LKR {cl.outstanding.toLocaleString()}
                      </span>
                      {cl.total_billed > 0 && (
                        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                          {((cl.outstanding / Math.max(1, cl.total_billed)) * 100).toFixed(0)}% of bill
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${barPct}%` }} />
                  </div>
                  {/* Pending items with specs */}
                  {cl.items && cl.items.length > 0 && (
                    <div className="ml-9 space-y-1">
                      {cl.items.map((item) => (
                        <div key={`${item.item_name}-${item.specification}`} className="flex items-center gap-2 text-[12px]">
                          <span className="font-medium">{item.item_name}</span>
                          {item.specification && (
                            <Badge size="xs" tone="neutral" mono>
                              {item.specification}
                            </Badge>
                          )}
                          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                            {item.delivered}/{item.received}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--warning-text)]">
                            {item.pending} pending
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ── Today's Deliveries ────────────────────────────────────────────────────────

function TodayDeliveries({ data }: { data: DashboardOverviewData }) {
  const clients = data.todayDeliveries || []
  const totalDelivered = clients.reduce((s, c) => s + c.total_qty, 0)

  if (clients.length === 0) {
    return (
      <Card>
        <CardHeader className="border-b border-[var(--border)] pb-3">
          <CardTitle className="text-[14px]">Today's Deliveries</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-[13px] text-[var(--text-muted)]">No deliveries recorded today.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">Today's Deliveries</h2>
        <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
          <span className="font-semibold text-[var(--text-primary)]">{totalDelivered.toLocaleString()}</span> pcs sent
        </span>
      </div>
      {clients.map((client) => {
        const totalPending = client.pending_items?.reduce((s, p) => s + p.pending, 0) || 0
        const allItems = new Map<string, { item_name: string; specification: string; sentToday: number; pending: number; returned: number }>()
        for (const item of client.delivered_items) {
          const dk = `${item.item_name}||${item.specification}`
          const existing = allItems.get(dk)
          if (existing) existing.sentToday += item.quantity
          else allItems.set(dk, { item_name: item.item_name, specification: item.specification, sentToday: item.quantity, pending: 0, returned: 0 })
        }
        for (const p of client.pending_items || []) {
          const dk = `${p.item_name}||${p.specification}`
          const existing = allItems.get(dk)
          if (existing) {
            existing.pending = p.pending
            existing.returned = p.returned || 0
          } else {
            allItems.set(dk, { item_name: p.item_name, specification: p.specification, sentToday: 0, pending: p.pending, returned: p.returned || 0 })
          }
        }
        const rows = Array.from(allItems.values())

        return (
          <Card key={client.client_name} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={client.client_name} />
                <span className="truncate text-[13.5px] font-semibold">{client.client_name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--text-muted)]">
                {client.has_note_delivery && (
                  <Badge size="xs" tone="warning">Marked by note</Badge>
                )}
                <span className="tabular-nums">
                  Sent <span className="font-semibold text-[var(--text-primary)]">{client.total_qty}</span>
                </span>
                {totalPending > 0 && (
                  <span className="tabular-nums">
                    Pending{' '}
                    <span className="font-semibold text-[var(--warning-text)]">{totalPending}</span>
                  </span>
                )}
              </div>
            </div>
            {(client.note_deliveries ?? []).map((n) => (
              <div
                key={n.gate_pass_number}
                className="border-b border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-2 text-[12px] text-[var(--warning-text)]"
              >
                <span className="font-[family-name:var(--font-mono)] font-semibold">
                  #{n.gate_pass_number}
                </span>{' '}
                — {n.note || 'Marked delivered (note)'}
              </div>
            ))}
            <DataTable
              data={rows}
              rowKey={(r) => `${r.item_name}-${r.specification}`}
              stickyHeader={false}
              className="[&_th]:px-4 [&_td]:px-4"
              columns={[
                { key: 'item', header: 'Item', width: '38%', render: (r) => <span className="font-medium">{r.item_name}</span> },
                {
                  key: 'specification',
                  header: 'Specification',
                  width: '18%',
                  render: (r) =>
                    r.specification ? (
                      <Badge size="xs" tone="neutral">{r.specification}</Badge>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    ),
                },
                {
                  key: 'sentToday',
                  header: 'Sent',
                  align: 'right',
                  numeric: true,
                  render: (r) => (r.sentToday > 0 ? r.sentToday : <span className="text-[var(--text-faint)]">—</span>),
                },
                {
                  key: 'returned',
                  header: 'Returned',
                  align: 'right',
                  numeric: true,
                  render: (r) =>
                    r.returned > 0 ? (
                      <span className="text-[var(--warning-text)]">{r.returned}</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    ),
                },
                {
                  key: 'pending',
                  header: 'Pending',
                  align: 'right',
                  numeric: true,
                  render: (r) =>
                    r.pending > 0 ? (
                      <span className="font-semibold">{r.pending}</span>
                    ) : (
                      <span className="text-[var(--text-faint)]">—</span>
                    ),
                },
              ]}
            />
          </Card>
        )
      })}
    </section>
  )
}

// ── Period Comparison ────────────────────────────────────────────────────────

function PeriodComparison({ data }: { data: DashboardOverviewData }) {
  const { current: c, previous: p } = data
  const comparisons = [
    { label: 'Revenue', cur: c.revenue, prev: p.revenue, format: 'lkr' as const },
    { label: 'Collected', cur: c.collected, prev: p.collected, format: 'lkr' as const },
    { label: 'Outstanding', cur: c.outstanding, prev: p.outstanding, format: 'lkr' as const, invert: true },
    { label: 'Avg Bill', cur: c.avgBill, prev: p.avgBill, format: 'lkr' as const },
    { label: 'Bills', cur: c.billCount, prev: p.billCount, format: 'num' as const },
    { label: 'Clients', cur: c.activeClients, prev: p.activeClients, format: 'num' as const },
  ]

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <Timer className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Period Comparison
        </CardTitle>
      </CardHeader>
      <CardContent flush>
        <ul className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] border-b border-[var(--border)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          {comparisons.map((cmp) => {
            const diff = cmp.prev === 0 ? (cmp.cur > 0 ? 100 : 0) : ((cmp.cur - cmp.prev) / Math.max(1, cmp.prev)) * 100
            const improved = cmp.invert ? diff < 0 : diff > 0
            const val = cmp.format === 'lkr' ? `LKR ${fmt(cmp.cur)}` : cmp.cur.toString()
            return (
              <li key={cmp.label} className="px-3.5 py-3">
                <p className="section-label">{cmp.label}</p>
                <p className="mt-1 text-[15px] font-semibold tabular-nums">{val}</p>
                <p
                  className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
                    improved ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'
                  }`}
                >
                  {improved ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(diff).toFixed(0)}%
                  <span className="font-normal text-[var(--text-faint)]">vs prev</span>
                </p>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

// ── Item Analytics ───────────────────────────────────────────────────────────

function ItemAnalytics({ data }: { data: DashboardOverviewData }) {
  const items = (data.itemWise || []).slice(0, 8)
  const maxReceived = Math.max(...items.map(i => i.total_received), 1)

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <Layers className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Item Analytics
        </CardTitle>
      </CardHeader>
      <CardContent flush>
        <DataTable
          data={items}
          rowKey={(i) => i.item_name}
          stickyHeader={false}
          mobilePrimary={['item']}
          emptyState={<p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No item data yet</p>}
          columns={[
            { key: 'item', header: 'Item', render: (i) => <span className="font-medium">{i.item_name}</span> },
            {
              key: 'received',
              header: 'Received',
              numeric: true,
              render: (i) => (
                <div className="flex items-center justify-end gap-2">
                  <span className="font-semibold">{i.total_received}</span>
                  <div className="h-1.5 w-[50px] overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-[var(--info-text)]"
                      style={{ width: `${(i.total_received / maxReceived) * 100}%` }}
                    />
                  </div>
                </div>
              ),
            },
            {
              key: 'delivered',
              header: 'Delivered',
              numeric: true,
              render: (i) => (
                <span className={i.total_delivered > 0 ? 'text-[var(--success-text)]' : 'text-[var(--text-faint)]'}>
                  {i.total_delivered > 0 ? i.total_delivered : '—'}
                </span>
              ),
            },
            {
              key: 'pending',
              header: 'Pending',
              numeric: true,
              render: (i) =>
                i.pending > 0 ? (
                  <span className="font-semibold text-[var(--warning-text)]">{i.pending}</span>
                ) : (
                  <span className="text-[var(--text-faint)]">—</span>
                ),
            },
            {
              key: 'clients',
              header: 'Clients',
              numeric: true,
              render: (i) => <span className="text-[var(--text-muted)]">{i.client_count}</span>,
            },
          ]}
        />
      </CardContent>
    </Card>
  )
}

// ── Outstanding Aging ────────────────────────────────────────────────────────

function OutstandingAgingChart({ data }: { data: DashboardOverviewData }) {
  const aging = data.aging
  const total = aging.current + aging['30_day'] + aging['60_day'] + aging['90_day'] + aging.over_90

  const bars = [
    { label: 'Current', value: aging.current, color: 'var(--success-text)' },
    { label: '1-30 days', value: aging['30_day'], color: 'var(--warning-text)' },
    { label: '31-60 days', value: aging['60_day'], color: 'var(--warning-text)' },
    { label: '61-90 days', value: aging['90_day'], color: 'var(--danger-text)' },
    { label: '90+ days', value: aging.over_90, color: 'var(--danger-text)' },
  ]

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[14px]">
            <BarChart3 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Outstanding Aging
          </CardTitle>
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>LKR {fmt(total)}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {total === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">Nothing outstanding</div>
        ) : (
          <div className="space-y-2.5">
            {bars.map((b) => {
              const pct = total > 0 ? (b.value / total) * 100 : 0
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium">{b.label}</span>
                    <span className="text-[12px] font-semibold tabular-nums">
                      LKR {fmt(b.value)}{' '}
                      <span className="font-normal text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: b.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Quotation Funnel ─────────────────────────────────────────────────────────

function QuotationFunnel({ data }: { data: DashboardOverviewData }) {
  const { current: c } = data
  const total = c.quotationsDraft + c.quotationsSent + c.quotationsAccepted
  const stages = [
    { label: 'Draft', count: c.quotationsDraft, color: 'var(--text-muted)', bg: 'var(--surface-2)' },
    { label: 'Sent', count: c.quotationsSent, color: 'var(--info-text)', bg: 'var(--info-soft)' },
    { label: 'Accepted', count: c.quotationsAccepted, color: 'var(--success-text)', bg: 'var(--success-soft)' },
  ]

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <Target className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> Quotation Funnel
        </CardTitle>
      </CardHeader>
      <CardContent flush>
        {total === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No quotations yet</p>
        ) : (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {stages.map((s) => {
                const pct = total > 0 ? (s.count / total) * 100 : 0
                return (
                  <li key={s.label} className="px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] font-medium">{s.label}</span>
                      <span className="text-[12.5px] font-semibold tabular-nums">
                        {s.count}
                        <span className="ml-1.5 font-normal text-[var(--text-muted)]">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {c.quotationAcceptedValue > 0 && (
              <div className="flex items-center justify-between border-t border-[var(--border)] px-3.5 py-2.5">
                <span className="text-[12px] text-[var(--text-muted)]">Accepted value</span>
                <span className="text-[13px] font-semibold tabular-nums text-[var(--success-text)]">
                  LKR {fmt(c.quotationAcceptedValue)}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── 12-Month Trend ───────────────────────────────────────────────────────────

function YearlyTrendChart({ data }: { data: DashboardOverviewData }) {
  const trend = data.yearlyTrend || []

  return (
    <Card>
      <CardHeader className="border-b border-[var(--border)] pb-3">
        <CardTitle className="flex items-center gap-2 text-[14px]">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> 12-Month Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[260px] pt-4">
        {trend.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[13px]" style={{ color: 'var(--text-muted)' }}>No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend}>
              <defs>
                <linearGradient id="gradYearRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradYearCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success-text)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="var(--success-text)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <RechartsTooltip
                contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}
                formatter={(v: number, name: string) => [`LKR ${v.toLocaleString()}`, name]}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--brand)" fill="url(#gradYearRevenue)" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="collected" stroke="var(--success-text)" fill="url(#gradYearCollected)" strokeWidth={2} name="Collected" />
              <Bar dataKey="bills" fill="var(--border-2)" radius={[3, 3, 0, 0]} name="Bills" barSize={16} />
              <Legend wrapperStyle={{ fontSize: 11.5, color: 'var(--text-muted)' }} iconType="plainline" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const { data, isLoading } = useDashboardOverview(period)
  const [showBalances, setShowBalances] = useState(false)

  const handleExport = async (
    type: 'gatepasses' | 'bills' | 'deliveries',
    format: 'csv' | 'xlsx' = 'csv',
  ) => {
    try {
      if (format === 'xlsx') {
        await reports.exportExcel(type)
      } else {
        await reports.exportCSV(type)
      }
      toast.success(`Exported ${type} as ${format.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Business overview — Love Laundry, Medagama · Reg. No. 40-3064"
        actions={
          <>
            <DropdownMenu
              label="Export options"
              groups={[
                {
                  label: 'Server export',
                  items: EXPORT_TARGETS.flatMap(([type, label]) => [
                    { id: `${type}-csv`, label: `${label} · CSV`, onSelect: () => handleExport(type, 'csv') },
                    { id: `${type}-xlsx`, label: `${label} · Excel`, onSelect: () => handleExport(type, 'xlsx') },
                  ]),
                },
              ]}
              trigger={(p) => (
                <Button {...(p as any)} variant="secondary" size="sm">
                  <Download aria-hidden />
                  Export
                </Button>
              )}
            />
            <Button asChild size="sm" variant="primary">
              <Link to="/quotations/new">
                <Plus aria-hidden />
                New Quotation
              </Link>
            </Button>
          </>
        }
      >
        <SyncStatusBar queryKey={['dashboard']} label="Dashboard" />
      </PageHeader>

      {/* Period selector */}
      <Tabs
        aria-label="Dashboard period"
        value={period}
        onValueChange={(v) => setPeriod(v as DashboardPeriod)}
        items={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-[110px]" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[250px]" />
            <Skeleton className="h-[250px]" />
          </div>
        </div>
      ) : data ? (
        <div key={period} className="space-y-4">
          <AlertBanners data={data} />
          <KpiCards data={data} />
          <BalancesOverview data={data} onShowDetails={() => setShowBalances(true)} />
          <TodayDeliveries data={data} />
          <PeriodComparison data={data} />
          <ChartsRow data={data} />
          <TablesRow data={data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ItemAnalytics data={data} />
            <OutstandingAgingChart data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <QuotationFunnel data={data} />
            <YearlyTrendChart data={data} />
          </div>
          <ActivityTimeline data={data} />
        </div>
      ) : (
        <div className="text-center py-20 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          No data available. Start by creating a gate pass or bill.
        </div>
      )}

      {/* Balances Detail Popup */}
      {data && (
        <BalancesPopup
          open={showBalances}
          onClose={() => setShowBalances(false)}
          clients={data.clientWise || []}
          aging={data.aging}
          totalOutstanding={data.current.outstanding}
          totalRevenue={data.current.revenue}
          totalCollected={data.current.collected}
        />
      )}
    </div>
  )
}
