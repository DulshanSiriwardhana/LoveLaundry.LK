import { useNavigate } from 'react-router-dom'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogTitle,
} from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { GatePassStatusPill, DeliveryStatusPill, type DeliveryStatus } from './operations-status'
import { BillStatusBadge } from '../../../components/ui/bill-status-badge'
import { formatDate, formatDateOnly } from '../../../lib/utils'
import { ArrowUpRight, ClipboardList, Truck, Receipt, AlertTriangle, RotateCw } from 'lucide-react'
import type { GatePass, Delivery } from '../../../types/operations'
import type { Bill } from '../../../types/bill'

export type QuickViewEntity = GatePass | Delivery | Bill
export type QuickViewType = 'gatepass' | 'delivery' | 'bill'

interface QuickViewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    type: QuickViewType
    entity: QuickViewEntity | null
    /** Pre-derived delivery status (from the gate pass) so pills match the list view. */
    deliveryStatus?: DeliveryStatus
}

function DetailRow({ label, value, color }: { label: string; value?: string | number | null; color?: string }) {
    return (
        <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">{label}</span>
            <span className="truncate text-[12px] font-semibold text-[var(--text-primary)]" style={color ? { color } : undefined}>
                {value === undefined || value === null || value === '' ? '—' : value}
            </span>
        </div>
    )
}

