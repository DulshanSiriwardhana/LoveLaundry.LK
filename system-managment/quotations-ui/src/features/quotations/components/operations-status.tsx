import type { Delivery } from '../../../types/operations'

export interface StatusStyle {
    label: string
    bg: string
    text: string
    border: string
    dot: string
}

export const GATE_PASS_STATUSES: Record<string, StatusStyle> = {
    RECEIVED: { label: 'Received', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', dot: '#3B82F6' },
    PROCESSING: { label: 'Processing', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#F97316' },
    READY_FOR_DELIVERY: { label: 'Ready', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', dot: '#22C55E' },
    PARTIALLY_DELIVERED: { label: 'Partial', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', dot: '#F59E0B' },
    DELIVERED: { label: 'Delivered', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', dot: '#16A34A' },
    CANCELLED: { label: 'Cancelled', bg: '#F9FAFB', text: '#6B7280', border: '#E4E7EC', dot: '#9CA3AF' },
}

export type DeliveryStatus = 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'READY' | 'IN_PROGRESS' | 'PENDING' | 'CANCELLED'

export const DELIVERY_STATUSES: Record<DeliveryStatus, StatusStyle> = {
    DELIVERED: { label: 'Delivered', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', dot: '#16A34A' },
    PARTIALLY_DELIVERED: { label: 'Partial', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', dot: '#F59E0B' },
    READY: { label: 'Ready', bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', dot: '#22C55E' },
    IN_PROGRESS: { label: 'In Progress', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', dot: '#F97316' },
    PENDING: { label: 'Pending', bg: '#F9FAFB', text: '#667085', border: '#E4E7EC', dot: '#98A2B3' },
    CANCELLED: { label: 'Cancelled', bg: '#F9FAFB', text: '#6B7280', border: '#E4E7EC', dot: '#9CA3AF' },
}

export const DELIVERY_STATUS_ORDER: DeliveryStatus[] = [
    'DELIVERED',
    'PARTIALLY_DELIVERED',
    'READY',
    'IN_PROGRESS',
    'PENDING',
    'CANCELLED',
]

/**
 * A delivery's status, derived from the state of EVERY gate pass it drew from.
 *
 * Previously this looked at a single gate pass (the delivery's own
 * `gate_pass_id`), so a delivery that returned 2 pieces from one pass and 30
 * from another inherited one pass's status wholesale — showing "delivered" while
 * most of the linen was still outstanding, or vice versa. A delivery is only
 * fully delivered when all of its origin passes are.
 *
 * Accepts either the server-supplied per-pass summaries (preferred) or a
 * single gate pass, for callers that only have one.
 */
export function deriveDeliveryStatus(
    delivery: Delivery,
    sourcePasses?: Array<{ derived_status?: string; status?: string }>,
): DeliveryStatus {
    const raw = (delivery.status || '').toUpperCase()
    if (raw === 'CANCELLED') return 'CANCELLED'
    if (raw === 'DELIVERED' && !sourcePasses?.length) return 'DELIVERED'
    if (!sourcePasses?.length) return 'PENDING'

    // Worst-case wins: the delivery is only as complete as its least-complete
    // origin pass.
    const rank: Record<string, number> = {
        DELIVERED: 0,
        PARTIALLY_DELIVERED: 1,
        READY_FOR_DELIVERY: 2,
        PROCESSING: 3,
        RECEIVED: 4,
        CANCELLED: 5,
    }
    let worst = 'DELIVERED'
    for (const p of sourcePasses) {
        const status = (p.derived_status || p.status || '').toUpperCase()
        if (status === 'CANCELLED') continue
        if (rank[status] === undefined) continue
        if (rank[status] > rank[worst]) worst = status
    }
    switch (worst) {
        case 'DELIVERED':
            return 'DELIVERED'
        case 'PARTIALLY_DELIVERED':
            return 'PARTIALLY_DELIVERED'
        case 'READY_FOR_DELIVERY':
            return 'READY'
        case 'PROCESSING':
            return 'IN_PROGRESS'
        default:
            return 'PENDING'
    }
}

export function StatusPill({ label, bg, text, border, dot }: StatusStyle) {
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
            style={{ background: bg, color: text, borderColor: border }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
            {label}
        </span>
    )
}

export function GatePassStatusPill({ status }: { status: string }) {
    const cfg = GATE_PASS_STATUSES[status] ?? GATE_PASS_STATUSES.RECEIVED
    return <StatusPill {...cfg} />
}

export function DeliveryStatusPill({ status }: { status: DeliveryStatus }) {
    const cfg = DELIVERY_STATUSES[status]
    return <StatusPill {...cfg} />
}