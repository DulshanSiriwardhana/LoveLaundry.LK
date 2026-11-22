import type { Delivery } from '../../../types/operations'

export interface StatusStyle {
    label: string
    bg: string
    text: string
    border: string
    dot: string
}

export const GATE_PASS_STATUSES: Record<string, StatusStyle> = {
    RECEIVED: { label: 'Received', bg: 'var(--surface)', text: 'var(--brand-text)', border: 'var(--brand-border)', dot: 'var(--brand-text)' },
    PROCESSING: { label: 'Processing', bg: 'var(--surface)', text: 'var(--danger-deep)', border: 'var(--danger-border)', dot: 'var(--danger-text)' },
    READY_FOR_DELIVERY: { label: 'Ready', bg: 'var(--surface)', text: 'var(--success-text)', border: 'var(--success-border)', dot: 'var(--success-text)' },
    PARTIALLY_DELIVERED: { label: 'Partial', bg: 'var(--surface)', text: 'var(--danger-text)', border: 'var(--danger-border)', dot: 'var(--danger-text)' },
    DELIVERED: { label: 'Delivered', bg: 'var(--surface)', text: 'var(--success-text)', border: 'var(--success-border)', dot: 'var(--success-text)' },
    CANCELLED: { label: 'Cancelled', bg: 'var(--surface)', text: 'var(--text-secondary)', border: 'var(--surface-2)', dot: 'var(--text-faint)' },
}

export type DeliveryStatus = 'DELIVERED' | 'PARTIALLY_DELIVERED' | 'READY' | 'IN_PROGRESS' | 'PENDING' | 'CANCELLED'

export const DELIVERY_STATUSES: Record<DeliveryStatus, StatusStyle> = {
    DELIVERED: { label: 'Delivered', bg: 'var(--surface)', text: 'var(--success-text)', border: 'var(--success-border)', dot: 'var(--success-text)' },
    PARTIALLY_DELIVERED: { label: 'Partial', bg: 'var(--surface)', text: 'var(--danger-text)', border: 'var(--danger-border)', dot: 'var(--danger-text)' },
    READY: { label: 'Ready', bg: 'var(--surface)', text: 'var(--success-text)', border: 'var(--success-border)', dot: 'var(--success-text)' },
    IN_PROGRESS: { label: 'In Progress', bg: 'var(--surface)', text: 'var(--danger-deep)', border: 'var(--danger-border)', dot: 'var(--danger-text)' },
    PENDING: { label: 'Pending', bg: 'var(--surface)', text: 'var(--brand-text)', border: 'var(--surface-2)', dot: 'var(--text-faint)' },
    CANCELLED: { label: 'Cancelled', bg: 'var(--surface)', text: 'var(--text-secondary)', border: 'var(--surface-2)', dot: 'var(--text-faint)' },
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