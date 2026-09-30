import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Receipt, X, Calendar, Download, BadgeCheck, Archive, AlertTriangle, Wallet, Boxes, RotateCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { BillStatusBadge } from '../../../components/ui/bill-status-badge'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { VerificationStatus } from '../../../components/ui/verification-status'
import { formatDate } from '../../../lib/utils'
import { useBills, useUnbilledGatePasses, useDeleteBill } from '../hooks/useBills'
import { CompactMetrics, type MetricItem } from '../components/compact-metrics'
import { QuickViewModal } from '../components/quick-view-modal'
import { EntityCardActions } from '../components/entity-card-actions'
import { HotelBadge } from '../components/hotel-badge'
import { StatusSectionList, type StatusSection } from '../components/status-section-list'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useHotelScope } from '../../../context/HotelContext'
import type { Bill } from '../../../types/bill'
import type { UnbilledGatePass } from '../../../types/bill'

const SECTION_ORDER = ['outstanding', 'unbilled', 'paid', 'history'] as const
type SectionKey = (typeof SECTION_ORDER)[number]

function isPaid(bill: Bill) {
    return bill.payment_status === 'PAID' || (bill.outstanding_amount ?? 0) <= 0
}

function bucketFor(bill: Bill): SectionKey {
    if (bill.payment_status === 'CANCELLED') return 'history'
    if (isPaid(bill)) return 'paid'
    return 'outstanding'
}

