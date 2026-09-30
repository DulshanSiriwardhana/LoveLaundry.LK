import { useState, type ElementType, type SyntheticEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, BarChart3, Users, Package, ClipboardList, Banknote, History, TrendingUp, AlertTriangle, CheckCircle, Clock, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { reports } from '../services/reports.service'
import { toast } from 'sonner'

type ReportTab = 'client' | 'item' | 'gatepass' | 'billing' | 'audit'

const TABS: { id: ReportTab; label: string; icon: ElementType }[] = [
  { id: 'client', label: 'Client-Wise', icon: Users },
  { id: 'item', label: 'Item-Wise', icon: Package },
  { id: 'gatepass', label: 'Gate Pass', icon: ClipboardList },
  { id: 'billing', label: 'Billing', icon: Banknote },
  { id: 'audit', label: 'Audit Log', icon: History },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  const cfg =
    s === 'delivered' || s === 'paid' || s === 'completed' || s === 'full'
      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
      : s === 'pending' || s === 'draft'
        ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
        : s === 'partial' || s === 'partially_paid'
          ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]'
          : s === 'cancelled'
            ? 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
            : 'bg-[#F9FAFB] text-[#374151] border-[#E4E7EC]'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${cfg}`}>
      {status || '—'}
    </span>
  )
}

function ActionBadge({ action }: { action: string }) {
  const a = (action || '').toUpperCase()
  const cfg =
    a.includes('CREATE') ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]' :
      a.includes('UPDATE') || a.includes('EDIT') ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' :
        a.includes('DELETE') || a.includes('REMOVE') ? 'bg-[#FFF1F1] text-[#DC2626] border-[#FECACA]' :
          'bg-[#F9FAFB] text-[#374151] border-[#E4E7EC]'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg}`}>
      {action || '—'}
    </span>
  )
}

function StatCard({ label, value, accent, icon: Icon }: { label: string; value: string | number; accent?: string; icon?: ElementType }) {
  const IconEl = Icon
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        {IconEl && <IconEl className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: accent || 'var(--text-tertiary)' }} />}
      </div>
      <p className="text-[20px] font-bold leading-tight" style={{ color: accent || 'var(--text-primary)' }}>{value}</p>
    </Card>
  )
}

// ── Client-Wise ───────────────────────────────────────────────────────────────

