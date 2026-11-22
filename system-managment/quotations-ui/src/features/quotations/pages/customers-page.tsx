import { useMemo, useState } from 'react'
import { Users, FileText, ClipboardCheck, Truck, Banknote, Search, ShoppingBag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { formatDate } from '../../../lib/utils'
import { useQuotations } from '../hooks/useQuotations'
import { useGatePasses } from '../hooks/useGatePasses'
import { useDeliveries } from '../hooks/useDeliveries'
import { useBills } from '../hooks/useBills'
import { useLoyaltyAccount, useAdjustLoyalty } from '../hooks/useLoyalty'
import { reports } from '../services/reports.service'
import type { ClientSummary } from '../../../types/operations'

export default function CustomersPage() {
  const [client, setClient] = useState('')
  const [active, setActive] = useState('')

  const { data: allQuotations = [] } = useQuotations()
  const { data: gatePasses = [] } = useGatePasses(
    active ? { client_name: active } : undefined,
  )
  const { data: deliveries = [] } = useDeliveries(
    active ? { client_name: active } : undefined,
  )
  const { data: billsResp } = useBills(active ? { client_name: active } : undefined)

  const bills = useMemo(() => billsResp?.items ?? [], [billsResp])

  const { data: loyalty } = useLoyaltyAccount(active || undefined)
  const adjustLoyalty = useAdjustLoyalty()

  const { data: clientSummary } = useQuery<ClientSummary>({
    queryKey: ['client-summary', active],
    queryFn: () => reports.clientSummary(active),
    enabled: Boolean(active),
  })

  const quotations = useMemo(() => {
    if (!active) return []
    const q = active.toLowerCase()
    return allQuotations.filter((x) => (x.client_name ?? '').toLowerCase().includes(q))
  }, [allQuotations, active])

  const matchNames = useMemo(() => {
    if (!client) return []
    const q = client.toLowerCase()
    const set = new Set<string>()
    allQuotations.forEach((x) => {
      if ((x.client_name ?? '').toLowerCase().includes(q)) set.add(x.client_name)
    })
    return Array.from(set).slice(0, 8)
  }, [client, allQuotations])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-[20px] font-bold text-[var(--text-primary)]">
          <Users className="h-5 w-5 text-[var(--danger-deep)]" />
          Customer 360
        </h1>
        <p className="text-[13px] text-[var(--brand-text)]">
          Unified view of a customer across quotations, gate passes, deliveries and billing.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && matchNames[0] && setActive(matchNames[0])}
            placeholder="Search customer by name…"
            className="w-full rounded-lg border border-[var(--border)] py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-[var(--danger-deep)]"
          />
        </div>
        <Button
          onClick={() => matchNames[0] && setActive(matchNames[0])}
          disabled={!matchNames[0]}
        >
          Lookup
        </Button>
      </div>

      {matchNames.length > 0 && !active && (
        <div className="flex flex-wrap gap-2">
          {matchNames.map((n) => (
            <button
              key={n}
              onClick={() => setActive(n)}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-deep)] hover:border-[var(--danger-border)] hover:text-[var(--danger-deep)]"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">{active}</h2>
            <button
              onClick={() => setActive('')}
              className="text-[12px] font-semibold text-[var(--brand-text)] hover:text-[var(--danger-deep)]"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              icon={<FileText className="h-4 w-4" />}
              label="Quotations"
              value={quotations.length}
            />
            <Stat
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="Gate Passes"
              value={gatePasses.length}
            />
            <Stat
              icon={<Truck className="h-4 w-4" />}
              label="Deliveries"
              value={deliveries.length}
            />
            <Stat
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Shop Bills"
              value={clientSummary?.stats?.total_shop_bills ?? 0}
            />
            <Stat
              icon={<Banknote className="h-4 w-4" />}
              label="Outstanding"
              value={`LKR ${(
                (clientSummary?.stats?.outstanding_amount ?? 0) +
                (clientSummary?.stats?.shop_outstanding ?? 0)
              ).toLocaleString()}`}
            />
          </div>

          {loyalty && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--danger-deep)]">
                    <Banknote className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                      Loyalty · {loyalty.tier}
                    </p>
                    <p className="text-[20px] font-bold text-[var(--text-primary)]">
                      {loyalty.points} pts
                    </p>
                    <p className="text-[11px] text-[var(--brand-text)]">
                      {loyalty.visits} visit(s)
                    </p>
                  </div>
                </div>
                <LoyaltyAdjust
                  onAdjust={(delta) =>
                    adjustLoyalty.mutate({
                      client_name: active,
                      delta_points: delta,
                    })
                  }
                  pending={adjustLoyalty.isPending}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Recent Quotations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quotations.length === 0 && <Empty text="No quotations" />}
                {quotations.slice(0, 5).map((q) => (
                  <Row
                    key={String(q.id)}
                    title={q.quotation_title || 'Quotation'}
                    sub={formatDate(q.created_at ?? '')}
                    tag={q.status}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {bills.length === 0 && <Empty text="No bills" />}
                {bills.slice(0, 5).map((b) => (
                  <Row
                    key={String(b.id)}
                    title={b.quotation_title || 'Bill'}
                    sub={`LKR ${(b.grand_total ?? 0).toLocaleString()} · ${b.payment_status}`}
                    tag={b.payment_status}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Gate Passes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {gatePasses.length === 0 && <Empty text="No gate passes" />}
                {gatePasses.slice(0, 5).map((g: any) => (
                  <Row
                    key={String(g.id)}
                    title={g.gate_pass_number || 'Gate Pass'}
                    sub={formatDate(g.created_at ?? '')}
                    tag={g.status}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Deliveries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {deliveries.length === 0 && <Empty text="No deliveries" />}
                {deliveries.slice(0, 5).map((d: any) => (
                  <Row
                    key={String(d.id)}
                    title={d.client_name}
                    sub={formatDate(d.delivery_date ?? '')}
                    tag={d.status}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-[14px] flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Shop Bills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!clientSummary?.shop_bills?.length && <Empty text="No shop bills" />}
                {(clientSummary?.shop_bills ?? []).slice(0, 5).map((sb: any) => (
                  <Row
                    key={String(sb.id)}
                    title={sb.bill_number || 'Shop Bill'}
                    sub={`LKR ${(sb.grand_total ?? 0).toLocaleString()} · ${sb.payment_status}`}
                    tag={sb.payment_status}
                  />
                ))}
                {clientSummary?.stats && (
                  <div className="mt-2 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--brand-text)]">
                    Total: LKR {(clientSummary.stats.total_shop_billed ?? 0).toLocaleString()} ·
                    Paid: LKR {(clientSummary.stats.total_shop_paid ?? 0).toLocaleString()} ·
                    Outstanding: LKR {(clientSummary.stats.shop_outstanding ?? 0).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--danger-deep)]">
          {icon}
        </div>
        <div>
          <p className="text-[11px] text-[var(--text-faint)]">{label}</p>
          <p className="text-[16px] font-bold text-[var(--text-primary)]">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  title,
  sub,
  tag,
}: {
  title: string
  sub: string
  tag?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2">
      <div>
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{title}</p>
        <p className="text-[11px] text-[var(--text-faint)]">{sub}</p>
      </div>
      {tag && (
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--brand-deep)]">
          {tag}
        </span>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12px] text-[var(--text-faint)]">{text}</p>
}

function LoyaltyAdjust({
  onAdjust,
  pending,
}: {
  onAdjust: (delta: number) => void
  pending: boolean
}) {
  const [delta, setDelta] = useState('')
  const apply = (sign: number) => {
    const n = Number(delta)
    if (!n) return
    onAdjust(sign * n)
    setDelta('')
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        placeholder="points"
        className="w-20 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] outline-none focus:border-[var(--danger-deep)]"
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => apply(1)}>
        Earn
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => apply(-1)}>
        Redeem
      </Button>
    </div>
  )
}