export default function BillsListPage() {
    const navigate = useNavigate()
    const { hotel, showAllHotels } = useHotelScope()

    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    const [quickView, setQuickView] = useState<Bill | null>(null)
    const [deleting, setDeleting] = useState<Bill | null>(null)
    const deleteBill = useDeleteBill()

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 350)
        return () => clearTimeout(t)
    }, [searchInput])

    const { data, isLoading, isError, error } = useBills({
        search: search || undefined,
        client_name: hotel,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        skip: 0,
        limit: 500,
    })

    const { data: unbilled = [] } = useUnbilledGatePasses(hotel)

    const bills = data?.items ?? []
    const hasFilters = Boolean(search || dateFrom || dateTo)

    const clearFilters = () => {
        setSearchInput('')
        setSearch('')
        setDateFrom('')
        setDateTo('')
    }

    const kpis: MetricItem[] = useMemo(() => {
        const outstanding = bills.reduce(
            (sum, b) =>
                sum +
                (b.payment_status === 'CANCELLED'
                    ? 0
                    : Math.max(0, b.outstanding_amount ?? ((b.grand_total ?? b.total_amount) - (b.paid_amount ?? 0)))),
            0,
        )
        const paidTotal = bills.reduce(
            (sum, b) =>
                sum +
                (b.payment_status === 'CANCELLED'
                    ? 0
                    : isPaid(b)
                        ? (b.grand_total ?? b.total_amount)
                        : (b.paid_amount ?? 0)),
            0,
        )
        const unbilledQty = unbilled.reduce((sum, u) => sum + (u.total_unbilled_qty ?? 0), 0)
        const totalUnbilled = unbilled.length
        return [
            { id: 'total', label: 'Bills', value: bills.length, icon: <Receipt size={15} />, tone: 'blue' },
            { id: 'outstanding', label: 'Outstanding', value: outstanding, icon: <Wallet size={15} />, tone: 'red', money: true },
            { id: 'paid', label: 'Collected', value: paidTotal, icon: <BadgeCheck size={15} />, tone: 'green', money: true },
            { id: 'unbilled', label: 'Unbilled gate passes', value: totalUnbilled, icon: <Boxes size={15} />, tone: 'amber' },
            { id: 'unbilled-qty', label: 'Unbilled items', value: unbilledQty, icon: <Archive size={15} />, tone: 'gray' },
        ]
    }, [bills, unbilled])

    const sections = useMemo<StatusSection<Bill | UnbilledGatePass>[]>(() => {
        const outstanding: Bill[] = []
        const paid: Bill[] = []
        const history: Bill[] = []
        for (const bill of bills) {
            const bucket = bucketFor(bill)
            if (bucket === 'outstanding') outstanding.push(bill)
            else if (bucket === 'paid') paid.push(bill)
            else history.push(bill)
        }
        const sortMoney = (a: Bill, b: Bill) => (b.outstanding_amount ?? 0) - (a.outstanding_amount ?? 0)
        outstanding.sort(sortMoney)

        const defs: Record<SectionKey, { label: string; icon: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray' }> = {
            outstanding: { label: 'Outstanding', icon: <Wallet size={13} />, tone: 'red' },
            unbilled: { label: 'Unbilled', icon: <Boxes size={13} />, tone: 'amber' },
            paid: { label: 'Paid', icon: <BadgeCheck size={13} />, tone: 'green' },
            history: { label: 'History', icon: <Archive size={13} />, tone: 'gray' },
        }

        const sections: StatusSection<Bill | UnbilledGatePass>[] = SECTION_ORDER.map(key => ({
            key,
            label: defs[key].label,
            icon: defs[key].icon,
            tone: defs[key].tone,
            items: key === 'unbilled' ? unbilled : key === 'outstanding' ? outstanding : key === 'paid' ? paid : history,
            renderItem: (item: Bill | UnbilledGatePass, _index: number) =>
                key === 'unbilled' ? renderUnbilledCard(item as UnbilledGatePass) : renderBillCard(item as Bill),
        }))

        return sections
    }, [bills, unbilled])

    const handleExportExcel = () => {
        if (!bills.length) return
        const dataForExcel = bills.map(bill => ({
            'Bill ID': bill.id,
            'Client Name': bill.client_name,
            'Quotation Title': bill.quotation_title || 'N/A',
            'Total Quantity': bill.total_quantity,
            'Total Amount': bill.total_amount,
            'Grand Total': bill.grand_total ?? bill.total_amount,
            'Paid Amount': bill.paid_amount || 0,
            'Outstanding Amount': bill.outstanding_amount ?? bill.total_amount,
            'Status': bill.payment_status || 'DRAFT',
            'Date': formatDate(bill.created_at),
        }))
        const ws = XLSX.utils.json_to_sheet(dataForExcel)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Bills')
        XLSX.writeFile(wb, 'bills_export.xlsx')
    }

    const confirmDelete = () => {
        if (!deleting) return
        deleteBill.mutate(deleting.id, {
            onSettled: () => setDeleting(null),
        })
    }

    const renderBillCard = (bill: Bill) => {
        const grandTotal = bill.grand_total ?? bill.total_amount
        const paid = bill.paid_amount ?? 0
        const owed = bill.payment_status === 'CANCELLED' ? 0 : Math.max(0, bill.outstanding_amount ?? (grandTotal - paid))
        return (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            bill.payment_status === 'PAID'
                                ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                                : bill.payment_status === 'PARTIALLY_PAID'
                                    ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                                    : 'bg-[#FFF1F1] text-[#DC2626] border-[#FECACA]'
                        }`}>
                            <Receipt className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {showAllHotels && <HotelBadge name={bill.client_name} />}
                                {!showAllHotels && (
                                    <p className="truncate text-[13px] font-semibold text-[#101828]">{bill.client_name}</p>
                                )}
                            </div>
                            <p className="mt-0.5 truncate text-[12px] text-[var(--text-faint)]">
                                {bill.quotation_title || 'Price List'}
                            </p>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <BillStatusBadge status={bill.payment_status} />
                        <Badge variant="secondary">{bill.total_quantity ?? (bill.items ?? []).length} items</Badge>
                    </div>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-[var(--text-faint)]">{formatDate(bill.created_at)}</span>
                        <div className="flex items-center gap-1.5">
                            <VerificationStatus status={bill.verification?.status} showLabel={false} />
                            {owed > 0 && (
                                <span className="text-[11px] font-bold text-[#DC2626]">Owed LKR {owed.toFixed(2)}</span>
                            )}
                            {bill.payment_status === 'PAID' && (
                                <span className="text-[11px] font-bold text-[#16A34A]">Paid LKR {paid.toFixed(2)}</span>
                            )}
                        </div>
                    </div>
                    <span className="text-[14px] font-bold text-[var(--text-primary)]">LKR {grandTotal.toFixed(2)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[#F2F4F7] pt-2">
                    <div className="flex items-center gap-1.5">
                        {bill.gate_pass_id ? (
                            <Link to={`/gate-passes/${bill.gate_pass_id}`} className="font-mono text-[11px] font-semibold text-[#10B981] hover:text-[#047857]">
                                View gate pass
                            </Link>
                        ) : (
                            <span className="text-[11px] text-[var(--text-faint)]">No linked gate pass</span>
                        )}
                    </div>
                    <EntityCardActions
                        onQuickView={() => setQuickView(bill)}
                        onOpen={() => navigate(`/bills/${bill.id}`)}
                        onEdit={() => navigate(`/bills/${bill.id}`)}
                        onDelete={() => setDeleting(bill)}
                    />
                </div>
            </div>
        )
    }

    const renderUnbilledCard = (gp: UnbilledGatePass) => {
        return (
            <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FFEAD5] bg-[#FFF7ED] text-[#C2410C]">
                            <Boxes className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-mono text-[12px] font-semibold text-[#101828]">{gp.gate_pass_number}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {showAllHotels && <HotelBadge name={gp.client_name} />}
                                {!showAllHotels && (
                                    <p className="truncate text-[12px] text-[var(--text-muted)]">{gp.client_name || '—'}</p>
                                )}
                            </div>
                            <p className="mt-1 text-[11px] text-[#98A2B3]">{formatDate(gp.receiving_date)}</p>
                        </div>
                    </div>
                    <span className="rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-bold text-[#D97706]">
                        {gp.total_unbilled_qty} pcs
                    </span>
                </div>

                <div className="mt-3 space-y-1 border-t border-[#F2F4F7] pt-2.5">
                    {(gp.unbilled_items ?? []).slice(0, 3).map(item => (
                        <div key={item.item_name} className="flex items-center justify-between gap-2 text-[12px]">
                            <span className="truncate font-medium text-[#374151]">{item.item_name}</span>
                            <span className="shrink-0 font-semibold text-[#D97706]">+{item.unbilled_qty}</span>
                        </div>
                    ))}
                    {(gp.unbilled_items ?? []).length > 3 && (
                        <p className="text-[11px] text-[var(--text-faint)]">
                            +{(gp.unbilled_items ?? []).length - 3} more item{(gp.unbilled_items ?? []).length - 3 > 1 ? 's' : ''}
                        </p>
                    )}
                    {(gp.total_rewashed_qty ?? 0) > 0 && (
                        <div className="flex items-start justify-between gap-2 text-[12px]">
                            <span className="inline-flex items-center gap-1.5 truncate text-[#15803D]">
                                <RotateCw size={12} className="shrink-0" />
                                <span className="truncate">Free re-wash · not billed
                                    {(gp.rewashed_items ?? []).length > 0
                                        ? ` (${(gp.rewashed_items ?? []).map(r => r.item_name).join(', ')})`
                                        : ''}
                                </span>
                            </span>
                            <span className="shrink-0 font-semibold text-[#15803D]">+{gp.total_rewashed_qty}</span>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-[#F2F4F7] pt-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#B45309]">
                        <AlertTriangle size={11} /> Ready to bill
                    </span>
                    <EntityCardActions
                        onOpen={() => navigate(`/gate-passes/${gp.id}`)}
                        onEdit={() => navigate(`/gate-passes/${gp.id}`)}
                    />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5 pb-10">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Bills' }]} />
                    <h1 className="text-dashboard-title mt-1">Bills</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">
                        Billing and collections — organized by hotel.
                    </p>
                    <div className="mt-1.5">
                        <span className="text-[12px] font-medium text-[#6B7280]">
                            {isLoading ? 'Loading…' : `${bills.length} bill${bills.length !== 1 ? 's' : ''}`}
                            {hotel ? ` · ${hotel}` : ' · All hotels'}
                        </span>
                        <SyncStatusBar queryKey={['bills']} label="Bills" className="mt-2" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleExportExcel} disabled={!bills.length}>
                        <Download className="h-4 w-4 mr-2" /> Export
                    </Button>
                    <Link to="/bills/new">
                        <Button>
                            <Plus className="h-4 w-4" /> New Bill
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
            ) : (
                <CompactMetrics items={kpis} />
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder={`Search ${hotel ? hotel : 'all hotels'} by client, quotation title, or item…`}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-9 pr-8 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={() => setSearchInput('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
                            aria-label="Clear search"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-8 pr-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
                        />
                    </div>
                    <span className="text-[12px] text-[var(--text-faint)]">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
                    />
                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            ) : isError ? (
                <ErrorState description={error instanceof Error ? error.message : 'Unable to load bills'} />
            ) : bills.length === 0 && unbilled.length === 0 ? (
                <EmptyState
                    title="No bills found"
                    description={
                        hasFilters
                            ? 'No bills match your search or date range.'
                            : hotel
                                ? 'No bills or unbilled gate passes for the selected hotel.'
                                : 'Create your first bill from an existing quotation.'
                    }
                    action={
                        !hasFilters && (
                            <Link to="/bills/new">
                                <Button>
                                    <Plus className="h-4 w-4" /> New Bill
                                </Button>
                            </Link>
                        )
                    }
                />
            ) : sections.some(section => section.items.length > 0) ? (
                <StatusSectionList sections={sections} />
            ) : (
                <EmptyState
                    title="Nothing matches these filters"
                    description="Try widening the search or date range."
                    action={
                        <Button variant="secondary" size="sm" onClick={clearFilters}>
                            Clear filters
                        </Button>
                    }
                />
            )}

            <QuickViewModal open={!!quickView} onOpenChange={open => !open && setQuickView(null)} type="bill" entity={quickView} />

            <ConfirmDialog
                open={!!deleting}
                title={`Delete bill${deleting ? ` for ${deleting.client_name}` : ''}?`}
                message={`Deleting is permanent and cannot be undone.${deleting && (deleting.payment_status === 'PAID' || (deleting.paid_amount ?? 0) > 0) ? ' This bill has payments recorded.' : ''}`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                loading={deleteBill.isPending}
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />
        </div>
    )
}