function ClientSearch() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  const { data: clientsData } = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: reports.clientWise as () => Promise<any[]>,
  })

  const clientNames = Array.from(new Set(
    (clientsData || []).map((c: any) => c.client_name).filter(Boolean)
  ))

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'client-summary', search],
    queryFn: () => reports.clientSummary(search),
    enabled: Boolean(search),
  })

  const handleSearch = (e: SyntheticEvent) => {
    e.preventDefault()
    setSearch(input.trim())
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            list="client-list"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter client / hotel name…"
            className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
          />
          <datalist id="client-list">
            {clientNames.map(name => (
              <option key={name} value={name as string} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="h-10 px-5 rounded-lg bg-[#DC2626] text-white text-[13px] font-medium hover:bg-[#B91C1C] transition cursor-pointer"
        >
          Search
        </button>
      </form>

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-48" />
        </div>
      )}

      {isError && <ErrorState description="Failed to load client summary" />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Gate Passes" value={data.stats.total_gate_passes} icon={ClipboardList} />
            <StatCard label="Items Received" value={data.stats.total_items_received} icon={Package} />
            <StatCard label="Items Delivered" value={data.stats.total_items_delivered} icon={TrendingUp} accent="#16A34A" />
            <StatCard label="Pending Items" value={data.stats.pending_items} icon={Clock} accent="#D97706" />
            <StatCard label="Open Mismatches" value={data.stats.open_mismatches} icon={AlertTriangle} accent="#DC2626" />
            <StatCard label="Pending Bills" value={data.stats.pending_bills} icon={Banknote} accent="#C2410C" />
            <StatCard label="Total Billed" value={`LKR ${data.stats.total_billed.toLocaleString()}`} icon={Banknote} accent="#2563EB" />
            <StatCard label="Outstanding" value={`LKR ${data.stats.outstanding_amount.toLocaleString()}`} icon={AlertTriangle} accent="#DC2626" />
          </div>

          {/* Pending Balances */}
          {data.pending_balances?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[#F2F4F7] pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#D97706]" />
                  <CardTitle>Pending Item Balances</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                    <tr>
                      {['Item Name', 'Received', 'Delivered', 'Pending'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9FAFB]">
                    {data.pending_balances.map((b: any, i: number) => (
                      <tr key={i} className={b.pending > 0 ? 'bg-[#FFFBEB]' : ''}>
                        <td className="px-4 py-3 font-medium text-[#101828]">{b.item_name}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{b.received}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{b.delivered}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${b.pending > 0 ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                            {b.pending > 0 ? b.pending : '✓ 0'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Recent Gate Passes */}
          {data.gatepasses?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[#F2F4F7] pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-[#2563EB]" />
                  <CardTitle>Recent Gate Passes</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                    <tr>
                      {['GP Number', 'Date', 'Received By', 'Items', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9FAFB]">
                    {data.gatepasses.map((gp: any, i: number) => (
                      <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#101828]">{gp.gate_pass_number}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{gp.receiving_date ? new Date(gp.receiving_date).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{gp.received_by || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#101828]">{gp.total_received ?? gp.items?.length ?? '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={gp.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Recent Bills */}
          {data.bills?.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[#F2F4F7] pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-[#16A34A]" />
                  <CardTitle>Recent Bills</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                    <tr>
                      {['Bill No.', 'Date', 'Amount', 'Paid', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F9FAFB]">
                    {data.bills.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#101828]">{b.bill_number || b.id}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#101828]">LKR {(b.total_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 font-semibold text-[#16A34A]">LKR {(b.paid_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.payment_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {!data && !isLoading && !isError && (
        <div className="py-16 text-center space-y-2">
          <Users className="h-8 w-8 mx-auto text-[#D1D5DB]" />
          <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>Enter a client name above to view their complete summary</p>
        </div>
      )}
    </div>
  )
}

// ── Item-Wise ─────────────────────────────────────────────────────────────────

function ItemWiseReport() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'item-wise'],
    queryFn: reports.itemWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load item-wise report" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No data available</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4E7EC]">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
          <tr>
            {['Item Name', 'Total Received', 'Total Delivered', 'Pending', 'Mismatches', 'Clients'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F9FAFB] bg-white">
          {data.map((row: any, i: number) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className={`hover:bg-[#F9FAFB] transition-colors ${(row.pending > 0) ? 'bg-[#FFFBEB]' : ''}`}
            >
              <td className="px-4 py-3 font-medium text-[#101828]">{row.item_name || '—'}</td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{row.total_received ?? '—'}</td>
              <td className="px-4 py-3 text-[#16A34A] font-semibold">{row.total_delivered ?? '—'}</td>
              <td className="px-4 py-3">
                {row.pending > 0
                  ? <span className="font-bold text-[#D97706]">{row.pending}</span>
                  : <span className="text-[#16A34A] font-semibold">✓ 0</span>
                }
              </td>
              <td className="px-4 py-3">
                {row.mismatch_count > 0
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F1] border border-[#FECACA] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-2.5 w-2.5" />{row.mismatch_count}
                  </span>
                  : <span className="text-[#16A34A]">—</span>
                }
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.client_count ?? '—'}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Gate Pass Report ──────────────────────────────────────────────────────────

function GatePassReport() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'gatepass-wise'],
    queryFn: reports.gatepassWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load gate pass report" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No data available</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4E7EC]">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
          <tr>
            {['GP No.', 'Client', 'Date', 'Received By', 'Received', 'Delivered', 'Mismatches', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F9FAFB] bg-white">
          {data.map((row: any, i: number) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="hover:bg-[#F9FAFB] transition-colors"
            >
              <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#101828] whitespace-nowrap">{row.gate_pass_number}</td>
              <td className="px-4 py-3 font-medium text-[#101828]">{row.client_name}</td>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{row.receiving_date ? new Date(row.receiving_date).toLocaleDateString() : '—'}</td>
              <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.received_by || '—'}</td>
              <td className="px-4 py-3 font-semibold text-[#101828]">{row.total_received ?? '—'}</td>
              <td className="px-4 py-3 font-semibold text-[#16A34A]">{row.total_delivered ?? '—'}</td>
              <td className="px-4 py-3">
                {row.mismatch_count > 0
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1F1] border border-[#FECACA] px-2 py-0.5 text-[10px] font-semibold text-[#DC2626]">
                    <AlertTriangle className="h-2.5 w-2.5" />{row.mismatch_count}
                  </span>
                  : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                }
              </td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Billing Report ────────────────────────────────────────────────────────────

function BillingReport() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'billing'],
    queryFn: reports.billing,
  })

  const { data: clientData = [], isLoading: clientLoading } = useQuery({
    queryKey: ['reports', 'client-wise'],
    queryFn: reports.clientWise as () => Promise<any[]>,
  })

  if (isLoading) return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
  if (isError) return <ErrorState description="Failed to load billing report" />
  if (!data) return null

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Revenue" value={`LKR ${(data.total_sales || 0).toLocaleString()}`} accent="#DC2626" icon={TrendingUp} />
        <StatCard label="Paid" value={`LKR ${(data.paid_bills_amount || 0).toLocaleString()}`} accent="#16A34A" icon={CheckCircle} />
        <StatCard label="Pending" value={`LKR ${(data.pending_bills_amount || 0).toLocaleString()}`} accent="#D97706" icon={Clock} />
        <StatCard label="Outstanding" value={`LKR ${(data.outstanding_amount || 0).toLocaleString()}`} accent="#2563EB" icon={AlertTriangle} />
      </div>

      {/* Per-client breakdown */}
      {clientLoading && <Skeleton className="h-48" />}
      {clientData.length > 0 && (
        <Card>
          <CardHeader className="border-b border-[#F2F4F7] pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#2563EB]" />
              <CardTitle>Per-Client Billing Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
                <tr>
                  {['Client', 'Gate Passes', 'Total Billed', 'Paid', 'Outstanding', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F9FAFB]">
                {clientData.map((row: any, i: number) => {
                  const outstanding = (row.total_billed || 0) - (row.paid_amount || 0)
                  return (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className={`hover:bg-[#F9FAFB] transition-colors ${outstanding > 0 ? 'bg-[#FFFBEB]' : ''}`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#101828]">{row.client_name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.gate_pass_count ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-[#101828]">LKR {(row.total_billed || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-[#16A34A]">LKR {(row.paid_amount || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {outstanding > 0
                          ? <span className="font-bold text-[#DC2626]">LKR {outstanding.toLocaleString()}</span>
                          : <span className="text-[#16A34A] font-semibold">✓ Settled</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={outstanding > 0 ? 'pending' : 'paid'} />
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

function AuditLog() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['reports', 'audit'],
    queryFn: () => reports.auditLogs(100) as Promise<any[]>,
  })

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}</div>
  if (isError) return <ErrorState description="Failed to load audit log" />
  if (!data.length) return <div className="py-12 text-center text-[13px]" style={{ color: 'var(--text-tertiary)' }}>No audit entries found</div>

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E4E7EC]">
      <table className="w-full text-[13px]">
        <thead className="bg-[#F9FAFB] border-b border-[#E4E7EC]">
          <tr>
            {['Time', 'User', 'Action', 'Entity', 'Entity ID', 'Details'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F9FAFB] bg-white">
          {(data as any[]).map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.01 }}
              className="hover:bg-[#F9FAFB] transition-colors"
            >
              <td className="px-4 py-3 text-[12px] whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 font-medium text-[#101828]">{row.user_id || '—'}</td>
              <td className="px-4 py-3"><ActionBadge action={row.action} /></td>
              <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-secondary)' }}>{row.entity || '—'}</td>
              <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{row.entity_id ? String(row.entity_id).slice(-8) : '—'}</td>
              <td className="px-4 py-3 max-w-[200px] truncate text-[12px]" style={{ color: 'var(--text-tertiary)' }} title={row.details ? JSON.stringify(row.details) : ''}>
                {row.details
                  ? typeof row.details === 'object'
                    ? Object.entries(row.details)
                        .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
                        .map(([k, v]) => {
                          if (Array.isArray(v)) return `${k}: ${v.length}`
                          if (typeof v === 'object') return `${k}: {…}`
                          return `${k}: ${v}`
                        })
                        .join(', ') || '—'
                    : String(row.details)
                  : '—'}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('client')

  const handleExport = async (type: 'gatepasses' | 'bills' | 'deliveries', format: 'csv' | 'xlsx' = 'csv') => {
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
    <div className="space-y-5 pb-10">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Reports' }]} />
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFF1F1] border border-[#FECACA]">
            <BarChart3 className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div>
            <h1 className="text-dashboard-title">Reports</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Business analytics & audit trail</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 overflow-x-auto pb-0.5 scrollbar-hidden">
        <div className="flex gap-1 flex-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition cursor-pointer',
                activeTab === id
                  ? 'bg-[#DC2626] text-white shadow-sm'
                  : 'hover:bg-[#F3F4F6]',
              ].join(' ')}
              style={activeTab !== id ? { color: 'var(--text-secondary)' } : {}}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {/* Export buttons */}
        <div className="flex gap-1.5 shrink-0">
          {([
            { type: 'gatepasses' as const, label: 'Gate Passes' },
            { type: 'bills' as const, label: 'Bills' },
            { type: 'deliveries' as const, label: 'Deliveries' },
          ]).map(exp => (
            <div key={exp.type} className="flex gap-1">
              <button
                onClick={() => handleExport(exp.type, 'csv')}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition cursor-pointer hover:bg-[var(--surface-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Download className="h-3 w-3" />
                {exp.label} CSV
              </button>
              <button
                onClick={() => handleExport(exp.type, 'xlsx')}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium whitespace-nowrap transition cursor-pointer hover:bg-[var(--surface-hover)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Download className="h-3 w-3" />
                {exp.label} Excel
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {activeTab === 'client' && <ClientSearch />}
        {activeTab === 'item' && <ItemWiseReport />}
        {activeTab === 'gatepass' && <GatePassReport />}
        {activeTab === 'billing' && <BillingReport />}
        {activeTab === 'audit' && <AuditLog />}
      </motion.div>
    </div>
  )
}
