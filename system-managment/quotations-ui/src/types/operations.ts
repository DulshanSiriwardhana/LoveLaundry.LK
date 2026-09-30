// ── Verification ─────────────────────────────────────────────────────────────
export interface Verification {
    status: 'VERIFIED' | 'SYNCING' | 'PENDING' | 'FAILED'
    verified: boolean
    last_verified_at?: string | null
    main_version?: number
    secondary_version?: number
    error?: string | null
}

// ── Gate Pass ────────────────────────────────────────────────────────────────
export interface GatePassItem {
    item_name: string
    category?: string
    specification?: string
    client_qty: number
    received_qty: number
    difference: number
    mismatch_reason?: string
    mismatch_notes?: string
    rewashed?: boolean
}

export interface GatePassMarkDelivered {
    note: string
    delivered_date?: string
}

export interface MarkedDeliveredInfo {
    note: string
    delivered_date?: string
    user_id?: string
    at?: string
}

export interface GatePass {
    id: string
    gate_pass_number: string
    client_name: string
    receiving_date: string
    received_by: string
    items: GatePassItem[]
    status: 'RECEIVED' | 'PROCESSING' | 'READY_FOR_DELIVERY' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED'
    notes?: string
    adjustments?: object[]
    quotation_id?: string
    marked_delivered?: MarkedDeliveredInfo | null
    created_at: string
    updated_at: string
    verification?: Verification
}

export interface GatePassCreate {
    gate_pass_number: string
    client_name: string
    receiving_date: string
    received_by: string
    items: GatePassItem[]
    notes?: string
    quotation_id?: string
}

// ── Delivery ─────────────────────────────────────────────────────────────────

/**
 * One line of a delivery.
 *
 * `gate_pass_id` is REQUIRED on a line. A delivery may draw items from several
 * gate passes, so the source of every single line must be explicit — the
 * browser never infers it from the delivery. On a stored (read) line the
 * server has already resolved it, including for legacy records that predate
 * per-line attribution, so it is always present on the way back.
 */
export interface DeliveryItem {
    item_name: string
    specification?: string
    quantity: number
    gate_pass_id?: string
    /** What the hotel's own count said, when it differs from our record. */
    client_counted_qty?: number | null
    /** Server-computed: our record minus the hotel's count. */
    discrepancy?: number
    mismatch_reason?: string | null
    mismatch_notes?: string | null
}

/** One applied quantity correction, as returned by the server. */
export interface DeliveryCorrectionChange {
    gate_pass_id: string
    item_name: string
    specification: string
    original_quantity: number
    corrected_quantity: number
    delta: number
}

export interface DeliveryCorrectionRecord {
    corrected_at: string
    corrected_by: string
    corrected_by_id?: string
    reason: string
    changes: DeliveryCorrectionChange[]
}

export interface Delivery {
    id: string
    /**
     * Primary / legacy single source. Prefer `source_gate_pass_ids` (or a
     * line's own `gate_pass_id`) — a delivery can span several passes.
     */
    gate_pass_id: string
    /** Every gate pass this delivery draws from. */
    source_gate_pass_ids: string[]
    client_name: string
    delivery_date: string
    delivered_by: string
    received_by: string
    items: DeliveryItem[]
    status: string
    notes?: string
    /** Full correction history — the original quantities are never destroyed. */
    corrections?: DeliveryCorrectionRecord[]
    /**
     * Server-computed balance of every gate pass this delivery touched.
     * Populated by the list endpoint so the table never re-derives progress.
     */
    source_gate_passes?: Array<{
        gate_pass_id: string
        gate_pass_number?: string
        client_name?: string
        status?: string
        derived_status?: string
        totals: GatePassBalanceResponse['totals']
    }>
    cancelled_at?: string
    cancelled_by?: string
    cancelled_reason?: string
    created_at: string
    updated_at?: string
    verification?: Verification
}

export interface DeliveryCreate {
    /** Fallback source for lines that omit their own `gate_pass_id`. */
    gate_pass_id?: string
    client_name: string
    delivery_date: string
    delivered_by: string
    received_by: string
    items: DeliveryItem[]
    notes?: string
}

/** One line's corrected quantity. Quantity 0 removes the line. */
export interface DeliveryItemCorrection {
    item_name: string
    specification?: string
    gate_pass_id?: string
    quantity: number
}

