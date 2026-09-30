import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/management-api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Users, Package, Wallet, AlertCircle, Banknote, ShoppingCart, UserCheck, FileText, HeartHandshake, UserCircle, ListChecks, CalendarPlus, Sun, Zap, Settings, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatCard } from '../../../components/ui/stat-card'
import { PageHeader } from '../../../components/ui/page-header'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'

const QUICK_ACTIONS = [
  { to: '/management/employees', label: 'Employees', icon: UserCircle, color: 'bg-rose-500' },
  { to: '/management/attendance-log', label: 'Log Attendance', icon: CalendarPlus, color: 'bg-teal-500' },
  { to: '/management/salary-slip', label: 'Generate Slip', icon: Banknote, color: 'bg-emerald-500' },
  { to: '/management/salary-history', label: 'Salary History', icon: ListChecks, color: 'bg-indigo-500' },
  { to: '/management/advances', label: 'Advances', icon: Wallet, color: 'bg-amber-500' },
  { to: '/management/holidays', label: 'Holidays', icon: Sun, color: 'bg-orange-500' },
  { to: '/management/extra-work', label: 'Extra Work', icon: Zap, color: 'bg-purple-500' },
  { to: '/management/company-settings', label: 'Company Settings', icon: Settings, color: 'bg-slate-600' },
]

export default function ManagementDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['mgmt-dashboard'],
    queryFn: () => dashboardApi.get().then(r => r.data),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>

  const d = data || {}
  const fmt = (n: number) => `LKR ${(n || 0).toLocaleString()}`

  return (
    <div className="space-y-6">
      <PageHeader title="Management Dashboard" subtitle="Financial, HR and operational overview" />
      <SyncStatusBar queryKey={['mgmt-dashboard']} label="Mgmt dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Revenue" value={fmt(d.today_revenue)} icon={<Banknote size={20} />} color="green" to="/management/transactions" />
        <StatCard label="Monthly Revenue" value={fmt(d.month_revenue)} icon={<TrendingUp size={20} />} color="blue" to="/management/transactions" />
        <StatCard label="6-Month Revenue" value={fmt(d.six_month_revenue)} icon={<ShoppingCart size={20} />} color="purple" to="/management/transactions" />
        <StatCard label="Net Profit" value={fmt(d.net_profit)} icon={<Wallet size={20} />} color={d.net_profit >= 0 ? 'green' : 'red'} to="/management/transactions" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pieces" value={(d.total_pieces || 0).toLocaleString()} icon={<Package size={20} />} color="amber" to="/management/items" />
        <StatCard label="Customers" value={String(d.total_customers || 0)} icon={<Users size={20} />} color="blue" to="/management/customers" />
        <StatCard label="Total Expenses" value={fmt(d.total_expenses)} icon={<TrendingDown size={20} />} color="amber" to="/management/expenses" />
        <StatCard label="Outstanding" value={fmt(d.outstanding_payments)} icon={<AlertCircle size={20} />} color="red" to="/management/payments" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Employees" value={String(d.active_employees ?? '—')} icon={<Users size={20} />} color="green" to="/management/employees" />
        <StatCard label="Present Today" value={(d.present_today ?? 0) + (d.on_leave_today ? ` / ${d.on_leave_today} leave` : '')} icon={<UserCheck size={20} />} color="purple" to="/management/attendance" />
        <StatCard label="Draft Slips (Month)" value={String(d.draft_slips_month ?? '—')} icon={<FileText size={20} />} color="purple" trendLabel={`${d.unpaid_slips_month ?? 0} finalized unpaid`} to="/management/salary-history" />
        <StatCard label="Outstanding Advances" value={fmt(d.outstanding_advances)} icon={<HeartHandshake size={20} />} color="amber" to="/management/advances" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-center gap-3 rounded-lg border p-3 hover:shadow-sm transition hover:border-red-300"
            >
              <span className={`p-2 rounded-lg ${a.color} text-white`}>
                <a.icon size={18} />
              </span>
              <span className="text-sm font-medium flex-1">{a.label}</span>
              <ArrowRight size={14} className="text-gray-300 group-hover:text-red-500 transition" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Revenue & Expenses (6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={d.monthly_revenue || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Profit Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={d.monthly_profit || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
              <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Top Customers</h3>
          <div className="space-y-3">
            {(d.top_customers || []).map((c: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">{c.name}</span>
                <span className="text-sm font-medium">{fmt(c.revenue)}</span>
              </div>
            ))}
            {(!d.top_customers || d.top_customers.length === 0) && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Top Items</h3>
          <div className="space-y-3">
            {(d.top_items || []).map((c: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">{c.name}</span>
                <span className="text-sm font-medium">{fmt(c.revenue)}</span>
              </div>
            ))}
            {(!d.top_items || d.top_items.length === 0) && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
          <h3 className="font-semibold mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            {(d.expense_breakdown || []).map((e: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-sm">{e.category}</span>
                <span className="text-sm font-medium">{fmt(e.amount)}</span>
              </div>
            ))}
            {(!d.expense_breakdown || d.expense_breakdown.length === 0) && <p className="text-sm text-gray-400">No expenses yet</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
