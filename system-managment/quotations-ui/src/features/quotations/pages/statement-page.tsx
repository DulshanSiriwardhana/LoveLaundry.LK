import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, Download, FileText, Landmark, RotateCcw, Search, Truck, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { billService } from '../services/bill.service'
import { deliveries as deliveriesApi } from '../services/delivery.service'
import { returns as returnsApi } from '../services/returns.service'
import { payments } from '../services/reports.service'
import type { Bill } from '../../../types/bill'
import type { Delivery, Return, Payment } from '../../../types/operations'

interface StatementData {
  bills: Bill[]
  deliveries: Delivery[]
  returns: Return[]
  paymentsByBill: Record<string, Payment[]>
}

async function loadStatement(clientName: string): Promise<StatementData> {
  const [billsRes, dels, rets] = await Promise.all([
    billService.getBills({ client_name: clientName, limit: 200 }),
    deliveriesApi.list({ client_name: clientName }),
    returnsApi.list({ client_name: clientName, limit: 200 }),
  ])
  const bills = billsRes.items ?? []
  const paymentsEntries = await Promise.all(
    bills.map(async (b) => [b.id, await payments.listForBill(b.id)] as [string, Payment[]]),
  )
  return { bills, deliveries: dels, returns: rets.items ?? [], paymentsByBill: Object.fromEntries(paymentsEntries) }
}

type Row =
  | { kind: 'bill'; at: string; bill: Bill }
  | { kind: 'payment'; at: string; billId: string; client: string; payment: Payment }
  | { kind: 'delivery'; at: string; delivery: Delivery }
  | { kind: 'return'; at: string; ret: Return }

function dayOnly(ts?: string): string {
  return ts ? String(ts).slice(0, 10) : ''
}

function fmtMoney(n: number): string {
  return 'LKR ' + Number(n || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 })
}

function toCSV(rows: Row[]): string {
  const header = ['date', 'type', 'client', 'description', 'quantity', 'amount']
  const lines = rows.map((r) => {
    if (r.kind === 'bill') {
      return [r.at, 'BILL', r.bill.client_name, `Bill ${r.bill.id}`, String(r.bill.items?.reduce((s, it) => s + it.quantity, 0) ?? 0), String(r.bill.grand_total ?? r.bill.total_amount ?? 0)]
    }
    if (r.kind === 'payment') {
      return [r.at, 'PAYMENT', r.payment.client_name, `${r.payment.payment_method}${r.payment.reference ? ` (${r.payment.reference})` : ''}`, '', String(r.payment.amount)]
    }
    if (r.kind === 'delivery') {
      return [r.at, 'DELIVERY', r.delivery.client_name, r.delivery.items?.map(it => `${it.item_name} x${it.quantity}`).join('; ') ?? '', String(r.delivery.items?.reduce((s, it) => s + it.quantity, 0) ?? 0), '']
    }
    return [r.at, 'RETURN', r.ret.client_name, `Return ${r.ret.return_id}: ${r.ret.items?.map(it => `${it.item_name} x${it.returned_qty}`).join('; ') ?? ''}`, String(r.ret.items?.reduce((s, it) => s + it.returned_qty, 0) ?? 0), '']
  })
  const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [header, ...lines].map(row => row.map(esc).join(',')).join('\n')
}

