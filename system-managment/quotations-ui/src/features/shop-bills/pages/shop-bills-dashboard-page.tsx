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
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
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
            <Link to="/shop-bills" className="text-[#98A2B3] hover:text-[#374151]"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="text-dashboard-title">Shop Bills Dashboard</h1>
          </div>
          <SyncStatusBar queryKey={['shop-bills']} label="Shop bills" className="mt-2" />
        </div>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setPeriod(d)} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition cursor-pointer ${period === d ? 'bg-[#DC2626] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
              <Card className="p-4 group-hover:border-[#DC2626]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="h-4 w-4 text-[#6B7280]" />
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Total Bills</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-20" /> : <p className="text-[22px] font-bold text-[#101828]">{summary?.total_bills ?? 0}</p>}
                {loadingSummary ? <Skeleton className="h-4 w-16 mt-1" /> : <p className="text-[12px] text-[#98A2B3] mt-0.5">{summary?.period_bills ?? 0} in period</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[#16A34A]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[#16A34A]" />
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Revenue</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-24" /> : <p className="text-[22px] font-bold text-[#16A34A]">{fmt(summary?.total_revenue ?? 0)}</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[#DC2626]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="h-4 w-4 text-[#DC2626]" />
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Outstanding</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-24" /> : <p className="text-[22px] font-bold text-[#DC2626]">{fmt(summary?.total_outstanding ?? 0)}</p>}
              </Card>
            </Link>
            <Link to="/shop-bills" className="block group">
              <Card className="p-4 group-hover:border-[#F59E0B]/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Overdue</p>
                </div>
                {loadingSummary ? <Skeleton className="h-7 w-20" /> : (
                  <>
                    <p className="text-[22px] font-bold text-[#D97706]">{summary?.overdue_count ?? 0}</p>
                    <p className="text-[12px] text-[#D97706] mt-0.5">{fmt(summary?.overdue_amount ?? 0)}</p>
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
                          <p className="text-[13px] font-semibold text-[#101828]">{s.count} bills</p>
                          <p className="text-[11px] text-[#6B7280]">{fmt(s.total)}</p>
                        </div>
                      </div>
                    ))}
                    {(!statusData?.counts || statusData.counts.length === 0) && <p className="text-[13px] text-[#98A2B3] text-center py-4">No data</p>}
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
                        <span className="text-[12px] font-medium text-[#101828]">{(p.payment_status ?? 'DRAFT').replace('_', ' ')}</span>
                        <div className="text-right">
                          <p className="text-[13px] font-semibold text-[#101828]">{p.count}</p>
                          <p className="text-[11px] text-[#6B7280]">{fmt(p.total_outstanding)} due</p>
                        </div>
                      </div>
                    ))}
                    {(!paymentData?.summary || paymentData.summary.length === 0) && <p className="text-[13px] text-[#98A2B3] text-center py-4">No data</p>}
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
                <Link to="/shop-bills" className="flex items-center gap-2 p-3 rounded-lg border border-[#E4E7EC] hover:border-[#DC2626]/40 hover:bg-red-50 transition text-[13px] font-medium text-[#101828]">
                  <Receipt size={16} className="text-[#DC2626]" /> View All Bills
                </Link>
                <Link to="/shop-bills/new" className="flex items-center gap-2 p-3 rounded-lg border border-[#E4E7EC] hover:border-[#16A34A]/40 hover:bg-green-50 transition text-[13px] font-medium text-[#101828]">
                  <CreditCard size={16} className="text-[#16A34A]" /> New Bill
                </Link>
                <Link to="/customers" className="flex items-center gap-2 p-3 rounded-lg border border-[#E4E7EC] hover:border-[#3538CD]/40 hover:bg-blue-50 transition text-[13px] font-medium text-[#101828]">
                  <Users size={16} className="text-[#3538CD]" /> Client Statements
                </Link>
                <Link to="/reports" className="flex items-center gap-2 p-3 rounded-lg border border-[#E4E7EC] hover:border-[#D97706]/40 hover:bg-amber-50 transition text-[13px] font-medium text-[#101828]">
                  <TrendingUp size={16} className="text-[#D97706]" /> Reports
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
