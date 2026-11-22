import { useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  fetchBillsForToday,
  fetchExpensesToday,
  getTodayStr,
  type Bill,
  type ExpenseCategoryTotal,
} from '../api'
import { ThemeSwitcher } from '../ll-theme'

interface HotelAgg {
  name: string
  income: number
  collected: number
  outstanding: number
}

interface Props {
  token: string
  user: any
  onLogout: () => void
}

const fmt = (n?: number): string => Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function DashboardPage({ token, onLogout }: Props) {
  const [bills, setBills] = useState<Bill[]>([])
  const [expenses, setExpenses] = useState<ExpenseCategoryTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const today = getTodayStr()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [billsData, expensesData] = await Promise.all([fetchBillsForToday(token), fetchExpensesToday(token)])
        if (cancelled) return
        setBills(billsData)
        setExpenses(expensesData)
      } catch (err: any) {
        if (cancelled) return
        if (err?.status === 401) { clearSession(); onLogout() }
        setError(err?.message || 'Failed to load today\'s data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const hotels: HotelAgg[] = useMemo(() => {
    const map = new Map<string, HotelAgg>()
    for (const b of bills) {
      const name = b.client_name || 'Unknown'
      const cur = map.get(name) || { name, income: 0, collected: 0, outstanding: 0 }
      cur.income += Number(b.grand_total ?? 0)
      cur.collected += Number(b.paid_amount ?? 0)
      cur.outstanding += Number(b.outstanding_amount ?? 0)
      map.set(name, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.income - a.income)
  }, [bills])

  const totals = bills.reduce(
    (acc, b) => ({
      income: acc.income + Number(b.grand_total ?? 0),
      collected: acc.collected + Number(b.paid_amount ?? 0),
      outstanding: acc.outstanding + Number(b.outstanding_amount ?? 0),
    }),
    { income: 0, collected: 0, outstanding: 0 },
  )
  const expenseTotal = expenses.reduce((s, e) => s + Number(e?.total ?? 0), 0)

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] pb-10">
      <div className="sticky top-0 z-10 bg-[var(--brand-dark)] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[18px] font-bold text-[var(--ll-white)]">LoveLaundry</p>
            <p className="text-[11px] text-[var(--sidebar-text)] mt-0.5">{today}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={onLogout}
              className="h-9 px-3 rounded-xl bg-[var(--sidebar-active-bg)] text-[var(--ll-white)] text-[12px] font-semibold"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)]">Today's Analytics</h2>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Income &amp; expenses for {today}</p>

        {error ? <p className="mt-4 text-[13px] text-[var(--danger-text)]">{error}</p> : null}

        {loading ? (
          <p className="mt-6 text-[13px] text-[var(--text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] text-[var(--text-secondary)]">Income Today</p>
                <p className="text-[18px] font-bold text-[var(--text-primary)] mt-1">Rs. {fmt(totals.income)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] text-[var(--text-secondary)]">Collected Today</p>
                <p className="text-[18px] font-bold text-[var(--text-primary)] mt-1">Rs. {fmt(totals.collected)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] text-[var(--text-secondary)]">Outstanding Today</p>
                <p className="text-[18px] font-bold text-[var(--text-primary)] mt-1">Rs. {fmt(totals.outstanding)}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[11px] text-[var(--text-secondary)]">Expenses Today</p>
                <p className="text-[18px] font-bold text-[var(--text-primary)] mt-1">Rs. {fmt(expenseTotal)}</p>
              </div>
            </div>

            <h3 className="mt-6 text-[14px] font-bold text-[var(--text-primary)]">Hotels</h3>
            {hotels.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--text-secondary)]">No income recorded for today yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {hotels.map((h) => (
                  <div key={h.name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-[13px] font-bold text-[var(--text-primary)]">{h.name}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-[var(--text-secondary)]">Income</p>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Rs. {fmt(h.income)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-secondary)]">Collected</p>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Rs. {fmt(h.collected)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-secondary)]">Outstanding</p>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">Rs. {fmt(h.outstanding)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expenses.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-[13px] font-bold text-[var(--text-primary)]">Expenses by Category</p>
                <div className="mt-3 space-y-2">
                  {expenses.map((e, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <p className="text-[12px] text-[var(--text-secondary)]">{e?.category || 'Uncategorized'}</p>
                      <p className="text-[12px] font-semibold text-[var(--text-primary)]">Rs. {fmt(e?.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
