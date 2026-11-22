import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Banknote, AlertTriangle, Receipt, CreditCard, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { useShopBillDashboard, useStatusCounts, usePaymentSummary } from '../hooks/useShopBills'

const fmt = (v: number) => `LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  PROCESSING: 'bg-zinc-50 text-zinc-700 border border-zinc-200',
  DELIVERED: 'bg-purple-50 text-purple-700 border border-purple-200',
  COMPLETED: 'bg-green-50 text-green-700 border border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function ShopBillsDashboardPage() {
  const [period, setPeriod] = useState(30)
  const { data: summary, isLoading: loadingSummary, isError: errSummary, error: errSumObj } = useShopBillDashboard(period)
  const { data: statusData, isLoading: loadingStatus } = useStatusCounts()
  const { data: paymentData, isLoading: loadingPayment } = usePaymentSummary()

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Shop Bills', href: '/shop-bills' }, { label: 'Dashboard' }]} />
          <div className="flex items-center gap-3 mt-1">
            <Link to="/shop-bills" className="text-[var(--text-faint)] hover:text-[var(--text-primary)]"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="text-dashboard-title">Shop Bills Dashboard</h1>
          </div>
          <SyncStatusBar queryKey={['shop-bills']} label="Shop bills" className="mt-2" />
        </div>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setPeriod(d)} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition cursor-pointer ${period === d ? 'bg-[var(--danger-deep)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {errSummary ? (
        <ErrorState description={errSumObj instanceof Error ? errSumObj.message : 'Failed to load dashboard'} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[var(--danger-deep)]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-[var(--text-secondary)]" />
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Total Bills</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-20" /> : <p className="text-[22px] font-bold text-[var(--text-primary)]">{summary?.total_bills ?? 0}</p>}
                {loadingSummary ? <Skeleton className="h-4 w-16 mt-1" /> : <p className="text-[12px] text-[var(--text-faint)] mt-0.5">{summary?.period_bills ?? 0} in period</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[var(--success-text)]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[var(--success-text)]" />
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Revenue</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-24" /> : <p className="text-[22px] font-bold text-[var(--success-text)]">{fmt(summary?.total_revenue ?? 0)}</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[var(--danger-deep)]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-[var(--danger-deep)]" />
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Outstanding</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-24" /> : <p className="text-[22px] font-bold text-[var(--danger-deep)]">{fmt(summary?.total_outstanding ?? 0)}</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[var(--danger-text)]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--danger-text)]" />
                  <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Overdue</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-20" /> : (
                  <>
                    <p className="text-[22px] font-bold text-[var(--danger-text)]">{summary?.overdue_count ?? 0}</p>
                    <p className="text-[12px] text-[var(--danger-text)] mt-0.5">{fmt(summary?.overdue_amount ?? 0)}</p>
                  </>
                )}
              </Card>
            </Link>
          </div>

          {/* Status + Payment Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader><CardTitle className="text-[14px]">By Status</CardTitle></CardHeader>
              <CardContent>
                {loadingStatus ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {(statusData?.counts ?? []).map((s: any) => (
                      <div key={s.status} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                        <div className="text-right">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{s.count} bills</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">{fmt(s.total)}</p>
                        </div>
                      </div>
                    ))}
                    {(!statusData?.counts || statusData.counts.length === 0) && <p className="text-[13px] text-[var(--text-faint)] text-center py-4">No data</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-[14px]">By Payment Status</CardTitle></CardHeader>
              <CardContent>
                {loadingPayment ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : (
                  <div className="space-y-2">
                    {(paymentData?.summary ?? []).map((p: any) => (
                      <div key={p.payment_status} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <span className="text-[12px] font-medium text-[var(--text-primary)]">{(p.payment_status ?? 'DRAFT').replace('_', ' ')}</span>
                        <div className="text-right">
                          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{p.count}</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">{fmt(p.total_outstanding)} due</p>
                        </div>
                      </div>
                    ))}
                    {(!paymentData?.summary || paymentData.summary.length === 0) && <p className="text-[13px] text-[var(--text-faint)] text-center py-4">No data</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card>
            <CardHeader><CardTitle className="text-[14px]">Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Link to="/shop-bills" className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--danger-deep)]/40 hover:bg-red-50 transition text-[13px] font-medium text-[var(--text-primary)]">
                  <Receipt size={16} className="text-[var(--danger-deep)]" /> View All Bills
                </Link>
                <Link to="/shop-bills/new" className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--success-text)]/40 hover:bg-green-50 transition text-[13px] font-medium text-[var(--text-primary)]">
                  <CreditCard size={16} className="text-[var(--success-text)]" /> New Bill
                </Link>
                <Link to="/customers" className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--brand-deep)]/40 hover:bg-zinc-50 transition text-[13px] font-medium text-[var(--text-primary)]">
                  <Users size={16} className="text-[var(--brand-deep)]" /> Client Statements
                </Link>
                <Link to="/reports" className="flex items-center gap-2 p-3 rounded-lg border border-[var(--border)] hover:border-[var(--danger-text)]/40 hover:bg-amber-50 transition text-[13px] font-medium text-[var(--text-primary)]">
                  <TrendingUp size={16} className="text-[var(--danger-text)]" /> Reports
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