export interface DeliveryCorrection {
    items: DeliveryItemCorrection[]
    reason: string
    notes?: string
}

export interface DeliveryCancel {
    reason: string
}

// ── Server-computed balances ─────────────────────────────────────────────────

/**
 * A single line of what is still deliverable, as the server sees it.
 *
 * The browser must never re-derive any of these numbers: every balance in the
 * app is rendered from the server so two screens can never disagree.
 */
export interface AvailabilityItem {
    item_name: string
    specification: string
    category?: string
    expected_qty: number
    received_qty: number
    delivered_qty: number
    returned_qty: number
    available_qty: number
    rewashed?: boolean
    flags: string[]
}

export interface AvailabilityGatePass {
    gate_pass_id: string
    gate_pass_number: string
    client_name: string
    receiving_date: string
    status: string
    derived_status: string
    total_received_qty: number
    total_delivered_qty: number
    total_available_qty: number
    items: AvailabilityItem[]
    deliverable_items: AvailabilityItem[]
}

export interface AvailabilityResponse {
    client_name?: string
    gate_passes: AvailabilityGatePass[]
    total_available_qty: number
}

/** Canonical balance for one gate pass. */
export interface GatePassBalanceItem {
    item_key: string
    item_name: string
    specification: string
    category: string
    rewashed: boolean
    expected_qty: number
    received_qty: number
    delivered_qty: number
    effective_delivered_qty: number
    returned_back_qty: number
    outstanding_delivery_qty: number
    not_received_qty: number
    extra_received_qty: number
    client_counted_qty: number | null
    discrepancy_qty: number
    has_count: boolean
    flags: string[]
}

export interface GatePassBalanceResponse {
    gate_pass_id: string
    gate_pass_number?: string
    client_name?: string
    receiving_date?: string
    status?: string
    derived_status?: string
    /** True when the stored status lags the derived one; trust `derived_status`. */
    status_stale?: boolean
    marked_delivered?: boolean
    items: GatePassBalanceItem[]
    totals: {
        expected_qty: number
        received_qty: number
        delivered_qty: number
        effective_delivered_qty: number
        returned_back_qty: number
        outstanding_delivery_qty: number
        not_received_qty: number
        client_counted_qty: number
        discrepancy_qty: number
    }
    flags: string[]
}

/** A delivery plus the resulting balance of every gate pass it touched. */
export interface DeliveryBalanceResponse {
    delivery: Delivery
    original_items: DeliveryItem[]
    corrections: DeliveryCorrectionRecord[]
    source_gate_passes: Array<{
        gate_pass_id: string
        gate_pass_number?: string
        client_name?: string
        receiving_date?: string
        status?: string
        derived_status?: string
        items: GatePassBalanceItem[]
        totals: GatePassBalanceResponse['totals']
        flags: string[]
    }>
}

/** Every delivery that drew lines from one gate pass. */
export interface GatePassDeliveryRef {
    id: string
    delivery_date?: string
    status?: string
    delivered_by?: string
    /** Only the lines of this delivery that came from THIS gate pass. */
    items: DeliveryItem[]
}

export interface GatePassDeliveriesResponse {
    gate_pass_id: string
    gate_pass_number?: string
    deliveries: Delivery[]
    /** Per-item effect of those deliveries on this pass alone. */
    per_gate_pass?: Array<{
        gate_pass_id: string
        gate_pass_number?: string
        client_name?: string
        status?: string
        derived_status?: string
        items: GatePassBalanceItem[]
        totals: GatePassBalanceResponse['totals']
        flags: string[]
    }>
}

// ── Dispatch (pickup / delivery scheduling) ────────────────────────────────────
export type DispatchStatus =
    | 'SCHEDULED'
    | 'ASSIGNED'
    | 'EN_ROUTE'
    | 'COMPLETED'
    | 'CANCELLED'

export interface DispatchJob {
    id: string
    job_type: 'pickup' | 'delivery'
    order_id?: string | null
    client_name: string
    address?: string | null
    contact_name?: string | null
    contact_phone?: string | null
    scheduled_at?: string | null
    status: DispatchStatus
    assigned_to?: string | null
    latitude?: number | null
    longitude?: number | null
    notes?: string | null
    created_at: string
    updated_at: string
}

