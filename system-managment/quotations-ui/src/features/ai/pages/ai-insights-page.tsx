import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Wallet, ShieldCheck, BrainCircuit,
  Banknote, Receipt, Sparkles,
} from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { loveAi } from '../api/ai-api'

const fmt = (n: number) => `LKR ${(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
const fmtShort = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `LKR ${(n / 1_000_000).toFixed(1)}M` :
  Math.abs(n) >= 1_000 ? `LKR ${(n / 1_000).toFixed(1)}K` : `LKR ${Math.round(n)}`

function StatCard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: string; sub?: string; icon: any; color: string; trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold mt-1 truncate">{value}</p>
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
          {trend === 'down' && <TrendingDown size={12} className="text-red-500" />}
          <p className="text-xs text-gray-400 truncate">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function ForecastChart({ title, series, forecast, color, formatter = fmt }: {
  title: string; series: Array<{ month: string; value: number }>; forecast: { forecast?: number[]; history?: number[]; growth_pct?: number }
  color: string; formatter?: (n: number) => string
}) {
  const data = series.map((s, i) => ({
    month: s.month,
    historical: s.value,
    forecasted: (forecast.forecast?.length && i >= series.length - forecast.forecast.length)
      ? forecast.forecast[i]
      : null,
  }))
  const trend = (forecast.growth_pct ?? 0) >= 0 ? 'up' : 'down'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{title}</h3>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(forecast.growth_pct ?? 0).toFixed(1)}% / mo
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 11 }} width={62} />
          <Tooltip formatter={(v: number) => (v == null ? '—' : formatter(v))} />
          <Legend />
          <Line type="monotone" dataKey="historical" name="History" stroke={color} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="forecasted" name="Forecast" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">
        Projected next 3 months: {(forecast.forecast || []).map(f => fmt(Math.round(f))).join(' · ')}
      </p>
    </div>
  )
}

export default function AiInsightsPage() {
  const [months, setMonths] = useState(12)

  const insights = useQuery({
    queryKey: ['ai-insights', months],
    queryFn: () => loveAi.dashboard(months).then(r => r.data),
  })

  const revenue = useQuery({ queryKey: ['ai-revenue', months], queryFn: () => loveAi.revenue(months).then(r => r.data) })
  const expenses = useQuery({ queryKey: ['ai-expenses', months], queryFn: () => loveAi.expenses(months).then(r => r.data) })
  const salary = useQuery({ queryKey: ['ai-salary', months], queryFn: () => loveAi.salary(months).then(r => r.data) })
  const risk = useQuery({ queryKey: ['ai-risk'], queryFn: () => loveAi.payrollRisk().then(r => r.data) })

  const loading = insights.isLoading || revenue.isLoading
  const error = insights.error || revenue.error
  const d = insights.data || {}

  const verified = (insights.data as any)?.verified

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <BrainCircuit size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Insights & Forecasts</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Secure analytics from the Love AI service — signed requests, hashed responses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {verified && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <ShieldCheck size={13} /> Response verified
            </span>
          )}
          <select
            value={months}
            onChange={e => setMonths(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800"
          >
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={24}>24 months</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-300">
          <h3 className="font-semibold mb-1">Could not reach the AI service</h3>
          <p className="text-sm">Check that <code className="font-mono text-xs">VITE_AI_API_URL</code> and <code className="font-mono text-xs">VITE_AI_API_KEY</code> are configured correctly. {(error as any)?.message}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={fmtShort(d.total_revenue)} sub={`${d.period?.start} → ${d.period?.end}`} icon={Banknote} color="bg-emerald-500" trend={(d.revenue?.forecast?.growth_pct ?? 0) >= 0 ? 'up' : 'down'} />
            <StatCard title="Total Expenses" value={fmtShort(d.total_expenses)} sub="Last N months" icon={Receipt} color="bg-red-500" trend={(d.expenses?.forecast?.growth_pct ?? 0) >= 0 ? 'up' : 'down'} />
            <StatCard title="Total Payroll" value={fmtShort(d.total_payroll)} sub="Net paid" icon={Banknote} color="bg-violet-500" />
            <StatCard title="Avg Monthly Net" value={fmtShort(d.avg_monthly_net)} sub="Revenue − Expenses" icon={Wallet} color={`${d.avg_monthly_net >= 0 ? 'bg-teal-500' : 'bg-rose-500'}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForecastChart title="Revenue Forecast" series={d.revenue?.series || []} forecast={d.revenue?.forecast || {}} color="#10b981" />
            <ForecastChart title="Expenses Forecast" series={d.expenses?.series || []} forecast={d.expenses?.forecast || {}} color="#ef4444" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ForecastChart title="Payroll Forecast" series={d.payroll?.series || []} forecast={d.payroll?.forecast || {}} color="#7c3aed" />
            <ForecastChart title="Net Profit View" series={(d.net_profit?.history || []).map((v: number, i: number) => ({ month: d.revenue?.series?.[i]?.month ?? `M${i + 1}`, value: v }))} forecast={{}} color="#14b8a6" />
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Sparkles size={16} className="text-violet-500" /> Payroll Risk</h3>
              <div className="space-y-3">
                {(risk.data?.employees_at_risk || []).map((e: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span className="text-sm truncate">{e.employee_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-500 font-medium">{fmt(e.outstanding)}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{e.count}×</span>
                    </div>
                  </div>
                ))}
                {(!risk.data?.employees_at_risk || risk.data?.employees_at_risk?.length === 0) && (
                  <p className="text-sm text-gray-400">No outstanding advances. All clear!</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-4 border-t pt-3">
                Total outstanding: {fmt(risk.data?.total_outstanding_advances)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500" /> Top Customers</h3>
              <div className="space-y-3">
                {(revenue.data?.top_customers || []).map((c: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span className="text-sm truncate">#{i + 1} {c.customer_name}</span>
                    <span className="text-sm font-medium shrink-0">{fmt(c.amount)}</span>
                  </div>
                ))}
                {(!revenue.data?.top_customers || revenue.data?.top_customers?.length === 0) && <p className="text-sm text-gray-400">No transaction data yet</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Receipt size={16} className="text-red-500" /> Top Expense Categories</h3>
              <div className="space-y-3">
                {(expenses.data?.top_categories || []).map((c: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span className="text-sm truncate">#{i + 1} {c.category}</span>
                    <span className="text-sm font-medium shrink-0">{fmt(c.amount)}</span>
                  </div>
                ))}
                {(!expenses.data?.top_categories || expenses.data?.top_categories?.length === 0) && <p className="text-sm text-gray-400">No expenses yet</p>}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Banknote size={16} className="text-violet-500" /> Top Employees by Payroll</h3>
              <div className="space-y-3">
                {(salary.data?.top_employees || []).map((e: any, i: number) => (
                  <div key={i} className="flex justify-between items-center gap-2">
                    <span className="text-sm truncate">#{i + 1} {e.employee_name}</span>
                    <span className="text-sm font-medium shrink-0">{fmt(e.total)}</span>
                  </div>
                ))}
                {(!salary.data?.top_employees || salary.data?.top_employees?.length === 0) && <p className="text-sm text-gray-400">No salary slips yet</p>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
            <h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> Quick Trend Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Revenue', val: d.revenue?.forecast?.growth_pct, ok: d.revenue?.forecast?.growth_pct >= 0 },
                { label: 'Expenses', val: d.expenses?.forecast?.growth_pct, ok: d.expenses?.forecast?.growth_pct <= 0 },
                { label: 'Payroll', val: d.payroll?.forecast?.growth_pct, ok: d.payroll?.forecast?.growth_pct <= 0 },
              ].map(m => (
                <div key={m.label} className={`rounded-lg border p-3 ${m.ok ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10' : 'border-red-200 bg-red-50 dark:bg-red-900/10'}`}>
                  <p className="text-xs font-medium">{m.label} momentum</p>
                  <p className={`text-lg font-bold ${m.ok ? 'text-emerald-600' : 'text-red-600'}`}>{Math.abs(m.val ?? 0).toFixed(1)}%/mo</p>
                  <p className="text-xs text-gray-400">{m.val >= 0 ? 'Rising' : 'Falling'}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}