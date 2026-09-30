import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import {
    Plus,
    Search,
    X,
    SlidersHorizontal,
    CalendarDays,
    Truck,
    AlertTriangle,
    CheckCircle2,
    PackageCheck,
    Clock,
    Building2,
    History,
    PackageOpen,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { formatDateOnly } from '../../../lib/utils'
import { useDeliveries } from '../hooks/useDeliveries'
import { useGatePasses } from '../hooks/useGatePasses'
import {
    DeliveryStatusPill,
    deriveDeliveryStatus,
    type DeliveryStatus,
} from '../components/operations-status'
import { CompactMetrics, type MetricItem } from '../components/compact-metrics'
import { DeliveryPrintSheet } from '../components/delivery-print-sheet'
import { QuickViewModal } from '../components/quick-view-modal'
import { EntityCardActions } from '../components/entity-card-actions'
import { HotelBadge } from '../components/hotel-badge'
import { StatusSectionList, type StatusSection } from '../components/status-section-list'
import { useHotelScope } from '../../../context/HotelContext'
import type { Delivery } from '../../../types/operations'

const SECTION_ORDER = ['pending', 'partial', 'completed', 'history'] as const
type SectionKey = (typeof SECTION_ORDER)[number]

function sectionKeyFor(status: DeliveryStatus): SectionKey {
    switch (status) {
        case 'DELIVERED':
            return 'completed'
        case 'PARTIALLY_DELIVERED':
            return 'partial'
        case 'CANCELLED':
            return 'history'
        default:
            return 'pending'
    }
}

type DeliveryRow = { delivery: Delivery; status: DeliveryStatus }

export default function DeliveriesPage() {
    const navigate = useNavigate()
    const { hotel, showAllHotels } = useHotelScope()

    const [searchInput, setSearchInput] = useState('')
    const [gpFilter, setGpFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showMore, setShowMore] = useState(false)

    const [quickView, setQuickView] = useState<{ row: DeliveryRow } | null>(null)

    const { data: deliveries = [], isLoading, isError, error } = useDeliveries(hotel ? { client_name: hotel } : undefined)
    const { data: gatePasses = [] } = useGatePasses(hotel ? { client_name: hotel } : undefined)

    const hasFilters = Boolean(searchInput || gpFilter || dateFrom || dateTo)
    const clearFilters = () => {
        setSearchInput('')
        setGpFilter('')
        setDateFrom('')
        setDateTo('')
    }

    const gpMap = useMemo(() => new Map(gatePasses.map(gp => [gp.id, gp])), [gatePasses])

    const gpOptions = useMemo(
        () =>
            [...gpMap.values()]
                .filter(gp => deliveries.some(d =>
                    (d.source_gate_passes ?? []).some(p => p.gate_pass_id === gp.id)
                    || d.gate_pass_id === gp.id))
                .sort((a, b) => a.gate_pass_number.localeCompare(b.gate_pass_number)),
        [gpMap, deliveries],
    )

    const withStatus = useMemo<DeliveryRow[]>(
        () =>
            deliveries.map(delivery => ({
                delivery,
                // Derived from EVERY source pass, not just the primary one: a
                // delivery is only complete when all of its origin passes are.
                status: deriveDeliveryStatus(delivery, delivery.source_gate_passes),
            })),
        [deliveries],
    )

    const searchQuery = searchInput.trim().toLowerCase()
    const rows = useMemo(() => {
        return withStatus.filter(({ delivery }) => {
            if (searchQuery) {
                const gp = gpMap.get(delivery.gate_pass_id)
                const haystack = [
                    `DLV-${delivery.id.slice(-8).toUpperCase()}`,
                    delivery.client_name,
                    delivery.delivered_by,
                    delivery.received_by,
                    gp?.gate_pass_number ?? '',
                    (delivery.items ?? []).map(i => i.item_name).join(' '),
                ].join(' ').toLowerCase()
                if (!haystack.includes(searchQuery)) return false
            }
            if (gpFilter && delivery.gate_pass_id !== gpFilter) return false
            const date = String(delivery.delivery_date || '').slice(0, 10)
            if (dateFrom && date < dateFrom) return false
            if (dateTo && date > dateTo) return false
            return true
        })
    }, [withStatus, searchQuery, gpFilter, dateFrom, dateTo, gpMap])

    const kpis: MetricItem[] = useMemo(() => {
        const counts: Record<DeliveryStatus, number> = {
            DELIVERED: 0, PARTIALLY_DELIVERED: 0, READY: 0, IN_PROGRESS: 0, PENDING: 0, CANCELLED: 0,
        }
        for (const row of withStatus) counts[row.status] += 1
        return [
            { id: 'total', label: 'Total Deliveries', value: withStatus.length, icon: <Truck size={15} />, tone: 'green' },
            { id: 'completed', label: 'Completed', value: counts.DELIVERED, icon: <CheckCircle2 size={15} />, tone: 'green' },
            { id: 'ready', label: 'Ready', value: counts.READY, icon: <PackageCheck size={15} />, tone: 'blue' },
            { id: 'inprogress', label: 'In Progress', value: counts.IN_PROGRESS, icon: <Clock size={15} />, tone: 'amber' },
            { id: 'partial', label: 'Partial', value: counts.PARTIALLY_DELIVERED, icon: <PackageOpen size={15} />, tone: 'amber' },
            { id: 'pending', label: 'Awaiting Confirmation', value: counts.PENDING, icon: <Building2 size={15} />, tone: 'gray' },
        ]
    }, [withStatus])

    const sections = useMemo<StatusSection<DeliveryRow>[]>(() => {
        const byKey: Record<SectionKey, DeliveryRow[]> = { pending: [], partial: [], completed: [], history: [] }
        for (const row of rows) byKey[sectionKeyFor(row.status)].push(row)

        const defs: Record<SectionKey, { label: string; icon?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
            pending: { label: 'Pending', icon: <Clock size={13} />, tone: 'amber' },
            partial: { label: 'Partially delivered', icon: <AlertTriangle size={13} />, tone: 'red' },
            completed: { label: 'Completed', icon: <CheckCircle2 size={13} />, tone: 'green' },
            history: { label: 'Delivery history', icon: <History size={13} />, tone: 'gray' },
        }

        return SECTION_ORDER.map(key => ({
            key,
            label: defs[key].label,
            icon: defs[key].icon,
            tone: defs[key].tone,
            items: byKey[key],
            renderItem: (row: DeliveryRow) => renderCard(row),
        }))
    }, [rows])

    // Print support
    const printRef = useRef<HTMLDivElement>(null)
    const [printTarget, setPrintTarget] = useState<Delivery | null>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: printTarget ? `Delivery-${printTarget.id}` : 'Delivery',
    })
    const handlePrintRef = useRef<() => void>(() => {})
    useEffect(() => {
        handlePrintRef.current = handlePrint
    }, [handlePrint])

    useEffect(() => {
        if (!printTarget) return
        const timer = setTimeout(() => {
            handlePrintRef.current()
            setPrintTarget(null)
        }, 120)
        return () => clearTimeout(timer)
    }, [printTarget])

    const requestPrint = (delivery: Delivery) => setPrintTarget(delivery)

    /**
     * Progress per source gate pass, from the server's balance totals.
     *
     * The list used to show one bar computed as `delivered / received` against a
     * SINGLE gate pass — meaningless for a delivery drawing from several, and
     * quietly wrong whenever it wasn't the primary pass. Each source pass is
     * now listed with the numbers the server reports for it.
     */
    const renderProgress = (delivery: Delivery) => {
        const passes = delivery.source_gate_passes ?? []
        if (passes.length === 0) {
            const qty = (delivery.items ?? []).reduce((sum, i) => sum + (i.quantity || 0), 0)
            return (
                <span className="whitespace-nowrap text-[11px] font-medium text-[#98A2B3]">
                    {qty} pcs
                </span>
            )
        }
        if (passes.length === 1) {
            const p = passes[0]
            const received = p.totals?.received_qty ?? 0
            const delivered = p.totals?.delivered_qty ?? 0
            const pct = received > 0 ? Math.min(100, Math.round((delivered / received) * 100)) : 0
            return (
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E4E7EC]">
                        <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-medium text-[#6B7280]">
                        {delivered} / {received} pcs
                    </span>
                </div>
            )
        }
        return (
            <div className="flex flex-wrap items-center gap-1.5">
                {passes.map(p => {
                    const remaining = p.totals?.outstanding_delivery_qty ?? 0
                    return (
                        <span
                            key={p.gate_pass_id}
                            title={`${p.gate_pass_number}: ${p.totals?.delivered_qty ?? 0}/${p.totals?.received_qty ?? 0} delivered, ${remaining} still owed`}
                            className="whitespace-nowrap rounded-md border border-[#E4E7EC] bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#475467]"
                        >
                            {p.gate_pass_number ?? `GP-${p.gate_pass_id.slice(-6).toUpperCase()}`}
                            <span className={remaining > 0 ? 'ml-1 text-[#EA580C]' : 'ml-1 text-[#16A34A]'}>
                                {remaining > 0 ? `${remaining} due` : 'done'}
                            </span>
                        </span>
                    )
                })}
            </div>
        )
    }

    const renderGatePassCell = (delivery: Delivery) => {
        const passes = delivery.source_gate_passes ?? []
        const numbers = passes
            .map(p => p.gate_pass_number)
            .filter(Boolean) as string[]
        if (numbers.length === 0) {
            const short = String(delivery.gate_pass_id ?? '').slice(-8).toUpperCase()
            return <span className="font-mono text-[11px] text-[#98A2B3]">GP-{short}</span>
        }
        if (numbers.length === 1) {
            const p = passes[0]
            return (
                <Link to={`/gate-passes/${p.gate_pass_id}`} className="font-mono text-[11px] font-semibold text-[#10B981] transition-colors hover:text-[#047857]">
                    {numbers[0]}
                </Link>
            )
        }
        // More than one origin: every one is linked, because a delivery is only
        // traceable if you can reach each pass it drew from.
        return (
            <div className="flex flex-col gap-0.5">
                {passes.map(p => (
                    <Link
                        key={p.gate_pass_id}
                        to={`/gate-passes/${p.gate_pass_id}`}
                        className="font-mono text-[11px] font-semibold text-[#10B981] transition-colors hover:text-[#047857]"
                    >
                        {p.gate_pass_number ?? `GP-${p.gate_pass_id.slice(-6).toUpperCase()}`}
                    </Link>
                ))}
            </div>
        )
    }

    const renderCard = (row: DeliveryRow) => {
        const delivery = row.delivery
        return (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]">
                            <Truck size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-mono text-[12px] font-semibold text-[#101828]">
                                DLV-{delivery.id.slice(-8).toUpperCase()}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {showAllHotels && <HotelBadge name={delivery.client_name} />}
                                {!showAllHotels && (
                                    <p className="truncate text-[12px] text-[var(--text-muted)]">{delivery.client_name || '—'}</p>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-[#98A2B3]">
                                {formatDateOnly(delivery.delivery_date)} · {renderGatePassCell(delivery)}
                            </p>
                        </div>
                    </div>
                    <DeliveryStatusPill status={row.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#F2F4F7] pt-3 text-[12px] text-[#6B7280]">
                    <span><span className="font-semibold text-[#374151]">{(delivery.items ?? []).length}</span> types</span>
                    <span>
                        by <span className="font-medium text-[#374151]">{delivery.delivered_by || '—'}</span>
                    </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#F2F4F7] pt-2">
                    <div className="flex-1">{renderProgress(delivery)}</div>
                    <EntityCardActions
                        onQuickView={() => setQuickView({ row })}
                        onOpen={() => navigate(`/deliveries/${delivery.id}`)}
                        onPrint={() => requestPrint(delivery)}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Deliveries' }]} />
                    <h1 className="text-dashboard-title mt-1">Deliveries</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">
                        Outgoing laundry returned to hotels — quantities against each gate pass, organized by hotel.
                    </p>
                    <div className="mt-1.5">
                        <span className="text-[12px] font-medium text-[#6B7280]">
                            {isLoading ? 'Loading…' : `${rows.length} delivery record${rows.length !== 1 ? 's' : ''}`}
                            {hotel ? ` · ${hotel}` : ' · All hotels'}
                        </span>
                        <SyncStatusBar queryKey={['deliveries']} label="Deliveries" className="mt-2" />
                    </div>
                </div>
                <Link to="/deliveries/new" className="shrink-0">
                    <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white shadow-lg shadow-green-600/20">
                        <Plus className="h-4 w-4" /> Record Delivery
                    </Button>
                </Link>
            </div>

            {/* Compact summary */}
            <CompactMetrics items={kpis} />

            {/* Filters */}
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={event => setSearchInput(event.target.value)}
                            placeholder={`Search ${hotel ? hotel : 'all hotels'} by delivery no., item, person…`}
                            className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#98A2B3] hover:text-[#374151]"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowMore(value => !value)}>
                            <SlidersHorizontal size={14} />
                            More Filters
                        </Button>

                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X size={14} /> Clear
                            </Button>
                        )}
                    </div>
                </div>

                {showMore && (
                    <div className="mt-3 grid gap-2.5 border-t border-[#F2F4F7] pt-3 sm:grid-cols-3">
                        <div className="relative">
                            <PackageCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                            <select
                                value={gpFilter}
                                onChange={event => setGpFilter(event.target.value)}
                                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10"
                            >
                                <option value="">All Gate Passes</option>
                                {gpOptions.map(gp => (
                                    <option key={gp.id} value={gp.id}>{gp.gate_pass_number} · {gp.client_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={event => setDateFrom(event.target.value)}
                                aria-label="Delivered from"
                                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10"
                            />
                        </div>
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={event => setDateTo(event.target.value)}
                                aria-label="Delivered to"
                                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-24" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState description={error instanceof Error ? error.message : 'Unable to load deliveries'} />
            ) : deliveries.length === 0 ? (
                hotel ? (
                    <EmptyState
                        title="No deliveries for this hotel yet"
                        description="There are no deliveries recorded for the selected hotel."
                    />
                ) : (
                    <EmptyState
                        title="No deliveries yet"
                        description="Record a delivery when laundry is returned to a hotel client."
                        action={
                            <Link to="/deliveries/new">
                                <Button className="bg-[#16A34A] hover:bg-[#15803D] text-white">
                                    <Plus className="h-4 w-4" /> Record Delivery
                                </Button>
                            </Link>
                        }
                    />
                )
            ) : rows.length === 0 ? (
                <EmptyState
                    title="Nothing matches these filters"
                    description="Try widening the search or date range."
                    action={
                        <Button variant="secondary" size="sm" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <StatusSectionList sections={sections} />
            )}

            {/* Quick view popup */}
            <QuickViewModal
                open={!!quickView}
                onOpenChange={open => !open && setQuickView(null)}
                type="delivery"
                entity={quickView?.row.delivery ?? null}
                deliveryStatus={quickView?.row.status}
            />

            {/* Hidden print sheet */}
            {printTarget && (
                <div style={{ display: 'none' }}>
                    <DeliveryPrintSheet
                        ref={printRef}
                        delivery={printTarget}
                        gp={gpMap.get(printTarget.gate_pass_id)}
                    />
                </div>
            )}
        </div>
    )
}