export interface DispatchCreate {
    job_type?: 'pickup' | 'delivery'
    order_id?: string
    client_name: string
    address?: string
    contact_name?: string
    contact_phone?: string
    scheduled_at?: string
    assigned_to?: string
    latitude?: number
    longitude?: number
    notes?: string
}

export interface RoutePlan {
    order: string[]
    stops: DispatchJob[]
}

// ── Loyalty ──────────────────────────────────────────────────────────────────
export interface LoyaltyAccount {
    id: string
    client_name: string
    points: number
    tier: string
    visits: number
    created_at: string
    updated_at: string
}

export interface LoyaltyAdjust {
    client_name: string
    delta_points: number
    reason?: string
}

export interface DispatchUpdate {
    status?: DispatchStatus
    assigned_to?: string
    scheduled_at?: string
    notes?: string
}

// ── Payment ───────────────────────────────────────────────────────────────────
export interface Payment {
    id: string
    bill_id: string
    client_name: string
    amount: number
    payment_method: string
    payment_date: string
    reference?: string
    notes?: string
    created_at: string
    verification?: Verification
}

export interface PaymentCreate {
    amount: number
    payment_method: string
    payment_date: string
    reference?: string
    notes?: string
}

// ── Dashboard / Reports ───────────────────────────────────────────────────────
export interface ClientSummaryStats {
    total_gate_passes: number
    total_items_received: number
    total_items_delivered: number
    pending_items: number
    open_mismatches: number
    pending_bills: number
    total_billed: number
    total_paid: number
    outstanding_amount: number
    total_shop_bills: number
    total_shop_billed: number
    total_shop_paid: number
    shop_outstanding: number
    pending_shop_bills: number
}

export interface ClientSummary {
    stats: ClientSummaryStats
    gatepasses: GatePass[]
    deliveries: Delivery[]
    mismatches: object[]
    pending_balances: { item_name: string; received: number; delivered: number; pending: number }[]
    bills: object[]
    payments: Payment[]
    shop_bills: object[]
}

// ── Returns ─────────────────────────────────────────────────────────────────
export interface ReturnItem {
    item_name: string
    specification?: string
    returned_qty: number
    reason: 'WRONG_ITEM' | 'DAMAGED' | 'MISSING' | 'OTHER'
    condition: 'GOOD' | 'DAMAGED' | 'STAINED' | 'LOST'
    action: 'RECEIVE_BACK' | 'RE_WASH' | 'DISCARD' | 'COMPENSATE'
    notes?: string
    resend_status?: 'PENDING' | 'SENT'
    resent_at?: string
}

export interface BillAdjustment {
    adjustment_type: 'NONE' | 'QUANTITY_REDUCE' | 'AMOUNT_REDUCE' | 'COMPENSATE'
    amount: number
    notes?: string
}

export interface Return {
    _id?: string
    return_id: string
    gate_pass_id: string
    delivery_id?: string
    client_name: string
    items: ReturnItem[]
    bill_adjustment?: BillAdjustment
    status: 'PENDING' | 'RECEIVED' | 'PROCESSED'
    recorded_by?: string
    notes?: string
    created_at: string
    updated_at: string
}

export interface ReturnCreate {
    gate_pass_id: string
    delivery_id?: string
    client_name: string
    items: ReturnItem[]
    bill_adjustment?: BillAdjustment
    notes?: string
}

/** Per-hotel linen flow. Every quantity here is computed by the server. */
export interface LinenFlowResponse {
    period: string
    hotels: Array<{
        client_name: string
        totals: {
            received_qty: number
            delivered_qty: number
            outstanding_delivery_qty: number
        }
        gate_passes: Array<{
            gate_pass_id: string
            gate_pass_number?: string
            receiving_date?: string
            status?: string
            derived_status?: string
            marked_delivered?: boolean
            totals: GatePassBalanceResponse['totals']
            outstanding_items: Array<{
                item_key: string
                item_name: string
                specification?: string
                received_qty: number
                delivered_qty: number
                returned_back_qty: number
                outstanding_delivery_qty: number
            }>
        }>
        /** Deliveries in the window with no matching gate pass in it. */
        unlinked_deliveries?: Array<{
            delivery_id: string
            delivery_date?: string
            pieces: number
        }>
    }>
    totals: {
        received_qty: number
        delivered_qty: number
        outstanding_delivery_qty: number
    }
}
