import { useState } from 'react'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { useQuery } from '@tanstack/react-query'
import { reportsApi, customersApi } from '../api/management-api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Filter } from 'lucide-react'

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const LIST_LIMIT = 500

export default function ManagementReports() {
  const [report, setReport] = useState('profit-loss')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const { data: customersData = { items: [] } } = useQuery({
    queryKey: ['mgmt-customers-list'],
    queryFn: () => customersApi.list('', LIST_LIMIT, 0).then(r => r.data),
  })

  const customers = customersData.items

  const { data: plData } = useQuery({
    queryKey: ['mgmt-pl-report', startDate, endDate, customerId],
    queryFn: () => reportsApi.profitLoss({ start_date: startDate, end_date: endDate, customer_id: customerId }).then(r => r.data),
    enabled: report === 'profit-loss',
  })

  const { data: dailyData } = useQuery({
    queryKey: ['mgmt-daily-report'],
    queryFn: () => reportsApi.daily().then(r => r.data),
    enabled: report === 'daily',
  })

  const { data: monthlyData } = useQuery({
    queryKey: ['mgmt-monthly-report', year, month],
    queryFn: () => reportsApi.monthly(year, month).then(r => r.data),
    enabled: report === 'monthly',
  })

  const { data: outstandingData = [] } = useQuery({
    queryKey: ['mgmt-outstanding'],
    queryFn: () => reportsApi.outstanding().then(r => r.data),
    enabled: report === 'outstanding',
  })

  const fmt = (n: number) => `LKR ${(n || 0).toLocaleString()}`

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'profit-loss', label: 'Profit & Loss' },
          { id: 'daily', label: 'Daily Report' },
          { id: 'monthly', label: 'Monthly Report' },
          { id: 'outstanding', label: 'Outstanding Payments' },
        ].map(r => (
          <button key={r.id} onClick={() => setReport(r.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${report === r.id ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end bg-white dark:bg-gray-800 rounded-xl border p-4">
        <Filter size={16} className="text-gray-400" />
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Customer</label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm">
            <option value="">All Customers</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {report === 'monthly' && (
          <>
            <div>
              <label className="text-xs text-gray-500">Month</label>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="block px-3 py-2 border rounded-lg text-sm">
                {Array.from({length:12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('default',{month:'long'})}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Year</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="block px-3 py-2 border rounded-lg text-sm w-24" />
            </div>
          </>
        )}
      </div>

      {/* Profit & Loss */}
      {report === 'profit-loss' && plData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-green-600">{fmt(plData.total_revenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Cost of Goods</p>
              <p className="text-xl font-bold text-orange-600">{fmt(plData.total_cogs)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Gross Profit</p>
              <p className="text-xl font-bold">{fmt(plData.gross_profit)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
              <p className="text-sm text-gray-500">Net Profit</p>
              <p className={`text-xl font-bold ${plData.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(plData.net_profit)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Revenue by Customer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={plData.revenue_by_customer || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                  <Bar dataKey="value" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Revenue by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={plData.revenue_by_category || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {(plData.revenue_by_category || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `LKR ${v.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-3">Expense Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(plData.expenses_by_category || []).map((e: any, i: number) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-gray-500">{e.name}</p>
                  <p className="font-semibold">{fmt(e.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Daily Report */}
      {report === 'daily' && dailyData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Daily Report - {dailyData.date}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Transactions</p><p className="text-xl font-bold">{dailyData.transactions}</p></div>
            <div><p className="text-sm text-gray-500">Total Quantity</p><p className="text-xl font-bold">{dailyData.total_quantity}</p></div>
            <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-600">{fmt(dailyData.total_revenue)}</p></div>
            <div><p className="text-sm text-gray-500">Gross Profit</p><p className="text-xl font-bold">{fmt(dailyData.gross_profit)}</p></div>
          </div>
        </div>
      )}

      {/* Monthly Report */}
      {report === 'monthly' && monthlyData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Monthly Report - {monthlyData.year}-{String(monthlyData.month).padStart(2, '0')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Transactions</p><p className="text-xl font-bold">{monthlyData.transactions}</p></div>
            <div><p className="text-sm text-gray-500">Total Quantity</p><p className="text-xl font-bold">{monthlyData.total_quantity}</p></div>
            <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-600">{fmt(monthlyData.total_revenue)}</p></div>
            <div><p className="text-sm text-gray-500">Gross Profit</p><p className="text-xl font-bold">{fmt(monthlyData.gross_profit)}</p></div>
          </div>
          {monthlyData.revenue_by_customer?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Revenue by Customer</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-right">Revenue</th></tr>
                </thead>
                <tbody>
                  {monthlyData.revenue_by_customer.map((c: any, i: number) => (
                    <tr key={i} className="border-t"><td className="px-3 py-2">{c.name}</td><td className="px-3 py-2 text-right">{fmt(c.value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Outstanding */}
      {report === 'outstanding' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Outstanding Payments</h2>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-right">Total Billed</th>
                <th className="px-3 py-2 text-right">Total Paid</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {outstandingData.map((o: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-medium">{o.customer_name}</td>
                  <td className="px-3 py-2 text-right">{fmt(o.total_billed)}</td>
                  <td className="px-3 py-2 text-right">{fmt(o.total_paid)}</td>
                  <td className="px-3 py-2 text-right font-bold text-red-600">{fmt(o.outstanding)}</td>
                </tr>
              ))}
              {outstandingData.length === 0 && (
                <TableEmptyRow colSpan={4} title="No outstanding payments" description="Every client is settled up." />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
