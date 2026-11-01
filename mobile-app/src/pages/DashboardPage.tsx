import { useEffect, useMemo, useState } from 'react'
import {
  clearSession,
  fetchBillsForToday,
  fetchExpensesToday,
  getTodayStr,
  type Bill,
  type ExpenseCategoryTotal,
} from '../api'

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
    <div className="min-h-screen w-full bg-[#F9FAFB] pb-10">
      <div className="sticky top-0 z-10 bg-[#101828] px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[18px] font-bold text-white">LoveLaundry</p>
            <p className="text-[11px] text-[#98A2B3] mt-0.5">{today}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="h-9 px-3 rounded-xl bg-[#1D2939] text-white text-[12px] font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-[16px] font-bold text-[#101828]">Today's Analytics</h2>
        <p className="text-[11px] text-[#98A2B3] mt-0.5">Income &amp; expenses for {today}</p>

        {error ? <p className="mt-4 text-[13px] text-[#DC2626]">{error}</p> : null}

        {loading ? (
          <p className="mt-6 text-[13px] text-[#6B7280]">Loading…</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <p className="text-[11px] text-[#6B7280]">Income Today</p>
                <p className="text-[18px] font-bold text-[#101828] mt-1">Rs. {fmt(totals.income)}</p>
              </div>
              <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <p className="text-[11px] text-[#6B7280]">Collected Today</p>
                <p className="text-[18px] font-bold text-[#101828] mt-1">Rs. {fmt(totals.collected)}</p>
              </div>
              <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <p className="text-[11px] text-[#6B7280]">Outstanding Today</p>
                <p className="text-[18px] font-bold text-[#101828] mt-1">Rs. {fmt(totals.outstanding)}</p>
              </div>
              <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <p className="text-[11px] text-[#6B7280]">Expenses Today</p>
                <p className="text-[18px] font-bold text-[#101828] mt-1">Rs. {fmt(expenseTotal)}</p>
              </div>
            </div>

            <h3 className="mt-6 text-[14px] font-bold text-[#101828]">Hotels</h3>
            {hotels.length === 0 ? (
              <p className="mt-3 text-[13px] text-[#6B7280]">No income recorded for today yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {hotels.map((h) => (
                  <div key={h.name} className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                    <p className="text-[13px] font-bold text-[#101828]">{h.name}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-[#6B7280]">Income</p>
                        <p className="text-[13px] font-semibold text-[#101828]">Rs. {fmt(h.income)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#6B7280]">Collected</p>
                        <p className="text-[13px] font-semibold text-[#101828]">Rs. {fmt(h.collected)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#6B7280]">Outstanding</p>
                        <p className="text-[13px] font-semibold text-[#101828]">Rs. {fmt(h.outstanding)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expenses.length > 0 ? (
              <div className="mt-6 rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <p className="text-[13px] font-bold text-[#101828]">Expenses by Category</p>
                <div className="mt-3 space-y-2">
                  {expenses.map((e, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <p className="text-[12px] text-[#374151]">{e?.category || 'Uncategorized'}</p>
                      <p className="text-[12px] font-semibold text-[#101828]">Rs. {fmt(e?.total)}</p>
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
