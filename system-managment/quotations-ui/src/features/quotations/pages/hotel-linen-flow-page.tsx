import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ClipboardList,
  Clock,
  Search,
  Sun,
  Truck,
  X,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { formatDate } from '../../../lib/utils'
import { useLinenFlow } from '../hooks/useLinenFlow'
import { useDeliveries } from '../hooks/useDeliveries'
import type { GatePass, Delivery, LinenFlowResponse } from '../../../types/operations'

// ── Tree scene constants ──────────────────────────────────────────────────────
const W = 1000
const H = 620
const MARGIN = 70
const Y_LEAF = 172
const Y_GP = 322
const Y_ROOT = 480
const MAX_LEAVES = 56
const MAX_GPS = 25

const PALETTES: Array<[string, string]> = [
  ['#EFF6FF', '#F0FDF4'],
  ['#FDF2F8', '#EFF6FF'],
  ['#FEFCE8', '#ECFDF5'],
  ['#F5F3FF', '#FEFCE8'],
]

function hotelPalette(name: string): [string, string] {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTES[hash % PALETTES.length]
}

function pieces(items: { item_name?: string; quantity?: number; received_qty?: number }[]) {
  return (items ?? []).reduce((sum, i) => sum + Number(i.quantity ?? i.received_qty ?? 0), 0)
}

function gpKey(gp: GatePass) {
  return gp?.id || (gp as any)?.gate_pass_id || (gp as any)?._id || ''
}

type Period = 'all' | 'month' | 'quarter' | 'year'

interface GpNode {
  /** The gate pass document, for identity and navigation only. */
  gp: GatePass
  /** Server-computed. Never derived in the browser. */
  received: number
  delivered: number
  pending: number
  /** Only the lines still owing linen, from the server's balance. */
  outstandingItems: LinenFlowResponse['hotels'][number]['gate_passes'][number]['outstanding_items']
  /** Delivery rows that drew from this pass, for the leaf chips. */
  deliveries: Delivery[]
}

interface HotelNode {
  name: string
  gatePasses: GpNode[]
  unlinked: Delivery[]
  received: number
  delivered: number
  /** Server-computed, and it accounts for returns. */
  pending: number
}

interface Fruit {
  key: string
  kind: 'delivery' | 'pending' | 'unlinked'
  x: number
  y: number
  label: string
  chips: string[]
  title: string
  sub: string
  to?: string
}

interface GpSpot {
  gp: GatePass
  x: number
  y: number
  received: number
  delivered: number
  pending: number
  fruits: Fruit[]
}

