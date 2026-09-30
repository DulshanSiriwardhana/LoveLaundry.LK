import { useState, useMemo, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
    ArrowLeft, ClipboardList, Calendar, User, AlertCircle, AlertTriangle,
    ChevronDown, Truck, CheckCircle2, Pencil, X, Check, Receipt,
    Plus, Save, Trash2, History, RefreshCw, Undo2, Settings2, Flag, RotateCcw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '../../../components/ui/button'
import { SmartConfirm } from '../../../components/ops/smart-confirm'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import { DATE_CORRECTION_REASONS } from '../../../lib/date-corrections'
import { useGatePass, useGatePassBalance, useGatePassDeliveries, useUpdateGatePassStatus, useAdjustGatePass, useUpdateGatePassDate, useCreateBillFromGatePass, useUpdateGatePass, useMarkGatePassDelivered, useReopenLegacyGatePass } from '../hooks/useGatePasses'
import { useUpdateDeliveryDate } from '../hooks/useDeliveries'
import { useQuotation } from '../hooks/useQuotations'
import { returns as returnsApi } from '../services/returns.service'
import { SearchableSelect } from '../../../components/ui'
import { toQuotationOptions, type QuotationOption } from './create-gatepass-page'
import type { GatePassBalanceItem, Return } from '../../../types/operations'
import { ops, type TransactionEvent } from '../../today/services/ops.service'

/** Stable empty array so `?? NO_ITEMS` doesn't invalidate memos on every render. */
const NO_ITEMS: never[] = []

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    RECEIVED: { label: 'Received', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', dot: '#3B82F6' },
    PROCESSING: { label: 'Processing', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#F97316' },
    READY_FOR_DELIVERY: { label: 'Ready', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', dot: '#22C55E' },
    PARTIALLY_DELIVERED: { label: 'Partial Delivery', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', dot: '#F59E0B' },
    DELIVERED: { label: 'Delivered', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', dot: '#16A34A' },
    CANCELLED: { label: 'Cancelled', bg: '#F9FAFB', text: '#6B7280', border: '#E4E7EC', dot: '#9CA3AF' },
}

const TRANSITION_STATUSES = ['RECEIVED', 'PROCESSING', 'READY_FOR_DELIVERY', 'CANCELLED']

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.RECEIVED
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
            style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
            {cfg.label}
        </span>
    )
}

// ── Activity timeline ─────────────────────────────────────────────────────────
const EVENT_THEME: Record<string, { icon: typeof History; label: string; bg: string; text: string; border: string }> = {
    GATE_PASS_CREATED: { icon: ClipboardList, label: 'Gate pass received', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    RECEIVING_EDITED: { icon: Pencil, label: 'Items edited', bg: '#F9FAFB', text: '#374151', border: '#E4E7EC' },
    RECEIVING_DATE_CHANGED: { icon: Calendar, label: 'Receiving date changed', bg: '#F9FAFB', text: '#374151', border: '#E4E7EC' },
    STATUS_CHANGED: { icon: RefreshCw, label: 'Status changed', bg: '#F9FAFB', text: '#374151', border: '#E4E7EC' },
    DELIVERY_CREATED: { icon: Truck, label: 'Delivery recorded', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    DELIVERY_DATE_CHANGED: { icon: Calendar, label: 'Delivery date changed', bg: '#F9FAFB', text: '#374151', border: '#E4E7EC' },
    CATCH_UP_DELIVERY: { icon: CheckCircle2, label: 'Completed as delivered by note', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    ADJUSTMENT_REQUESTED: { icon: Settings2, label: 'Quantity adjustment requested', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
    ADJUSTMENT_APPROVED: { icon: Check, label: 'Adjustment approved', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    ADJUSTMENT_REJECTED: { icon: X, label: 'Adjustment rejected', bg: '#FFF1F1', text: '#DC2626', border: '#FECACA' },
    RETURN_CREATED: { icon: Undo2, label: 'Return recorded', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    RETURN_UPDATED: { icon: Undo2, label: 'Return updated', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    RETURN_RESENT: { icon: Undo2, label: 'Return re-sent', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
    BILL_CREATED: { icon: Receipt, label: 'Bill created', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
    LEGACY_FLAG: { icon: Flag, label: 'Legacy flag applied', bg: '#F9FAFB', text: '#6B7280', border: '#E4E7EC' },
    LEGACY_NOTE_CLOSURE: { icon: Flag, label: 'Legacy note closure', bg: '#F9FAFB', text: '#6B7280', border: '#E4E7EC' },
}

function deltaText(delta: number | undefined): string | null {
    if (delta == null || delta === 0) return null
    const prefix = delta > 0 ? '+' : ''
    return prefix + delta
}

function parseInstant(value: string | number | Date | undefined): Date | null {
    if (!value) return null
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
}

function fmtWhen(value?: string): string {
    const d = parseInstant(value)
    if (!d) return ''
    const diffMin = Math.round((Date.now() - d.getTime()) / 60_000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
    const datePart = formatDate(d.toISOString())
    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return `${datePart} · ${timePart}`
}

function eventDetail(e: TransactionEvent): React.ReactNode {
    const bits: React.ReactNode[] = []

    if (e.item_deltas && e.item_deltas.length > 0) {
        bits.push(
            <div key="deltas" className="flex flex-wrap gap-1.5">
                {e.item_deltas.map((it, i) => {
                    const d = deltaText(it.qty_delta ?? it.delta)
                    return (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white border border-[#E4E7EC] px-2 py-0.5 text-[11px] text-[#374151]">
                            {it.item_name}
                            {it.specification && <span className="text-[#98A2B3]">{it.specification}</span>}
                            {d && <span className="font-semibold text-[#2563EB]">×{d}</span>}
                        </span>
                    )
                })}
            </div>,
        )
    }

    if (e.prev_status && e.new_status && e.prev_status !== e.new_status) {
        bits.push(
            <p key="status" className="text-[12px] text-[#6B7280]">
                <span className="capitalize">{(STATUS_CONFIG[e.prev_status]?.label ?? e.prev_status).toLowerCase()}</span>
                {' → '}
                <span className="font-medium capitalize">{STATUS_CONFIG[e.new_status]?.label ?? e.new_status}</span>
            </p>,
        )
    }

    if (e.reason) {
        bits.push(
            <p key="reason" className="text-[12px] text-[#6B7280]">Reason: {e.reason}</p>,
        )
    }

    if (e.meta && typeof e.meta === 'object' && 'note' in e.meta && (e.meta.note as string)?.trim()) {
        bits.push(
            <p key="note" className="text-[12px] text-[#6B7280]">Note: {String(e.meta.note)}</p>,
        )
    }

    return bits.length > 0 ? <div className="mt-1 flex flex-col gap-1">{bits}</div> : null
}

export default function GatePassDetailPage() {
    const { id } = useParams()
    
    const { data: gp, isLoading, isError, error } = useGatePass(id)
    // The server's canonical balance for THIS pass, and the deliveries that drew
    // lines from it (each carrying only its own lines for this pass).
    const { data: balance } = useGatePassBalance(id)
    const { data: gpDeliveries } = useGatePassDeliveries(id)
    const deliveries = useMemo(() => gpDeliveries?.deliveries ?? [], [gpDeliveries])
    const updateStatus = useUpdateGatePassStatus()
    const adjust = useAdjustGatePass()
    const markDelivered = useMarkGatePassDelivered()
    const reopenLegacy = useReopenLegacyGatePass()

    const [statusOpen, setStatusOpen] = useState(false)
    const [markOpen, setMarkOpen] = useState(false)
    const [reopenConfirm, setReopenConfirm] = useState(false)
    const [markNote, setMarkNote] = useState('')
    const [markDate, setMarkDate] = useState(() => new Date().toISOString().split('T')[0])
    const [adjustingItem, setAdjustingItem] = useState<string | null>(null)
    const [adjustingSpec, setAdjustingSpec] = useState('')
    const [adjustQty, setAdjustQty] = useState(0)
    const [adjustReason, setAdjustReason] = useState('')

    const updateDate = useUpdateGatePassDate()
    const [editingDate, setEditingDate] = useState(false)
    const [dateValue, setDateValue] = useState('')
    const [dateReason, setDateReason] = useState('')

    const updateDeliveryDate = useUpdateDeliveryDate()
    const [deliveryDateEditId, setDeliveryDateEditId] = useState<string | null>(null)
    const [deliveryDateValue, setDeliveryDateValue] = useState('')
    const [deliveryDateReason, setDeliveryDateReason] = useState('')

    const createBill = useCreateBillFromGatePass()
    const [billingOpen, setBillingOpen] = useState(false)
    const [instantBill, setInstantBill] = useState(false)
    const [billNotes, setBillNotes] = useState('')

    const updateGatePass = useUpdateGatePass()
    const [editing, setEditing] = useState(false)
    const [editClientName, setEditClientName] = useState('')
    const [editReceivedBy, setEditReceivedBy] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [editItems, setEditItems] = useState<any[]>([])

    // Optional: pick items from the linked quotation while editing
    const quotationQuery = useQuotation(gp?.quotation_id)
    const quotationItemList = useMemo(
        () => (quotationQuery.data?.line_items ?? []).map(li => ({
            item_name: li.item_name,
            category: li.category,
            specifications: li.specifications,
        })),
        [quotationQuery.data],
    )
    const editQuotationOptions = useMemo(
        () => toQuotationOptions(quotationItemList),
        [quotationItemList],
    )
    const allQuotationItemNames = useMemo(
        () => new Set(quotationItemList.map(qi => qi.item_name.toLowerCase())),
        [quotationItemList],
    )
    const isEditCustomItem = (name: string) =>
        !!quotationQuery.data && name.trim() !== '' &&
        !allQuotationItemNames.has(name.trim().toLowerCase())

    /**
     * Canonical per-item balance, straight from the server.
     *
     * This page used to build `deliveredMap` and `returnedMap` itself and then
     * subtract per item. That had three problems: a delivery spanning two gate
     * passes charged all its lines to whichever pass this screen asked about,
     * a legacy `marked_delivered` pass had its received quantity faked as
     * delivered, and the resulting number could disagree with the delivery
     * form's view of the same linen. The server owns this arithmetic now.
     */
    const balanceItems = balance?.items ?? NO_ITEMS
    const balanceByKey = useMemo(() => {
        const map: Record<string, GatePassBalanceItem> = {}
        for (const row of balanceItems) map[row.item_key] = row
        return map
    }, [balanceItems])

    const itemKey = (name: string, spec?: string | null) => `${name}||${spec || ''}`

    const { data: returnsList = [] } = useQuery({
        queryKey: ['returns', 'detail', id],
        queryFn: () =>
            (id
                ? returnsApi.list({ gate_pass_id: id })
                : Promise.resolve({ items: [] as Return[] }))
                .then((r: any) => (Array.isArray(r) ? r : r?.items ?? [])),
        enabled: Boolean(id),
        staleTime: 60_000,
    })

    // ── Activity journal (append-only timeline from the event service) ───────
    const { data: journal = [] } = useQuery({
        queryKey: ['events', 'gate-pass', id],
        queryFn: () => ops.events.list({ gate_pass_id: id, limit: 200 }),
        enabled: Boolean(id),
        staleTime: 30_000,
    })

    const timeline = useMemo<TransactionEvent[]>(
        () => [...journal].sort((a, b) => String(a.occurred_at).localeCompare(String(b.occurred_at))).reverse(),
        [journal],
    )

    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
            </div>
        )
    }

    if (isError) {
        return <ErrorState description={error instanceof Error ? error.message : 'Unable to load gate pass'} />
    }

    if (!gp) {
        return <EmptyState title="Gate pass not found" description="It may have been deleted." />
    }

    const totalReceived = (gp.items ?? []).reduce((s: number, i: any) => s + i.received_qty, 0)
    const mismatches = (gp.items ?? []).filter((i: any) => i.difference !== 0)

    // Totals come from the server's balance document, never from a local sum.
    // While it is still loading we fall back to the raw received total rather
    // than showing a pending figure derived from a half-populated map.
    const totalDelivered = balance?.totals.delivered_qty ?? 0
    const totalPending = balance?.totals.outstanding_delivery_qty ?? 0

    const handleAdjust = (itemName: string, spec = '') => {
        const item = (gp.items ?? []).find((i: any) => i.item_name === itemName && (i.specification || '') === spec)
        if (!item) return
        setAdjustingItem(itemName)
        setAdjustingSpec(spec)
        setAdjustQty(item.received_qty)
        setAdjustReason('')
    }

    const submitAdjust = () => {
        if (!id || !adjustingItem || !adjustReason) return
        adjust.mutate(
            { id, item_name: adjustingItem, specification: adjustingSpec, corrected_qty: adjustQty, reason: adjustReason },
            { onSuccess: () => setAdjustingItem(null) },
        )
    }

    const startEditDate = () => {
        setDateValue((gp.receiving_date || '').slice(0, 10))
        setDateReason('')
        setEditingDate(true)
    }

    const submitDate = () => {
        if (!id || !dateValue) return
        updateDate.mutate(
            { id, receiving_date: dateValue, reason: dateReason },
            { onSuccess: () => setEditingDate(false) },
        )
    }

    const startDeliveryDateEdit = (d: { id: string; delivery_date: string }) => {
        setDeliveryDateValue((d.delivery_date || '').slice(0, 10))
        setDeliveryDateReason('')
        setDeliveryDateEditId(d.id)
    }

    const submitDeliveryDate = (deliveryId: string) => {
        if (!deliveryId || !deliveryDateValue) return
        updateDeliveryDate.mutate(
            { id: deliveryId, delivery_date: deliveryDateValue, reason: deliveryDateReason },
            { onSuccess: () => setDeliveryDateEditId(null) },
        )
    }

    const submitBill = () => {
        if (!id) return
        createBill.mutate(
            {
                gate_pass_id: id,
                instant: instantBill,
                notes: billNotes,
                quotation_id: gp.quotation_id,
                client_name: gp.client_name,
            },
            {
                onSuccess: () => {
                    setBillingOpen(false)
                    setBillNotes('')
                    setInstantBill(false)
                },
            },
        )
    }

    const hasMovement = deliveries.some((d: any) => d.status !== 'CANCELLED') || returnsList.length > 0
    const canEdit = !['DELIVERED', 'CANCELLED'].includes(gp.status) && !hasMovement

    const startEdit = () => {
        setEditClientName(gp.client_name)
        setEditReceivedBy(gp.received_by)
        setEditNotes(gp.notes ?? '')
        setEditItems((gp.items ?? []).map((i: any) => ({ ...i })))
        setEditing(true)
    }

    const updateEditItem = (idx: number, field: 'item_name' | 'category' | 'specification' | 'client_qty' | 'received_qty' | 'rewashed', value: string | number | boolean) => {
        setEditItems(prev => {
            const next = prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
            return next
        })
    }

    const updateEditItemName = (idx: number, name: string, category?: string, specification?: string) => {
        setEditItems(prev => prev.map((it, i) => (i === idx ? {
            ...it,
            item_name: name,
            ...(category !== undefined ? { category } : {}),
            ...(specification !== undefined ? { specification } : {}),
        } : it)))
    }

    const addEditItem = () => {
        setEditItems(prev => [
            ...prev,
            {
                item_name: '',
                category: '',
                client_qty: 0,
                received_qty: 0,
                difference: 0,
                specification: null,
                mismatch_reason: null,
                mismatch_notes: null,
                rewashed: false,
            },
        ])
    }

    const removeEditItem = (idx: number) => {
        setEditItems(prev => prev.filter((_, i) => i !== idx))
    }

    const submitEdit = () => {
        if (!id || editItems.length === 0) return
        const items = editItems
            .filter((it: any) => it.item_name && it.item_name.trim())
            .map((it: any) => ({
                item_name: it.item_name.trim(),
                category: it.category?.trim() || null,
                specification: it.specification?.trim() || null,
                client_qty: Number(it.client_qty) || 0,
                received_qty: Number(it.received_qty) || 0,
                mismatch_reason: it.mismatch_reason || null,
                mismatch_notes: it.mismatch_notes || null,
                rewashed: Boolean(it.rewashed),
            }))
        if (items.length === 0) return
        updateGatePass.mutate(
            {
                id,
                payload: {
                    client_name: editClientName.trim() || undefined,
                    received_by: editReceivedBy.trim() || undefined,
                    notes: editNotes.trim() || undefined,
                    items,
                },
            },
            { onSuccess: () => setEditing(false) },
        )
    }

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <Link to="/gate-passes" className="mt-1 text-[#98A2B3] hover:text-[#374151] transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <Breadcrumb
                            items={[
                                { label: 'Dashboard', href: '/' },
                                { label: 'Gate Passes', href: '/gate-passes' },
                                { label: gp.client_name },
                            ]}
                        />
                        <h1 className="text-dashboard-title mt-1">{gp.client_name}</h1>
                        <p className="font-mono text-[12px] text-[#98A2B3] mt-0.5">{gp.gate_pass_number}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={gp.status} />

                    {/* Status Transition Dropdown */}
                    {!['PARTIALLY_DELIVERED', 'DELIVERED'].includes(gp.status) && (
                        <div className="relative">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setStatusOpen(o => !o)}
                                disabled={updateStatus.isPending}
                            >
                                Update Status <ChevronDown className="h-3.5 w-3.5 ml-1" />
                            </Button>
                            <AnimatePresence>
                                {statusOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-[#E4E7EC] bg-white shadow-lg shadow-black/5 py-1"
                                    >
                                        {TRANSITION_STATUSES.filter(s => s !== gp.status).map(s => {
                                            const cfg = STATUS_CONFIG[s]
                                            return (
                                                <button
                                                    key={s}
                                                    onClick={() => {
                                                        updateStatus.mutate({ id: id!, status: s })
                                                        setStatusOpen(false)
                                                    }}
                                                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#374151] hover:bg-[#F9FAFB] cursor-pointer transition"
                                                >
                                                    <span className="h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
                                                    {cfg.label}
                                                </button>
                                            )
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {canEdit &&
                        (editing ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    onClick={submitEdit}
                                    disabled={updateGatePass.isPending || editItems.filter((i: any) => i.item_name?.trim()).length === 0}
                                    className="bg-[#16A34A] hover:bg-[#15803D] text-white"
                                >
                                    <Save className="h-3.5 w-3.5" /> Save Items
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                                    <X className="h-3.5 w-3.5" /> Cancel
                                </Button>
                            </div>
                        ) : (
                            <Button size="sm" variant="secondary" onClick={startEdit}>
                                <Pencil className="h-3.5 w-3.5" /> Edit Items
                            </Button>
                        ))}

                    {!['DELIVERED', 'CANCELLED'].includes(gp.status) && (
                        <Button
                            size="sm"
                            onClick={() => {
                                setMarkNote('')
                                setMarkDate(new Date().toISOString().split('T')[0])
                                setMarkOpen(true)
                            }}
                            disabled={markDelivered.isPending}
                            className="bg-[#16A34A] hover:bg-[#15803D] text-white"
                            title="Complete with a note when the delivery was never recorded"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Delivered
                        </Button>
                    )}

                    <Link to="/deliveries/new">
                        <Button size="sm" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                            <Truck className="h-3.5 w-3.5" /> Record Delivery
                        </Button>
                    </Link>

                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setBillingOpen(o => !o)}
                        disabled={createBill.isPending}
                    >
                        <Receipt className="h-3.5 w-3.5" /> Create Bill
                    </Button>
                </div>
            </div>

            {/* Info Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Received date — editable to correct human error */}
                <Card className="p-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-[#98A2B3]" />
                            <p className="text-[11px] text-[#98A2B3] font-medium uppercase tracking-wide">Received</p>
                        </div>
                        {!editingDate && (
                            <button
                                onClick={startEditDate}
                                className="text-[#6B7280] hover:text-[#2563EB] transition"
                                title="Correct receiving date"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    {editingDate ? (
                        <div className="flex flex-col gap-2">
                            <input
                                type="date"
                                value={dateValue}
                                onChange={e => setDateValue(e.target.value)}
                                className="h-9 w-full rounded-lg border border-[#BFDBFE] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                            />
                            <select
                                value={dateReason}
                                onChange={e => setDateReason(e.target.value)}
                                className="h-9 w-full cursor-pointer rounded-lg border border-[#BFDBFE] bg-white px-3 text-[12px] outline-none focus:border-[#2563EB]"
                            >
                                <option value="">Reason required…</option>
                                {DATE_CORRECTION_REASONS.map(r => (
                                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={submitDate}
                                    disabled={!dateValue || !dateReason || updateDate.isPending}
                                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                                >
                                    <Check className="h-3.5 w-3.5" /> Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingDate(false)}>
                                    <X className="h-3.5 w-3.5" /> Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[13px] font-semibold text-[#101828]">{formatDate(gp.receiving_date)}</p>
                    )}
                </Card>

                {[
                    { icon: User, label: 'Received By', value: gp.received_by },
                    { icon: ClipboardList, label: 'Items', value: `${(gp.items ?? []).length} types · ${totalReceived} pcs` },
                    { icon: Truck, label: 'Delivered', value: totalDelivered > 0 ? `${totalDelivered} pcs` : 'None yet' },
                    { icon: AlertCircle, label: 'Pending', value: totalPending > 0 ? `${totalPending} pcs` : 'All delivered' },
                    { icon: AlertCircle, label: 'Mismatches', value: mismatches.length > 0 ? `${mismatches.length} item${mismatches.length > 1 ? 's' : ''}` : 'None' },
                ].map(({ icon: Icon, label, value }) => (
                    <Card key={label} className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Icon className="h-3.5 w-3.5 text-[#98A2B3]" />
                            <p className="text-[11px] text-[#98A2B3] font-medium uppercase tracking-wide">{label}</p>
                        </div>
                        <p className="text-[13px] font-semibold text-[#101828]">{value}</p>
                    </Card>
                ))}
            </div>

            {/* Completed by note (delivery was never recorded) */}
            {gp.marked_delivered && (
                deliveries.some((d: { status?: string }) => d.status !== 'CANCELLED') ? (
                    <Card className="border-[#BBF7D0] bg-[#F0FDF4] p-4">
                        <div className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-[#16A34A] mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[13px] font-semibold text-[#15803D]">
                                    Completed as delivered by note
                                    {(gp.marked_delivered as any)?.delivered_date && (
                                        <span className="font-normal text-[#6B7280]">
                                            {' '}· {formatDate(String((gp.marked_delivered as any).delivered_date))}
                                        </span>
                                    )}
                                </p>
                                <p className="text-[12px] text-[#374151] mt-0.5">{(gp.marked_delivered as any)?.note}</p>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="border-[#FDE68A] bg-[#FFFBEB] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="h-4 w-4 text-[#D97706] mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[13px] font-semibold text-[#B45309]">
                                        Closed by a legacy note, no delivery records
                                    </p>
                                    <p className="text-[12px] text-[#92400E] mt-0.5">
                                        This pass was completed by the old mark-delivered note, which never recorded a real
                                        dispatch — its balance is hidden, and nothing appears in pending deliveries.
                                        Reopen it to record the delivery properly (quantities are not fabricated).
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                className="shrink-0 bg-[#D97706] hover:bg-[#B45309] text-white"
                                onClick={() => setReopenConfirm(true)}
                                disabled={reopenLegacy.isPending}
                            >
                                <Undo2 className="h-3.5 w-3.5" /> Reopen for delivery
                            </Button>
                        </div>
                    </Card>
                )
            )}

            {/* Create Bill from Gate Pass */}
            {billingOpen && (
                <Card className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[13px] font-semibold text-[#101828]">Create Bill from this Gate Pass</p>
                        <button
                            onClick={() => setBillingOpen(false)}
                            className="text-[#6B7280] hover:text-[#374151] transition"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    {(() => {
                        const rewashed = (gp.items ?? []).filter((i: any) => i.rewashed)
                        const rewashedQty = rewashed.reduce((s: number, i: any) => s + (i.received_qty || 0), 0)
                        if (rewashedQty <= 0) return null
                        return (
                            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[12px] text-[#15803D]">
                                <RotateCcw size={14} className="mt-0.5 shrink-0" />
                                <span>
                                    <span className="font-semibold">{rewashedQty} pcs</span> rewashed on this pass
                                    ({rewashed.map((i: any) => i.item_name).join(', ')}) — treated as a free re-wash
                                    and excluded from this bill.
                                </span>
                            </div>
                        )
                    })()}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="flex items-center gap-2 text-[13px] text-[#374151] whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={instantBill}
                                onChange={e => setInstantBill(e.target.checked)}
                                className="h-4 w-4 rounded border-[#D0D5DD]"
                            />
                            Instant (paid now)
                        </label>
                        <input
                            type="text"
                            value={billNotes}
                            onChange={e => setBillNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="h-9 flex-1 rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                        />
                        <Button
                            size="sm"
                            onClick={submitBill}
                            disabled={createBill.isPending}
                            className="bg-[#16A34A] hover:bg-[#15803D] text-white"
                        >
                            <Check className="h-3.5 w-3.5" /> {instantBill ? 'Create & Mark Paid' : 'Create Bill'}
                        </Button>
                    </div>
                </Card>
            )}

            {/* Notes */}
            {gp.notes && (
                <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] mb-1">Notes</p>
                    <p className="text-[13px] text-[#374151]">{gp.notes}</p>
                </Card>
            )}

            {/* Edit Mode */}
            {editing && (
                <Card>
                    <CardHeader className="border-b border-[#F2F4F7] pb-3 flex flex-row items-center justify-between">
                        <CardTitle>Edit Gate Pass</CardTitle>
                        <p className="text-[11px] text-[#16A34A] font-medium">Editable because not fully delivered</p>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Client Name</label>
                                <input
                                    value={editClientName}
                                    onChange={e => setEditClientName(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Received By</label>
                                <input
                                    value={editReceivedBy}
                                    onChange={e => setEditReceivedBy(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Notes</label>
                                <input
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <p className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider">Items</p>
                                {quotationItemList.length > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">
                                        Linked to quotation · {quotationItemList.length} items
                                    </span>
                                )}
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={addEditItem}>
                                <Plus className="h-3.5 w-3.5" /> Add Item
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {editItems.map((item: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-[#E4E7EC] bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_74px_74px_84px_36px] items-center">
                                    <div>
                                        <label className="block text-[10px] text-[#98A2B3] mb-0.5">Item Name</label>
                                        <SearchableSelect
                                            value={item.item_name}
                                            onValueChange={(name) => updateEditItemName(idx, name)}
                                            options={editQuotationOptions}
                                            onSelect={(opt) => {
                                                const data = (opt as QuotationOption).data
                                                updateEditItemName(idx, data.item_name, data.category, data.specification)
                                            }}
                                            onCreate={(text) => updateEditItemName(idx, text)}
                                            placeholder={quotationQuery.data ? 'Select or type item…' : 'e.g. Bed Sheet'}
                                            className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB] pr-8"
                                        />
                                        {quotationQuery.data && item.item_name?.trim() && isEditCustomItem(item.item_name) && (
                                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                                                New · will be added to quotation
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-[#98A2B3] mb-0.5">Category</label>
                                        <input
                                            value={item.category ?? ''}
                                            onChange={e => updateEditItem(idx, 'category', e.target.value)}
                                            placeholder="e.g. Bed Linen"
                                            className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-[#98A2B3] mb-0.5">Spec</label>
                                        <input
                                            value={item.specification ?? ''}
                                            onChange={e => updateEditItem(idx, 'specification', e.target.value)}
                                            placeholder="e.g. Red, XL"
                                            className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-[#98A2B3] mb-0.5">Client Qty</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={item.client_qty}
                                            onChange={e => updateEditItem(idx, 'client_qty', e.target.value)}
                                            className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-[#98A2B3] mb-0.5">Received</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={item.received_qty}
                                            onChange={e => updateEditItem(idx, 'received_qty', e.target.value)}
                                            className="h-9 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                        />
                                    </div>
                                    <label className={`flex items-center justify-center gap-1 rounded-md border px-1.5 py-1.5 text-[10px] font-semibold cursor-pointer select-none transition ${
                                        item.rewashed
                                            ? 'bg-[#FFF0F5] text-[#DB2777] border-[#FBCFE8]'
                                            : 'border-[#E4E7EC] bg-white text-[#98A2B3]'
                                    }`} title="Free re-wash — not billed">
                                        <input
                                            type="checkbox"
                                            checked={!!item.rewashed}
                                            onChange={e => updateEditItem(idx, 'rewashed', e.target.checked)}
                                            className="h-3 w-3 rounded border-[#D0D5DD] accent-[#DB2777]"
                                        />
                                        Rewash
                                    </label>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeEditItem(idx)}
                                            disabled={editItems.length === 1}
                                            aria-label="Remove item"
                                            className="text-[#DC2626] hover:bg-[#FFF1F1] disabled:opacity-20"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Items Table */}
            {!editing && (
            <Card>
                <CardHeader className="border-b border-[#F2F4F7] pb-3">
                    <CardTitle>Item Breakdown</CardTitle>
                    {hasMovement && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-[#B45309]">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            Quantities are locked because deliveries/bills exist. Use the pencil on a row to request an adjustment — an approved correction re-syncs linked bills automatically.
                        </p>
                    )}
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="border-b border-[#F2F4F7]">
                                    {['Item', 'Spec', 'Category', 'Client Qty', 'Received', 'Delivered', 'Returned', 'Pending', 'Diff', 'Reason', ''].map(h => (
                                        <th key={h} className="py-3 pr-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] first:pl-0">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F9FAFB]">
                                {(gp.items ?? []).map((item: any) => (
                                    <Fragment key={`${item.item_name}||${item.specification || ''}`}>
                                        <tr key={`${item.item_name}||${item.specification || ''}`} className="group">
                                            <td className="py-3 pr-3 font-medium text-[#101828]">
                                                {item.item_name}
                                                {item.rewashed && (
                                                    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFF0F5] border border-[#FBCFE8] px-1.5 py-0.5 text-[10px] font-semibold text-[#DB2777]" title="Free re-wash — never billed">
                                                        <RotateCcw className="h-2.5 w-2.5" /> Rewashed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3">
                                                {item.specification ? (
                                                    <span className="inline-flex items-center rounded bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 text-[11px] font-semibold text-[#EA580C]">
                                                        {item.specification}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#D0D5DD]">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 text-[#6B7280]">{item.category || '—'}</td>
                                            <td className="py-3 pr-3 text-[#6B7280]">{item.client_qty}</td>
                                            <td className="py-3 pr-3 font-semibold text-[#101828]">{item.received_qty}</td>
                                            <td className="py-3 pr-3 text-[#6B7280]">{balanceByKey[itemKey(item.item_name, item.specification)]?.delivered_qty ?? 0}</td>
                                            <td className="py-3 pr-3 text-[#6B7280]">{balanceByKey[itemKey(item.item_name, item.specification)]?.returned_back_qty ?? 0}</td>
                                            <td className="py-3 pr-3">
                                                {(() => {
                                                    // Server-computed outstanding, including
                                                    // returns awaiting a re-send.
                                                    const row = balanceByKey[itemKey(item.item_name, item.specification)]
                                                    const pending = row?.outstanding_delivery_qty ?? 0
                                                    return pending > 0 ? (
                                                        <span className="font-semibold text-[#EA580C]">{pending}</span>
                                                    ) : (
                                                        <span className="font-semibold text-[#16A34A]">0</span>
                                                    )
                                                })()}
                                            </td>
                                            <td className="py-3 pr-3">
                                                <span className={`font-semibold ${item.difference === 0 ? 'text-[#16A34A]' :
                                                        item.difference > 0 ? 'text-[#2563EB]' : 'text-[#C2410C]'
                                                    }`}>
                                                    {item.difference > 0 ? `+${item.difference}` : item.difference}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-3 text-[#6B7280] text-[12px]">
                                                {item.mismatch_reason?.replace(/_/g, ' ') || '—'}
                                            </td>
                                            <td className="py-3 text-right">
                                                {gp.status !== 'CANCELLED' && (
                                                    <button
                                                        onClick={() => handleAdjust(item.item_name, item.specification || '')}
                                                        className="text-[#6B7280] hover:text-[#2563EB] transition"
                                                        title="Adjust quantity"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Inline adjustment row */}
                                        <AnimatePresence>
                                            {adjustingItem === item.item_name && adjustingSpec === (item.specification || '') && (
                                                <tr key={`${item.item_name}-adj`}>
                                                    <td colSpan={10} className="pb-3">
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-end"
                                                        >
                                                            <div>
                                                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Corrected Qty</label>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={adjustQty}
                                                                    onChange={e => setAdjustQty(Number(e.target.value))}
                                                                    className="h-9 w-24 rounded-lg border border-[#BFDBFE] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                                                />
                                                            </div>
                                                            <div className="flex-1 w-full sm:w-auto">
                                                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Reason</label>
                                                                <input
                                                                    type="text"
                                                                    value={adjustReason}
                                                                    onChange={e => setAdjustReason(e.target.value)}
                                                                    placeholder="Reason for adjustment…"
                                                                    className="h-9 w-full rounded-lg border border-[#BFDBFE] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                                                />
                                                                <p className="mt-1 text-[11px] text-[#6B7280]">
                                                                    Needs approval by another user — linked bills update automatically after approval.
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    onClick={submitAdjust}
                                                                    disabled={!adjustReason || adjust.isPending}
                                                                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                                                                >
                                                                    <Check className="h-3.5 w-3.5" /> Save
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setAdjustingItem(null)}
                                                                >
                                                                    <X className="h-3.5 w-3.5" /> Cancel
                                                                </Button>
                                                            </div>
                                                        </motion.div>
                                                    </td>
                                                </tr>
                                            )}
                                        </AnimatePresence>
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
            )}

            {/* Deliveries for this Gate Pass */}
            {deliveries.length > 0 && (
                <Card>
                    <CardHeader className="border-b border-[#F2F4F7] pb-3">
                        <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-[#2563EB]" />
                            <CardTitle>Deliveries ({deliveries.length})</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-3 divide-y divide-[#F9FAFB]">
                        {deliveries.map((d: any) => (
                            <div key={d.id}>
                                <div className="flex items-center justify-between gap-3 py-3">
                                    <Link to={`/deliveries/${d.id}`} className="flex flex-1 items-center justify-between gap-3 hover:opacity-70 transition">
                                        <div>
                                            <p className="text-[13px] font-medium text-[#101828]">
                                                {d.items?.reduce ? d.items.reduce((s: number, i: any) => s + i.quantity, 0) : 0} pieces delivered
                                            </p>
                                            <p className="text-[12px] text-[#98A2B3]">{formatDate(d.delivery_date)} · by {d.delivered_by}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[#16A34A] text-[12px] font-medium">
                                            <CheckCircle2 className="h-4 w-4" /> Delivered
                                        </div>
                                    </Link>
                                    <button
                                        onClick={() => startDeliveryDateEdit(d)}
                                        className="shrink-0 text-[#6B7280] hover:text-[#2563EB] transition"
                                        title="Correct delivery date"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {deliveryDateEditId === d.id && (
                                    <div className="mb-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Delivered Date</label>
                                                <input
                                                    type="date"
                                                    value={deliveryDateValue}
                                                    onChange={e => setDeliveryDateValue(e.target.value)}
                                                    className="h-9 rounded-lg border border-[#BFDBFE] bg-white px-3 text-[13px] outline-none focus:border-[#2563EB]"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Reason</label>
                                                <select
                                                    value={deliveryDateReason}
                                                    onChange={e => setDeliveryDateReason(e.target.value)}
                                                    className="h-9 w-full cursor-pointer rounded-lg border border-[#BFDBFE] bg-white px-3 text-[12px] outline-none focus:border-[#2563EB]"
                                                >
                                                    <option value="">Reason required…</option>
                                                    {DATE_CORRECTION_REASONS.map(r => (
                                                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => submitDeliveryDate(d.id)}
                                                    disabled={!deliveryDateValue || !deliveryDateReason || updateDeliveryDate.isPending}
                                                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                                                >
                                                    <Check className="h-3.5 w-3.5" /> Save
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setDeliveryDateEditId(null)}>
                                                    <X className="h-3.5 w-3.5" /> Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Activity Timeline (from the immutable event journal) */}
            <Card>
                <CardHeader className="border-b border-[#F2F4F7] pb-3">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-[#6B7280]" />
                        <CardTitle>Activity</CardTitle>
                        {timeline.length > 0 && (
                            <span className="text-[11px] font-medium text-[#98A2B3]">{timeline.length} event{timeline.length !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    {timeline.length === 0 ? (
                        <div className="py-6 text-center">
                            <History className="mx-auto h-6 w-6 text-[#D0D5DD]" />
                            <p className="text-[12px] text-[#98A2B3] mt-2">No activity recorded for this gate pass yet.</p>
                        </div>
                    ) : (
                        <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-[#E4E7EC]">
                            {timeline.map(ev => {
                                const theme = EVENT_THEME[ev.event_type] ?? { icon: History, label: ev.event_type.replace(/_/g, ' ').toLowerCase(), bg: '#F9FAFB', text: '#374151', border: '#E4E7EC' }
                                const Icon = theme.icon
                                return (
                                    <li key={ev.id} className="relative flex items-start gap-3">
                                        <span
                                            className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                                            style={{ background: theme.bg, borderColor: theme.border, color: theme.text }}
                                        >
                                            <Icon className="h-3 w-3" />
                                        </span>
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <p className="text-[13px] font-medium text-[#101828]" style={{ color: theme.text }}>
                                                    {theme.label}
                                                </p>
                                                <span className="shrink-0 text-[11px] text-[#98A2B3]">{fmtWhen(ev.occurred_at)}</span>
                                            </div>
                                            {eventDetail(ev)}
                                            {(ev.user_name || (ev.meta && typeof ev.meta === 'object' && 'user_name' in ev.meta)) && (
                                                <p className="text-[11px] text-[#98A2B3]">
                                                    by {ev.user_name || String((ev.meta as Record<string, unknown>).user_name)}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                </CardContent>
            </Card>

            {/* Mark Delivered (catch-up) modal */}
            {markOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-xl">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[14px] font-semibold text-[#101828]">Mark Delivered & Complete</p>
                            <button onClick={() => setMarkOpen(false)} className="text-[#98A2B3] hover:text-[#374151] transition cursor-pointer">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-[12px] text-[#6B7280] mb-4">
                            Use this when the laundry was delivered but the dispatch was never recorded on the delivery date. A note is required to complete this gate pass.
                        </p>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Delivered Date</label>
                                <input
                                    type="date"
                                    value={markDate}
                                    onChange={e => setMarkDate(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#16A34A]"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">
                                    Note <span className="text-[#DC2626]">*</span>
                                </label>
                                <textarea
                                    value={markNote}
                                    onChange={e => setMarkNote(e.target.value)}
                                    rows={3}
                                    placeholder="e.g. Delivered to hotel front office on that day, sign sheet not updated"
                                    className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-[13px] text-[#101828] outline-none focus:border-[#16A34A] resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <Button variant="secondary" size="sm" onClick={() => setMarkOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (!markNote.trim() || !id) return
                                    markDelivered.mutate(
                                        {
                                            id,
                                            data: {
                                                note: markNote.trim(),
                                                delivered_date: markDate || undefined,
                                            },
                                        },
                                        { onSuccess: () => setMarkOpen(false) },
                                    )
                                }}
                                disabled={!markNote.trim() || markDelivered.isPending}
                                className="bg-[#16A34A] hover:bg-[#15803D] text-white disabled:opacity-40"
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" /> {markDelivered.isPending ? 'Completing…' : 'Complete as Delivered'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reopen legacy closure modal */}
            <SmartConfirm
                open={reopenConfirm}
                title="Reopen this legacy gate pass?"
                message="The old mark-delivered note closed this pass without any recorded dispatch. Reopening flags the legacy closure in the journal (LEGACY_CLOSED_WITHOUT_DELIVERY) and moves it back to Received so it reappears in Pending to Deliver. No quantities are invented."
                changes={[{ label: 'Status', from: gp.status, to: 'RECEIVED' }]}
                confirmLabel="Reopen for delivery"
                loading={reopenLegacy.isPending}
                onCancel={() => setReopenConfirm(false)}
                onConfirm={() => {
                    setReopenConfirm(false)
                    if (id) reopenLegacy.mutate(id)
                }}
            />
        </div>
    )
}
