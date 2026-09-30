import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Truck, Calendar, User, Package, Pencil, X, Check } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import { DATE_CORRECTION_REASONS } from '../../../lib/date-corrections'
import { useDelivery, useUpdateDeliveryDate } from '../hooks/useDeliveries'

export default function DeliveryDetailPage() {
    const { id } = useParams()
    const { data: delivery, isLoading, isError, error } = useDelivery(id)
    const updateDeliveryDate = useUpdateDeliveryDate()
    const [editingDate, setEditingDate] = useState(false)
    const [dateValue, setDateValue] = useState('')
    const [dateReason, setDateReason] = useState('')

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
        return <ErrorState description={error instanceof Error ? error.message : 'Unable to load delivery'} />
    }

    if (!delivery) {
        return <EmptyState title="Delivery not found" description="It may have been removed." />
    }

    // `items` is declared non-optional on the type, but the API can omit it
    // for a document with no lines — so normalise once instead of trusting it.
    const items = delivery.items ?? []
    const totalPieces = items.reduce((s: number, i: any) => s + i.quantity, 0)

    const startEditDate = () => {
        setDateValue((delivery.delivery_date || '').slice(0, 10))
        setDateReason('')
        setEditingDate(true)
    }

    const submitDate = () => {
        if (!id || !dateValue) return
        updateDeliveryDate.mutate(
            { id, delivery_date: dateValue, reason: dateReason },
            { onSuccess: () => setEditingDate(false) },
        )
    }

    return (
        <div className="space-y-5 pb-10">
            <div className="flex items-start gap-3">
                <Link to="/deliveries" className="mt-1 text-[#98A2B3] hover:text-[#374151] transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <Breadcrumb
                        items={[
                            { label: 'Dashboard', href: '/' },
                            { label: 'Deliveries', href: '/deliveries' },
                            { label: delivery.client_name },
                        ]}
                    />
                    <h1 className="text-dashboard-title mt-1">{delivery.client_name}</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">
                        Gate Pass: <span className="font-mono">{delivery.gate_pass_id}</span>
                    </p>
                </div>
            </div>

            {/* Info Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* Delivery date — editable to correct human error */}
                <Card className="p-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-[#98A2B3]" />
                            <p className="text-[11px] text-[#98A2B3] font-medium uppercase tracking-wide">Delivery Date</p>
                        </div>
                        {!editingDate && (
                            <button
                                onClick={startEditDate}
                                className="text-[#6B7280] hover:text-[#2563EB] transition"
                                title="Correct delivery date"
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
                                    disabled={!dateValue || !dateReason || updateDeliveryDate.isPending}
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
                        <p className="text-[13px] font-semibold text-[#101828]">{formatDate(delivery.delivery_date)}</p>
                    )}
                </Card>

                {[
                    { icon: User, label: 'Delivered By', value: delivery.delivered_by },
                    { icon: User, label: 'Received By', value: delivery.received_by },
                    { icon: Package, label: 'Total Pieces', value: `${totalPieces} pcs` },
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

            {delivery.notes && (
                <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] mb-1">Notes</p>
                    <p className="text-[13px] text-[#374151]">{delivery.notes}</p>
                </Card>
            )}

            {/* Items */}
            <Card>
                <CardHeader className="border-b border-[#F2F4F7] pb-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                            <Truck className="h-4 w-4 text-[#16A34A]" />
                        </div>
                        <CardTitle>Delivered Items</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="divide-y divide-[#F9FAFB]">
                        {items.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-3 py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] font-bold text-[12px]">
                                        {item.item_name.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="text-[13px] font-medium text-[#101828]">
                                        {item.item_name}
                                        {item.specification && (
                                            <span className="ml-2 inline-flex items-center rounded bg-[#FFF7ED] border border-[#FED7AA] px-1.5 py-0.5 text-[10px] font-semibold text-[#EA580C]">
                                                {item.specification}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <span className="text-[14px] font-semibold text-[#101828]">{item.quantity} pcs</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-[#E4E7EC] pt-3 mt-2 flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Total</span>
                        <span className="text-[15px] font-bold text-[#101828]">{totalPieces} pieces</span>
                    </div>
                </CardContent>
            </Card>

            {/* Link to Gate Pass */}
            <Card className="p-4 border-[#BFDBFE] bg-[#EFF6FF]">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-[12px] font-semibold text-[#2563EB] uppercase tracking-wide mb-0.5">Associated Gate Pass</p>
                        <p className="text-[13px] font-mono text-[#374151]">{delivery.gate_pass_id}</p>
                    </div>
                    <Link to={`/gate-passes/${delivery.gate_pass_id}`}>
                        <button className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition cursor-pointer">
                            View →
                        </button>
                    </Link>
                </div>
            </Card>
        </div>
    )
}