interface HoverState {
  x: number
  y: number
  title: string
  sub: string
  chips: string[]
  tone: 'blue' | 'green' | 'amber' | 'gray'
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function statusColors(status?: string) {
  switch (status) {
    case 'DELIVERED':
      return { back: '#BBF7D0', mid: '#86EFAC', deep: '#16A34A', dark: '#15803D' }
    case 'PARTIALLY_DELIVERED':
      return { back: '#FDE68A', mid: '#FCD34D', deep: '#F59E0B', dark: '#B45309' }
    case 'READY_FOR_DELIVERY':
      return { back: '#D1FAE5', mid: '#A7F3D0', deep: '#10B981', dark: '#047857' }
    case 'PROCESSING':
      return { back: '#FFEDD5', mid: '#FDBA74', deep: '#F97316', dark: '#C2410C' }
    case 'CANCELLED':
      return { back: '#E5E7EB', mid: '#D1D5DB', deep: '#9CA3AF', dark: '#6B7280' }
    default:
      return { back: '#BFDBFE', mid: '#93C5FD', deep: '#3B82F6', dark: '#2563EB' }
  }
}

const TONE_TEXT: Record<HoverState['tone'], string> = {
  blue: 'text-[#2563EB]',
  green: 'text-[#16A34A]',
  amber: 'text-[#D97706]',
  gray: 'text-[#6B7280]',
}

const TONE_BG: Record<HoverState['tone'], string> = {
  blue: 'border-[#BFDBFE]',
  green: 'border-[#BBF7D0]',
  amber: 'border-[#FDE68A]',
  gray: 'border-[#E4E7EC]',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HotelLinenFlowPage() {
  const [searchInput, setSearchInput] = useState('')
  const [hotelSearch, setHotelSearch] = useState('')
  const [period, setPeriod] = useState<Period>('all')

  // Every quantity on this screen comes from the server's balance engine.
  // Deliveries are still fetched, but only to render the leaf chips — the
  // numbers are never derived from them here.
  const { data: flow, isLoading: flowLoading, isError: flowError, error: flowErrorObj } = useLinenFlow(period)
  const { data: rawDeliveries = [], isLoading: delLoading, isError: delError, error: delErrorObj } = useDeliveries()

  const isLoading = flowLoading || delLoading
  const isError = flowError || delError
  const errorMessage = (flowErrorObj ?? delErrorObj) instanceof Error
    ? ((flowErrorObj ?? delErrorObj) as Error).message
    : 'Unable to load linen flow data'

  const hotels = useMemo<HotelNode[]>(() => {
    const byHotel = new Map<string, HotelNode>()
    const pushHotel = (name: string) => {
      const key = name || 'Unknown'
      if (!byHotel.has(key)) {
        byHotel.set(key, {
          name: key,
          gatePasses: [],
          unlinked: [],
          received: 0,
          delivered: 0,
          pending: 0,
        })
      }
      return byHotel.get(key)!
    }

    // Index deliveries by every pass they drew from, so a delivery spanning two
    // passes shows up under both. The old code matched on the delivery's own
    // gate_pass_id only, which hung all of its pieces off the primary pass and
    // left the other pass looking untouched.
    const deliveriesByGp = new Map<string, Delivery[]>()
    const linkedIds = new Set<string>()
    for (const d of rawDeliveries ?? []) {
      if (d.status === 'CANCELLED') continue
      const ids = (d.source_gate_pass_ids?.length ? d.source_gate_pass_ids : [d.gate_pass_id])
        .filter(Boolean)
        .map(String)
      if (ids.length === 0) continue
      linkedIds.add(d.id)
      for (const id of ids) {
        const bucket = deliveriesByGp.get(id)
        if (bucket) bucket.push(d)
        else deliveriesByGp.set(id, [d])
      }
    }

    for (const hotelRow of flow?.hotels ?? []) {
      const hotel = pushHotel(hotelRow.client_name)
      // Every field below comes off a newly added endpoint, so normalise the
      // nested objects rather than trusting the type. A missing `totals` or
      // `gate_passes` used to throw from deep inside this memo and take the
      // whole page down with it.
      const totals = hotelRow.totals ?? ({} as LinenFlowResponse['hotels'][number]['totals'])
      hotel.received = Number(totals.received_qty ?? 0)
      hotel.delivered = Number(totals.delivered_qty ?? 0)
      // Server-computed, so a piece the client gave back stops showing as owed.
      hotel.pending = Number(totals.outstanding_delivery_qty ?? 0)

      for (const gpRow of hotelRow.gate_passes ?? []) {
        // The pass document is only needed for its id / number here; every
        // number comes from the server's balance.
        const gp = { id: gpRow.gate_pass_id, gate_pass_number: gpRow.gate_pass_number } as GatePass
        const gpTotals = gpRow.totals ?? ({} as LinenFlowResponse['hotels'][number]['gate_passes'][number]['totals'])
        hotel.gatePasses.push({
          gp,
          received: Number(gpTotals.received_qty ?? 0),
          delivered: Number(gpTotals.delivered_qty ?? 0),
          pending: Number(gpTotals.outstanding_delivery_qty ?? 0),
          outstandingItems: gpRow.outstanding_items ?? [],
          deliveries: deliveriesByGp.get(gpRow.gate_pass_id) ?? [],
        })
      }

      for (const u of hotelRow.unlinked_deliveries ?? []) {
        const d = (rawDeliveries ?? []).find(x => x.id === u.delivery_id)
        if (d) hotel.unlinked.push(d)
      }
    }

    const list = [...byHotel.values()]
    for (const hotel of list) {
      hotel.gatePasses.sort((a, b) =>
        String(b.gp.gate_pass_number ?? '').localeCompare(String(a.gp.gate_pass_number ?? ''))
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [flow, rawDeliveries])

  const query = hotelSearch.trim().toLowerCase()
  const filteredHotels = query
    ? hotels.filter(h => h.name.toLowerCase().includes(query))
    : hotels

  const totals = useMemo(() => {
    let gatePassCount = 0
    let received = 0
    let delivered = 0
    let pending = 0
    for (const h of filteredHotels) {
      gatePassCount += h.gatePasses.length
      received += h.received
      delivered += h.delivered
      pending += h.pending
    }
    // Summed per hotel rather than computed as `received - delivered`, so
    // returns and count corrections are reflected.
    return { gatePassCount, received, delivered, pending }
  }, [filteredHotels])

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Hotel Linen Flow' }]} />
          <h1 className="text-dashboard-title mt-1">Hotel Linen Flow</h1>
          <p className="text-[13px] text-[#98A2B3] mt-0.5">
            {isLoading
              ? 'Loading…'
              : `${filteredHotels.length} hotel${filteredHotels.length !== 1 ? 's' : ''} · ${totals.gatePassCount} gate passes visible`}
          </p>
          <SyncStatusBar queryKey={['gatepasses']} label="Gate passes" className="mt-2" />
        </div>
        <div className="hidden md:flex flex-col gap-1 rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">How to read</p>
          <ul className="text-[11.5px] text-[#475569] space-y-1">
            <li><span className="text-[#2563EB] font-semibold">● Blue clusters</span> are gate passes (items received)</li>
            <li><span className="text-[#16A34A] font-semibold">● Green fruits</span> are deliveries (items out)</li>
            <li><span className="text-[#D97706] font-semibold">● Amber fruit</span> = pieces still pending</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Hotels', value: filteredHotels.length, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Gate Passes', value: totals.gatePassCount, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Pcs Received', value: totals.received, color: '#15803D', bg: '#F0FDF4' },
          { label: 'Pcs Remaining', value: Math.max(totals.pending, 0), color: totals.pending > 0 ? '#D97706' : '#16A34A', bg: totals.pending > 0 ? '#FFFBEB' : '#F0FDF4' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold" style={{ background: stat.bg, color: stat.color }}>
                {stat.value}
              </div>
              <p className="text-[12px] font-medium text-[#667085]">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyUp={e => {
              if (e.key === 'Enter') setHotelSearch(searchInput.trim())
            }}
            placeholder="Search hotel…"
            className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 shadow-sm"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setHotelSearch('') }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value as Period)}
          className="h-10 appearance-none rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 shadow-sm cursor-pointer"
        >
          <option value="all">All time</option>
          <option value="month">This month</option>
          <option value="quarter">Last 3 months</option>
          <option value="year">This year</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState description={errorMessage} />
      ) : filteredHotels.length === 0 ? (
        <EmptyState
          title={query ? 'No hotels match your search' : 'No gate passes or deliveries yet'}
          description={query ? 'Try a different hotel name.' : 'Record a gate pass when laundry is received from a hotel.'}
          action={
            !query && (
              <Link to="/gate-passes/new">
                <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                  <ClipboardList className="h-4 w-4" /> New Gate Pass
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredHotels.map((hotel, i) => (
            <motion.div
              key={hotel.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <HotelTreeCard hotel={hotel} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SVG Tree scene ─────────────────────────────────────────────────────────────
const CSS = `
  @keyframes llf-draw { to { stroke-dashoffset: 0 } }
  @keyframes llf-grow { from { opacity: 0; transform: scale(0.15) } to { opacity: 1; transform: scale(1) } }
  @keyframes llf-sway { 0%,100% { transform: rotate(-2.2deg) } 50% { transform: rotate(2.2deg) } }
  @keyframes llf-pulse { 0%,100% { transform: scale(1); opacity: .92 } 50% { transform: scale(1.18); opacity: 1 } }
  @keyframes llf-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
  .llf-growy { transform-box: fill-box; transform-origin: center center; animation: llf-grow .45s cubic-bezier(.2,.8,.3,1.2) forwards; opacity: 0 }
  .llf-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: llf-sway 4.5s ease-in-out infinite }
  .llf-pulsey { transform-box: fill-box; transform-origin: center center; animation: llf-pulse 2s ease-in-out infinite }
  .llf-floaty { transform-box: fill-box; transform-origin: center center; animation: llf-float 5s ease-in-out infinite }
  .llf-branch { stroke: #A16207; stroke-linecap: round; fill: none; stroke-dasharray: 1; stroke-dashoffset: 1; animation: llf-draw .55s ease forwards }
  .llf-branch-main { stroke: #92400E; stroke-width: 3.5 }
  .llf-branch-twig { stroke: #B45309; stroke-width: 2 }
  .llf-fo { pointer-events: none }
`

function slotXs(count: number): number[] {
  if (count <= 0) return []
  const inner = W - MARGIN * 2
  return Array.from({ length: count }, (_, i) => MARGIN + (i + 0.5) * (inner / count))
}

function HotelTreeCard({ hotel }: { hotel: HotelNode }) {
  const [hover, setHover] = useState<HoverState | null>(null)
  const [bgFrom, bgTo] = hotelPalette(hotel.name)

  const scene = useMemo(() => {
    const gps: GpSpot[] = []
    const unlinked: Fruit[] = []
    let leafBudget = MAX_LEAVES
    const pending = hotel.pending

    for (const g of hotel.gatePasses) {
      if (gps.length >= MAX_GPS) break
      const leaves: Fruit[] = g.deliveries.map(d => ({
        key: `d-${d.id ?? gps.length}`,
        kind: 'delivery' as const,
        x: 0,
        y: Y_LEAF,
        label: (d.delivery_date ?? '').slice(5, 10),
        title: `Delivery ${(d.id ?? '').slice(0, 8)}`,
        sub: `${formatDate(d.delivery_date)} · ${pieces(d.items ?? [])} pcs`,
        chips: (d.items ?? []).map(i => `${i.item_name}${i.specification ? ` (${i.specification})` : ''} ×${i.quantity}`),
        to: d.id ? `/deliveries/${d.id}` : undefined,
      }))
      // Server-computed shortfall. Previously this was `received - delivered`
      // computed in the browser, and the chips listed every line the pass was
      // received with — including lines already fully delivered.
      const gpPending = g.pending
      if (gpPending > 0) {
        leaves.push({
          key: `p-${gpKey(g.gp)}`,
          kind: 'pending' as const,
          x: 0,
          y: Y_LEAF,
          label: 'pending',
          title: `Pending pieces`,
          sub: `${gpPending} pcs not delivered yet`,
          chips: g.outstandingItems.map(
            i =>
              `${i.item_name}${i.specification ? ` (${i.specification})` : ''} ×${i.outstanding_delivery_qty}`
                + (i.returned_back_qty > 0 ? ` (${i.returned_back_qty} returned)` : '')
          ),
        })
      }
      const count = leaves.length > 0 ? leaves.length : 1
      if (leafBudget - count < 0) break
      leafBudget -= count
      gps.push({ gp: g.gp, x: 0, y: Y_GP, received: g.received, delivered: g.delivered, pending: gpPending, fruits: leaves })
    }

    const excess = hotel.gatePasses.length - gps.length

    for (const d of hotel.unlinked) {
      unlinked.push({
        key: `u-${d.id ?? 'x'}`,
        kind: 'unlinked' as const,
        x: 0,
        y: Y_LEAF,
        label: 'no GP',
        title: `Delivery ${(d.id ?? '').slice(0, 8)}`,
        sub: `${formatDate(d.delivery_date)} · no matching gate pass`,
        chips: (d.items ?? []).map(i => `${i.item_name} ×${i.quantity}`),
        to: d.id ? `/deliveries/${d.id}` : undefined,
      })
    }

    const totalLeaves = gps.reduce((s, g) => s + Math.max(g.fruits.length, 1), 0) + unlinked.length
    if (totalLeaves === 0) return null

    const xs = slotXs(totalLeaves)
    let cursor = 0
    for (const g of gps) {
      const n = Math.max(g.fruits.length, 1)
      if (g.fruits.length > 0) {
        for (const f of g.fruits) f.x = xs[cursor]
        g.x = g.fruits.reduce((s, f) => s + f.x, 0) / g.fruits.length
      } else {
        g.x = xs[cursor]
      }
      cursor += n
    }
    for (const f of unlinked) f.x = xs[cursor++]

    const rootX = (gps.length + unlinked.length) > 0
      ? (gps.reduce((s, g) => s + g.x, 0) + unlinked.reduce((s, f) => s + f.x, 0)) / (gps.length + unlinked.length)
      : W / 2

    function mainBranch(gx: number) {
      const mx = (rootX + gx) / 2
      return `M ${rootX} ${Y_ROOT} Q ${mx} ${(Y_ROOT + Y_GP) / 2} ${gx} ${Y_GP}`
    }
    function twig(fromX: number, toX: number) {
      const mx = (fromX + toX) / 2
      return `M ${fromX} ${Y_GP} Q ${mx} ${(Y_GP + Y_LEAF) / 2} ${toX} ${Y_LEAF}`
    }

    const branchPaths: Array<{ d: string; main: boolean }> = [
      ...gps.map(g => ({ d: mainBranch(g.x), main: true })),
      ...gps.flatMap(g => g.fruits.map(f => ({ d: twig(g.x, f.x), main: false }))),
      ...unlinked.map(f => {
        const mx = (rootX + f.x) / 2
        return { d: `M ${rootX} ${Y_ROOT} Q ${mx} ${(Y_ROOT + Y_LEAF) / 2} ${f.x} ${Y_LEAF}`, main: false }
      }),
    ]

    return { gps, unlinked, rootX, branchPaths, excess, totalLeaves, pending }
  }, [hotel])

  if (!scene) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#101828] truncate">{hotel.name}</p>
            <p className="text-[11px] text-[#98A2B3]">No gate passes in this period.</p>
          </div>
        </div>
      </Card>
    )
  }

  const { gps, unlinked, rootX, branchPaths, excess, pending } = scene
  const root: HoverState = {
    x: rootX,
    y: Y_ROOT,
    title: hotel.name,
    sub: `${hotel.received} pcs received · ${hotel.delivered} delivered`,
    chips: [`${Math.max(pending, 0)} pcs still pending`],
    tone: pending > 0 ? 'amber' : 'green',
  }
  const totalLeaves = gps.reduce((s, g) => s + Math.max(g.fruits.length, 1), 0) + unlinked.length

  const hoverPct = hover ? {
    left: Math.min(Math.max((hover.x / W) * 100, 14), 86),
    top: Math.min(Math.max((hover.y / H) * 100, 18), 78),
    below: (hover.y / H) * 100 < 30,
  } : null

  return (
    <Card className="overflow-hidden p-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F2F4F7]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#101828] truncate">{hotel.name}</p>
          <p className="text-[11px] text-[#98A2B3]">
            {hotel.gatePasses.length} gate pass{hotel.gatePasses.length !== 1 ? 'es' : ''}
            {' · '}{hotel.received} in · {hotel.delivered} out
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pending > 0 ? 'bg-[#FFFBEB] text-[#D97706]' : 'bg-[#F0FDF4] text-[#16A34A]'}`}>
          {Math.max(pending, 0)} remaining
        </span>
      </div>

      {/* Tree */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block"
          style={{ background: `linear-gradient(180deg, ${bgFrom} 0%, ${bgTo} 100%)` }}
        >
          <style>{CSS}</style>
          <defs>
            <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#92400E" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>
            <radialGradient id="sunGrad">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="100%" stopColor="#FDE047" />
            </radialGradient>
          </defs>

          {/* Sun + clouds */}
          <g className="llf-floaty" style={{ animationDelay: '0.4s' }}>
            <circle cx={880} cy={96} r={34} fill="url(#sunGrad)" opacity={0.9} />
            <circle cx={880} cy={96} r={46} fill="#FEF9C3" opacity={0.28} />
            <Sun x={880 - 9} y={96 - 9} width={18} height={18} color="#D97706" opacity={0.85} />
          </g>
          <g className="llf-floaty" style={{ animationDelay: '0.9s' }}>
            <ellipse cx={180} cy={92} rx={46} ry={13} fill="#FFFFFF" opacity={0.85} />
            <ellipse cx={204} cy={84} rx={26} ry={11} fill="#FFFFFF" opacity={0.9} />
            <ellipse cx={620} cy={62} rx={38} ry={11} fill="#FFFFFF" opacity={0.8} />
            <ellipse cx={644} cy={55} rx={22} ry={9} fill="#FFFFFF" opacity={0.85} />
          </g>

          {/* Ground */}
          <ellipse cx={W / 2} cy={604} rx={560} ry={30} fill="#D3F2DF" opacity={0.9} />
          <ellipse cx={W / 2} cy={604} rx={470} ry={20} fill="#BEE9CE" opacity={0.7} />
          <g opacity={0.8} fill="#86C99B">
            <path d="M140 604 q3 -10 6 0 q-3 -4 -6 0" />
            <path d="M156 608 q2 -8 5 0 q-2 -3 -5 0" />
            <path d="M820 598 q3 -11 7 0 q-3 -4 -7 0" />
            <path d="M398 616 q2 -9 5 0 q-2 -3 -5 0" />
            <path d="M700 612 q3 -10 6 0 q-3 -4 -6 0" />
          </g>
          <circle cx={208} cy={602} r={3.5} fill="#FCD34D" />
          <circle cx={826} cy={596} r={3} fill="#FDBA74" />
          <circle cx={420} cy={616} r={3} fill="#FCD34D" />

          {/* Trunk */}
          <path
            d={`M ${rootX - 18} 600 L ${rootX - 10} ${Y_ROOT + 22} Q ${rootX} ${Y_ROOT + 14} ${rootX + 10} ${Y_ROOT + 22} L ${rootX + 18} 600 Q ${rootX} 608 ${rootX - 18} 600 Z`}
            fill="url(#trunkGrad)"
            className="llf-growy"
          />
          <path
            d={`M ${rootX - 18} 600 L ${rootX - 10} ${Y_ROOT + 22} Q ${rootX} ${Y_ROOT + 14} ${rootX + 10} ${Y_ROOT + 22} L ${rootX + 18} 600 Q ${rootX} 608 ${rootX - 18} 600 Z`}
            fill="none"
            stroke="#78350F"
            strokeOpacity={0.4}
          />

          {/* Branches */}
          {branchPaths.map((b, i) => (
            <path
              key={i}
              d={b.d}
              pathLength={1}
              className={`llf-branch ${b.main ? 'llf-branch-main' : 'llf-branch-twig'}`}
              style={{ animationDelay: `${0.15 + i * 0.045}s` }}
            />
          ))}

          {/* Root node */}
          <g
            className="cursor-pointer"
            onMouseEnter={() => setHover(root)}
            onMouseLeave={() => setHover(null)}
          >
            <g className="llf-growy" style={{ animationDelay: '0.05s' }}>
              <circle cx={rootX} cy={Y_ROOT} r={25} fill="url(#trunkGrad)" stroke="#FEF3C7" strokeWidth={3} />
            </g>
            <foreignObject x={rootX - 12} y={Y_ROOT - 12} width={24} height={24} className="llf-fo">
              <div className="flex h-full w-full items-center justify-center text-white">
                <Building2 size={16} />
              </div>
            </foreignObject>
          </g>

          {/* Gate pass clusters */}
          {gps.map((g, gi) => {
            const c = statusColors(g.gp?.status)
            const delay = 0.25 + gi * 0.05
            return (
              <g
                key={gpKey(g.gp)}
                className="cursor-pointer"
                onMouseEnter={() => setHover({
                  x: g.x,
                  y: g.y,
                  title: g.gp.gate_pass_number || 'Gate pass',
                  sub: `${formatDate(g.gp.receiving_date)} · ${g.received} pcs received · ${g.delivered} delivered`,
                  chips: (g.gp.items ?? []).filter(i => (i.received_qty ?? 0) > 0).map(i => `${i.item_name} ×${i.received_qty}`),
                  tone: c.dark === '#15803D' || c.dark === '#047857'
                    ? 'green'
                    : c.dark === '#B45309' ? 'amber' : 'blue',
                })}
                onMouseLeave={() => setHover(null)}
              >
                <g className="llf-growy" style={{ animationDelay: `${delay}s` }}>
                  <g className="llf-sway" style={{ animationDelay: `${gi * 0.7}s` }}>
                    <circle cx={g.x - 9} cy={g.y + 8} r={10.5} fill={c.back} stroke={c.mid} strokeWidth={1.5} />
                    <circle cx={g.x + 9} cy={g.y + 8} r={10.5} fill={c.back} stroke={c.mid} strokeWidth={1.5} />
                    <circle cx={g.x} cy={g.y - 3} r={12.5} fill={c.deep} stroke={c.dark} strokeWidth={1.5} />
                  </g>
                </g>
                <foreignObject x={g.x - 9} y={g.y - 15} width={18} height={18} className="llf-fo">
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <ClipboardList size={13} />
                  </div>
                </foreignObject>
                <text x={g.x} y={g.y + 36} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="#475569">
                  {g.gp.gate_pass_number || 'GP'}
                </text>
              </g>
            )
          })}

          {/* Fruits: deliveries + pending + unlinked */}
          {[...gps.flatMap(g => g.fruits), ...unlinked].map((f, fi) => {
            const del = f.kind === 'delivery'
            const pend = f.kind === 'pending'
            const unl = f.kind === 'unlinked'
            const fill = pend ? '#F59E0B' : unl ? '#9CA3AF' : '#16A34A'
            const stroke = pend ? '#D97706' : unl ? '#6B7280' : '#15803D'
            const glow = pend ? '#FDE68A' : unl ? '#E5E7EB' : '#BBF7D0'
            const Icon = pend ? Clock : del ? Truck : Truck
            return (
              <g
                key={f.key}
                className="cursor-pointer"
                onMouseEnter={() => setHover({
                  x: f.x,
                  y: f.y,
                  title: f.title,
                  sub: f.sub,
                  chips: f.chips,
                  tone: pend ? 'amber' : unl ? 'gray' : 'green',
                })}
                onMouseLeave={() => setHover(null)}
              >
                <g className="llf-growy" style={{ animationDelay: `${0.4 + fi * 0.03}s` }}>
                  <g className={pend ? 'llf-pulsey' : 'llf-sway'} style={{ animationDelay: `${fi * 0.5}s`, transformOrigin: 'center center' }}>
                    <circle cx={f.x} cy={f.y} r={12} fill={glow} opacity={0.7} />
                    <circle cx={f.x} cy={f.y} r={9.5} fill={fill} stroke={stroke} strokeWidth={1.5} />
                    <circle cx={f.x - 3} cy={f.y - 3.5} r={2} fill="#FFFFFF" opacity={0.55} />
                  </g>
                </g>
                <foreignObject x={f.x - 7} y={f.y - 11} width={14} height={14} className="llf-fo">
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <Icon size={10} />
                  </div>
                </foreignObject>
                <text x={f.x} y={f.y + 25} textAnchor="middle" fontSize={9} fontWeight={600} fill={pend ? '#B45309' : unl ? '#6B7280' : '#047857'}>
                  {f.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hover card */}
        {hover && hoverPct && (
          <div
            className={`pointer-events-none absolute z-10 w-[230px] rounded-xl border bg-white/95 p-3 shadow-xl backdrop-blur ${TONE_BG[hover.tone]}`}
            style={{
              left: `${hoverPct.left}%`,
              top: `${hoverPct.top}%`,
              transform: hoverPct.below ? 'translate(-50%, 10%)' : 'translate(-50%, -105%)',
            }}
          >
            <p className={`text-[12px] font-bold ${TONE_TEXT[hover.tone]} truncate`}>{hover.title}</p>
            <p className="text-[10.5px] text-[#98A2B3] mt-0.5">{hover.sub}</p>
            {hover.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {hover.chips.slice(0, 8).map((chip, ci) => (
                  <span key={ci} className="rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 py-0.5 text-[10px] text-[#475569]">
                    {chip}
                  </span>
                ))}
                {hover.chips.length > 8 && (
                  <span className="rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-1.5 py-0.5 text-[10px] text-[#98A2B3]">
                    +{hover.chips.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {excess > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-[#98A2B3] backdrop-blur">
            +{excess} older gate pass{excess > 1 ? 'es' : ''} hidden · {totalLeaves} nodes
          </div>
        )}
      </div>
    </Card>
  )
}