export function QuickViewModal({ open, onOpenChange, type, entity, deliveryStatus }: QuickViewModalProps) {
    const navigate = useNavigate()

    const handleOpenFull = () => {
        if (!entity) return
        onOpenChange(false)
        if (type === 'gatepass') navigate(`/gate-passes/${entity.id}`)
        else if (type === 'delivery') navigate(`/deliveries/${entity.id}`)
        else navigate(`/bills/${entity.id}`)
    }

    const title = !entity
        ? ''
        : type === 'gatepass'
            ? (entity as GatePass).gate_pass_number
            : type === 'delivery'
                ? `DLV-${entity.id.slice(-8).toUpperCase()}`
                : 'Bill'

    const clientName = entity?.client_name ?? ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader className="text-left">
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                                type === 'gatepass'
                                    ? 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                                    : type === 'delivery'
                                        ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]'
                                        : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]'
                            }`}
                        >
                            {type === 'gatepass' ? <ClipboardList size={18} /> : type === 'delivery' ? <Truck size={18} /> : <Receipt size={18} />}
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="mt-0">
                                {type === 'gatepass' ? 'Gate Pass' : type === 'delivery' ? 'Delivery' : 'Bill'} · {title}
                            </DialogTitle>
                            <p className="truncate text-[12px] text-[var(--text-muted)] mt-0.5">{clientName || 'Unknown hotel'}</p>
                        </div>
                        <div className="ml-auto shrink-0">
                            {type === 'gatepass' && <GatePassStatusPill status={(entity as GatePass | null)?.status ?? ''} />}
                            {type === 'delivery' && deliveryStatus && <DeliveryStatusPill status={deliveryStatus} />}
                            {type === 'bill' && <BillStatusBadge status={(entity as Bill | null)?.payment_status ?? ''} />}
                        </div>
                    </div>
                </DialogHeader>

                <DialogBody className="space-y-4">
                    {/* The body must be gated on `entity`, not just on `type`.
                        `type` is a stable literal for the lifetime of the modal,
                        but the pages null `entity` the instant the dialog starts
                        closing (`onOpenChange={open => !open && setQuickView(null)}`).
                        Radix keeps DialogContent mounted through its exit
                        animation, so the body used to re-render once with
                        `entity === null` and GatePassQuickView/DeliveryQuickView
                        threw on `gp.items` / `delivery.items` -- reported as
                        "Cannot read properties of null (reading 'items')".
                        The `as GatePass` casts hid this from the compiler. */}
                    {!entity ? null : type === 'gatepass' ? (
                        <GatePassQuickView gp={entity as GatePass} />
                    ) : type === 'delivery' ? (
                        <DeliveryQuickView delivery={entity as Delivery} />
                    ) : (
                        <BillQuickView bill={entity as Bill} />
                    )}
                </DialogBody>

                <DialogFooter className="flex-row items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    <Button size="sm" onClick={handleOpenFull} disabled={!entity}>
                        <ArrowUpRight className="h-4 w-4" /> Open Full Page
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function GatePassQuickView({ gp }: { gp: GatePass }) {
    const total = (gp.items ?? []).reduce((sum, item) => sum + (item.received_qty || 0), 0)
    const mismatches = (gp.items ?? []).filter(item => (item.difference ?? 0) !== 0)
    const rewashed = (gp.items ?? []).filter(item => item.rewashed)
    const rewashedQty = rewashed.reduce((sum, item) => sum + (item.received_qty || 0), 0)
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4">
                <DetailRow label="Received" value={formatDateOnly(gp.receiving_date)} />
                <DetailRow label="Received by" value={gp.received_by} />
                <DetailRow label="Item types" value={(gp.items ?? []).length} />
                <DetailRow label="Total qty" value={`${total} pcs`} />
            </div>

            {mismatches.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] font-medium text-[#B45309]">
                    <AlertTriangle size={14} />
                    {mismatches.length} item{mismatches.length > 1 ? 's' : ''} with receipt mismatch
                </div>
            )}

            {rewashed.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[12px] font-medium text-[#15803D]">
                    <RotateCw size={14} />
                    {rewashed.length} rewashed type{rewashed.length > 1 ? 's' : ''} ({rewashedQty} pcs received) · free, not billed
                </div>
            )}

            <ItemsTable
                rows={(gp.items ?? []).map(item => ({
                    name: item.item_name,
                    spec: item.specification ?? '',
                    a: `${item.client_qty}`,
                    b: `${item.received_qty}`,
                    flag: (item.difference ?? 0) !== 0,
                    rewashed: !!item.rewashed,
                }))}
                aLabel="Sent"
                bLabel="Received"
            />

            {gp.notes && <p className="text-[12px] text-[var(--text-muted)]">ℹ {gp.notes}</p>}
        </div>
    )
}

function DeliveryQuickView({ delivery }: { delivery: Delivery }) {
    const total = (delivery.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0)
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4">
                <DetailRow label="Delivered" value={formatDateOnly(delivery.delivery_date)} />
                <DetailRow label="Delivered by" value={delivery.delivered_by} />
                <DetailRow label="Received by" value={delivery.received_by} />
                <DetailRow label="Total qty" value={`${total} pcs`} />
            </div>

            <ItemsTable
                rows={(delivery.items ?? []).map(item => ({
                    name: item.item_name,
                    spec: item.specification ?? '',
                    a: `${item.quantity}`,
                    b: '',
                    flag: false,
                }))}
                aLabel="Qty"
                bLabel=""
            />

            {delivery.notes && <p className="text-[12px] text-[var(--text-muted)]">ℹ {delivery.notes}</p>}
        </div>
    )
}

function BillQuickView({ bill }: { bill: Bill }) {
    const grandTotal = bill.grand_total ?? bill.total_amount
    const paid = bill.paid_amount ?? 0
    const outstanding = bill.outstanding_amount ?? Math.max(0, grandTotal - paid)
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-4">
                <DetailRow label="Created" value={formatDate(bill.created_at)} />
                <DetailRow label="Quotation" value={bill.quotation_title || 'Price List'} />
                <DetailRow label="Items" value={bill.total_quantity ?? (bill.items ?? []).length} />
            </div>

            <ItemsTable
                rows={(bill.items ?? []).map(item => ({
                    name: item.item_name,
                    spec: '',
                    a: `${item.quantity} × ${Number(item.unit_price ?? 0).toFixed(2)}`,
                    b: Number(item.line_total ?? 0).toFixed(2),
                    flag: false,
                }))}
                aLabel="Qty × Rate"
                bLabel="LKR"
            />

            <div className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-muted)]">Grand total</span>
                    <span className="font-bold text-[var(--text-primary)]">LKR {grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-muted)]">Paid</span>
                    <span className="font-semibold text-[#16A34A]">LKR {paid.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--text-muted)]">Outstanding</span>
                    <span className="font-semibold text-[#DC2626]">LKR {outstanding.toFixed(2)}</span>
                </div>
            </div>

            {bill.notes && <p className="text-[12px] text-[var(--text-muted)]">ℹ {bill.notes}</p>}
        </div>
    )
}

function ItemsTable({
    rows,
    aLabel,
    bLabel,
}: {
    rows: Array<{ name: string; spec: string; a: string; b: string; flag: boolean; rewashed?: boolean }>
    aLabel: string
    bLabel: string
}) {
    if (rows.length === 0) {
        return <p className="text-[12px] text-[var(--text-faint)]">No items recorded.</p>
    }
    return (
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
            <table className="w-full min-w-[420px] text-left text-[12px]">
                <thead className="bg-[var(--surface-2)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                    <tr>
                        <th className="px-3 py-2">Item</th>
                        {rows.some(r => r.spec) && <th className="px-2 py-2">Spec</th>}
                        <th className="px-3 py-2 text-right">{aLabel}</th>
                        {bLabel && <th className="px-3 py-2 text-right">{bLabel}</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                    {rows.map((row, i) => (
                        <tr key={`${row.name}-${row.spec}-${i}`}>
                            <td className={row.flag ? 'px-3 py-2 font-medium text-[#B45309]' : 'px-3 py-2 font-medium text-[var(--text-primary)]'}>
                                {row.flag && <AlertTriangle size={11} className="mr-1 inline text-[#D97706]" />}
                                {row.rewashed && <RotateCw size={11} className="mr-1 inline text-[#16A34A]" />}
                                {row.name}
                                {row.rewashed && (
                                    <span className="ml-1.5 rounded-full bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-semibold text-[#15803D]">
                                        re-wash
                                    </span>
                                )}
                            </td>
                            {rows.some(r => r.spec) && <td className="px-2 py-2 text-[var(--text-muted)]">{row.spec || '—'}</td>}
                            <td className="px-3 py-2 text-right text-[var(--text-secondary)]">{row.a}</td>
                            {bLabel && <td className="px-3 py-2 text-right font-semibold text-[var(--text-primary)]">{row.b}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}