function downloadCSV(rows: Row[], clientName: string): void {
  const blob = new Blob([`\uFEFF${toCSV(rows)}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `statement-${clientName.replace(/[^\w]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function StatementPage() {
  const [searchInput, setSearchInput] = useState('')
  const [clientName, setClientName] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['statement', clientName] as const,
    queryFn: () => loadStatement(clientName),
    enabled: Boolean(clientName.trim()),
  })

  const rows: Row[] = []
  if (data) {
    for (const bill of data.bills) {
      rows.push({ kind: 'bill', at: bill.created_at, bill })
      for (const p of data.paymentsByBill[bill.id] ?? []) {
        rows.push({ kind: 'payment', at: p.payment_date || p.created_at, billId: bill.id, client: bill.client_name, payment: p })
      }
    }
    for (const d of data.deliveries) rows.push({ kind: 'delivery', at: d.delivery_date, delivery: d })
    for (const r of data.returns) rows.push({ kind: 'return', at: r.created_at, ret: r })
  }
  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)))

  const activeBills = (data?.bills ?? []).filter(b => b.payment_status !== 'CANCELLED')
  const openBills = activeBills
    .filter(b => (b.payment_status ?? '') !== 'PAID')
    .sort((a, b) => (b.outstanding_amount ?? 0) - (a.outstanding_amount ?? 0))
  const billed = activeBills.reduce((s, b) => s + (b.grand_total ?? b.total_amount ?? 0), 0)
  const collected = (data?.bills ?? []).reduce(
    (s, b) => s + (data?.paymentsByBill[b.id] ?? []).reduce((t, p) => t + (p.amount || 0), 0),
    0,
  )
  const outstanding = activeBills.reduce((s, b) => s + (b.outstanding_amount ?? 0), 0)
  const returnedPieces = (data?.returns ?? []).reduce(
    (s, r) => s + (r.items ?? []).reduce((t, i) => t + (i.returned_qty || 0), 0),
    0,
  )

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Client Statement' },
          ]}
        />
        <h1 className="text-dashboard-title mt-1">Client Statement</h1>
        <p className="text-[13px] text-[#98A2B3] mt-0.5">
          Chronological money and quantity movements for one client
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchInput.trim() && setClientName(searchInput.trim())}
                placeholder="Enter client name…"
                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10 shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setClientName('') }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              className="h-10 bg-[#D97706] hover:bg-[#B45309] text-white"
              disabled={!searchInput.trim()}
              onClick={() => setClientName(searchInput.trim())}
            >
              View {' '}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {!clientName.trim() ? (
        <EmptyState
          icon={<Landmark className="h-6 w-6 text-[#9CA3AF]" />}
          title="Pick a client"
          description="Search by client name to see their bills, payments, deliveries and returns."
        />
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-40" />
        </div>
      ) : isError ? (
        <ErrorState description="Failed to load the statement. Check the client name and try again." />
      ) : !data || (data.bills.length === 0 && data.deliveries.length === 0 && data.returns.length === 0) ? (
        <EmptyState
          title={`No activity for "${clientName}"`}
          description="No bills, deliveries or returns were found for this client."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Total billed</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums">{fmtMoney(billed)}</p>
              <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{activeBills.length} bills</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Collected</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums text-emerald-600">{fmtMoney(collected)}</p>
              <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>across all payments</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Outstanding</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums" style={{ color: outstanding > 0 ? '#D97706' : 'var(--text-primary)' }}>
                {fmtMoney(outstanding)}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>on open bills</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Returns</p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums">{returnedPieces}</p>
              <p className="text-[11px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                {data.returns.length} return record{data.returns.length !== 1 ? 's' : ''}
              </p>
            </Card>
          </div>

          {openBills.length > 0 && (
            <Card>
              <CardHeader className="border-b border-[var(--border)] pb-3">
                <CardTitle className="text-[14px]">Collect outstanding</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-[var(--border)]">
                  {openBills.map((b) => {
                    const due = b.outstanding_amount ?? (b.grand_total ?? b.total_amount ?? 0) - (b.paid_amount ?? 0)
                    const collectedHere = (data?.paymentsByBill[b.id] ?? []).reduce((t, p) => t + (p.amount || 0), 0)
                    return (
                      <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">
                            Bill <span className="tabular-nums">{b.id}</span> · {b.payment_status}
                          </p>
                          <p className="text-[11px] text-[#98A2B3] tabular-nums">
                            Billed {fmtMoney(b.grand_total ?? b.total_amount ?? 0)} · Paid {fmtMoney(collectedHere)}
                          </p>
                        </div>
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: due > 0 ? '#D97706' : 'var(--text-primary)' }}>
                          {fmtMoney(due)}
                        </span>
                        <Link
                          to={`/bills/${b.id}`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#374151] hover:border-[#D97706] hover:text-[#B45309] transition-colors"
                        >
                          Record payment <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b border-[var(--border)] pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-[14px]">Movements</CardTitle>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 text-[12px]"
                  onClick={() => downloadCSV(rows, clientName)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {rows.map((row, i) => {
                  if (row.kind === 'bill') {
                    const b = row.bill
                    return (
                      <div key={`bil-${b.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-[#D97706]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">{b.client_name} — bill created</p>
                          <p className="text-[11px] text-[#98A2B3]">{b.items?.reduce((s, it) => s + it.quantity, 0) ?? 0} pcs · {b.payment_status}</p>
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums">{fmtMoney(b.grand_total ?? b.total_amount ?? 0)}</span>
                        <span className="w-24 text-right text-[11px] text-[#98A2B3] tabular-nums">{dayOnly(b.created_at)}</span>
                      </div>
                    )
                  }
                  if (row.kind === 'payment') {
                    const p = row.payment
                    return (
                      <div key={`pay-${p.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                        <Landmark className="h-4 w-4 shrink-0 text-emerald-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">{p.client_name} — payment</p>
                          <p className="text-[11px] text-[#98A2B3]">{p.payment_method}{p.reference ? ` · ${p.reference}` : ''}</p>
                        </div>
                        <span className="text-[12px] font-semibold tabular-nums text-emerald-600">+{fmtMoney(p.amount)}</span>
                        <span className="w-24 text-right text-[11px] text-[#98A2B3] tabular-nums">{dayOnly(p.payment_date || p.created_at)}</span>
                      </div>
                    )
                  }
                  if (row.kind === 'delivery') {
                    const d = row.delivery
                    return (
                      <div key={`del-${d.id}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                        <Truck className="h-4 w-4 shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium">{d.client_name} — delivery</p>
                          <p className="text-[11px] text-[#98A2B3]">
                            {d.items?.map(it => `${it.item_name} ×${it.quantity}`).join(', ') ?? '—'}
                          </p>
                        </div>
                        <span className="text-[12px] tabular-nums">
                          {(d.items ?? []).reduce((s, it) => s + (it.quantity || 0), 0)} pcs
                        </span>
                        <span className="w-24 text-right text-[11px] text-[#98A2B3] tabular-nums">{dayOnly(d.delivery_date)}</span>
                      </div>
                    )
                  }
                  const r = row.ret
                  return (
                    <div key={`ret-${r.return_id}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                      <RotateCcw className="h-4 w-4 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{r.client_name} — return{` ${r.return_id}`}</p>
                        <p className="text-[11px] text-[#98A2B3]">
                          {r.items?.map(it => `${it.item_name} ×${it.returned_qty}`).join(', ') ?? '—'}
                        </p>
                      </div>
                      <span className="text-[12px] tabular-nums">
                        {(r.items ?? []).reduce((s, it) => s + (it.returned_qty || 0), 0)} pcs
                      </span>
                      <span className="w-24 text-right text-[11px] text-[#98A2B3] tabular-nums">{dayOnly(r.created_at)}</span>
                    </div>
                  )
                })}
              </div>
              {rows.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px] text-[#98A2B3]">No movements found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}