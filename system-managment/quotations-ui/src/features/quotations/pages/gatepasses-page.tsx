import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useReactToPrint } from 'react-to-print'
import {
    Plus,
    Search,
    X,
    SlidersHorizontal,
    CalendarDays,
    Inbox,
    ClipboardList,
    AlertTriangle,
    CheckCircle2,
    Clock,
    History,
    PackageOpen,
    RotateCcw,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { formatDateOnly } from '../../../lib/utils'
import { useGatePasses } from '../hooks/useGatePasses'
import { GatePassStatusPill } from '../components/operations-status'
import { CompactMetrics, type MetricItem } from '../components/compact-metrics'
import { GatePassPrintSheet } from '../components/gate-pass-print-sheet'
import { QuickViewModal } from '../components/quick-view-modal'
import { EntityCardActions } from '../components/entity-card-actions'
import { HotelBadge } from '../components/hotel-badge'
import { StatusSectionList, type StatusSection } from '../components/status-section-list'
import { useHotelScope } from '../../../context/HotelContext'
import type { GatePass } from '../../../types/operations'

const SECTION_ORDER = ['pending', 'received', 'partial', 'completed', 'historical'] as const
type SectionKey = (typeof SECTION_ORDER)[number]

function sectionKeyFor(gp: GatePass): SectionKey {
    if (gp.status === 'CANCELLED') return 'historical'
    if (gp.status === 'DELIVERED') return 'completed'
    const hasMismatch = (gp.items ?? []).some(item => (item.difference ?? 0) !== 0)
    if (hasMismatch) return 'partial'
    if (gp.status === 'RECEIVED') return 'received'
    return 'pending'
}

export default function GatePassesPage() {
    const navigate = useNavigate()
    const { hotel, showAllHotels } = useHotelScope()

    const [searchInput, setSearchInput] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showMore, setShowMore] = useState(false)

    // Selection for Quick View
    const [quickView, setQuickView] = useState<GatePass | null>(null)

    const { data: gatePasses, isLoading, isError, error } = useGatePasses(hotel ? { client_name: hotel } : undefined)
    const allGatePasses = gatePasses ?? []

    const hasFilters = Boolean(searchInput || dateFrom || dateTo)
    const clearFilters = () => {
        setSearchInput('')
        setDateFrom('')
        setDateTo('')
    }

    const searchQuery = searchInput.trim().toLowerCase()
    const rows = useMemo(() => {
        return allGatePasses.filter(gp => {
            if (searchQuery) {
                const haystack = [
                    gp.gate_pass_number,
                    gp.client_name,
                    gp.received_by,
                    (gp.items ?? []).map(i => i.item_name).join(' '),
                ].join(' ').toLowerCase()
                if (!haystack.includes(searchQuery)) return false
            }
            const date = String(gp.receiving_date || '').slice(0, 10)
            if (dateFrom && date < dateFrom) return false
            if (dateTo && date > dateTo) return false
            return true
        })
    }, [allGatePasses, searchQuery, dateFrom, dateTo])

    const sections = useMemo<StatusSection<GatePass>[]>(() => {
        const byKey: Record<SectionKey, GatePass[]> = { pending: [], received: [], partial: [], completed: [], historical: [] }
        for (const gp of rows) byKey[sectionKeyFor(gp)].push(gp)

        const defs: Record<SectionKey, { label: string; icon?: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
            pending: { label: 'Pending', icon: <Clock size={13} />, tone: 'amber' },
            received: { label: 'Received', icon: <Inbox size={13} />, tone: 'blue' },
            partial: { label: 'Partially received', icon: <AlertTriangle size={13} />, tone: 'red' },
            completed: { label: 'Completed', icon: <CheckCircle2 size={13} />, tone: 'green' },
            historical: { label: 'Historical', icon: <History size={13} />, tone: 'gray' },
        }

        return SECTION_ORDER.map(key => ({
            key,
            label: defs[key].label,
            icon: defs[key].icon,
            tone: defs[key].tone,
            items: byKey[key],
            renderItem: (gp: GatePass) => renderCard(gp),
        }))
    }, [rows])

    // Print support
    const printRef = useRef<HTMLDivElement>(null)
    const [printTarget, setPrintTarget] = useState<GatePass | null>(null)
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: printTarget ? `Gate-Pass-${printTarget.gate_pass_number}` : 'Gate-Pass',
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

    const requestPrint = (gp: GatePass) => setPrintTarget(gp)

    const kpis: MetricItem[] = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10)
        return [
            { id: 'total', label: 'Total Gate Passes', value: allGatePasses.length, icon: <ClipboardList size={15} />, tone: 'blue' },
            { id: 'today', label: "Today's Receipts", value: allGatePasses.filter(gp => String(gp.receiving_date || '').slice(0, 10) === today).length, icon: <CalendarDays size={15} />, tone: 'blue' },
            { id: 'pending', label: 'Pending', value: allGatePasses.filter(gp => sectionKeyFor(gp) === 'pending').length, icon: <PackageOpen size={15} />, tone: 'amber' },
            { id: 'received', label: 'Received', value: allGatePasses.filter(gp => sectionKeyFor(gp) === 'received').length, icon: <Inbox size={15} />, tone: 'gray' },
            { id: 'mismatch', label: 'Partially received', value: allGatePasses.filter(gp => sectionKeyFor(gp) === 'partial').length, icon: <AlertTriangle size={15} />, tone: 'red' },
            { id: 'completed', label: 'Completed', value: allGatePasses.filter(gp => sectionKeyFor(gp) === 'completed').length, icon: <CheckCircle2 size={15} />, tone: 'green' },
        ]
    }, [allGatePasses])

    const renderCard = (gp: GatePass) => {
        const total = (gp.items ?? []).reduce((sum, item) => sum + (item.received_qty || 0), 0)
        const mismatches = (gp.items ?? []).filter(item => (item.difference ?? 0) !== 0).length
        const rewashed = (gp.items ?? []).filter(item => item.rewashed)
        const rewashedQty = rewashed.reduce((sum, item) => sum + (item.received_qty || 0), 0)
        return (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]">
                            <ClipboardList size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="font-mono text-[12px] font-semibold text-[#101828]">{gp.gate_pass_number}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {showAllHotels && <HotelBadge name={gp.client_name} />}
                                {!showAllHotels && (
                                    <p className="truncate text-[12px] text-[var(--text-muted)]">{gp.client_name || '—'}</p>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-[#98A2B3]">{formatDateOnly(gp.receiving_date)}</p>
                        </div>
                    </div>
                    <GatePassStatusPill status={gp.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#F2F4F7] pt-3 text-[12px] text-[#6B7280]">
                    <span><span className="font-semibold text-[#374151]">{(gp.items ?? []).length}</span> types</span>
                    <span><span className="font-semibold text-[#374151]">{total}</span> pcs</span>
                    <span>by <span className="font-medium text-[#374151]">{gp.received_by || '—'}</span></span>
                    {mismatches > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-[#D97706]">
                            <AlertTriangle size={11} /> {mismatches} mismatch{mismatches > 1 ? 'es' : ''}
                        </span>
                    )}
                    {rewashedQty > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-[#15803D]">
                            <RotateCcw size={11} /> {rewashedQty} pcs re-wash · not billed
                        </span>
                    )}
                </div>

                <div className="mt-2 flex justify-end border-t border-[#F2F4F7] pt-2">
                    <EntityCardActions
                        onQuickView={() => setQuickView(gp)}
                        onOpen={() => navigate(`/gate-passes/${gp.id}`)}
                        onEdit={() => navigate(`/gate-passes/${gp.id}`)}
                        onPrint={() => requestPrint(gp)}
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
                    <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Gate Passes' }]} />
                    <h1 className="text-dashboard-title mt-1">Gate Passes</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">
                        Receipts, mismatches, and delivery readiness — organized by hotel.
                    </p>
                    <div className="mt-1.5">
                        <span className="text-[12px] font-medium text-[#6B7280]">
                            {isLoading ? 'Loading…' : `${rows.length} gate pass${rows.length !== 1 ? 'es' : ''}`}
                            {hotel ? ` · ${hotel}` : ' · All hotels'}
                        </span>
                        <SyncStatusBar queryKey={['gatepasses']} label="Gate passes" className="mt-2" />
                    </div>
                </div>
                <Link to="/gate-passes/new" className="shrink-0">
                    <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-600/20">
                        <Plus className="h-4 w-4" /> Create Gate Pass
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
                            placeholder={`Search ${hotel ? hotel : 'all hotels'} by gate pass no., item, person…`}
                            className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
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
                    <div className="mt-3 grid gap-2.5 border-t border-[#F2F4F7] pt-3 sm:grid-cols-2">
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={event => setDateFrom(event.target.value)}
                                aria-label="Received from"
                                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
                            />
                        </div>
                        <div className="relative">
                            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={event => setDateTo(event.target.value)}
                                aria-label="Received to"
                                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] shadow-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
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
                <ErrorState description={error instanceof Error ? error.message : 'Unable to load gate passes'} />
            ) : allGatePasses.length === 0 ? (
                hotel ? (
                    <EmptyState
                        title="No gate passes for this hotel yet"
                        description="There are no gate passes recorded for the selected hotel."
                        action={
                            <Button variant="secondary" size="sm" onClick={clearFilters}>
                                Clear filters
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        title="No gate passes found"
                        description="Record your first gate pass when laundry is received from a hotel."
                        action={
                            <Link to="/gate-passes/new">
                                <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                                    <Plus className="h-4 w-4" /> Create Gate Pass
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
            <QuickViewModal open={!!quickView} onOpenChange={open => !open && setQuickView(null)} type="gatepass" entity={quickView} />

            {/* Hidden print sheet */}
            {printTarget && (
                <div style={{ display: 'none' }}>
                    <GatePassPrintSheet ref={printRef} gp={printTarget} />
                </div>
            )}
        </div>
    )
}