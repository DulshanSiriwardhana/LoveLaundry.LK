export interface BillItem {
  item_name: string
  category?: string
  unit_price: number
  quantity: number
  line_total: number
}

export interface Verification {
  status: 'VERIFIED' | 'SYNCING' | 'PENDING' | 'FAILED'
  verified: boolean
  last_verified_at?: string | null
  main_version?: number
  secondary_version?: number
  error?: string | null
}

export interface Bill {
  id: string
  quotation_id: string
  client_name: string
  quotation_title?: string
  items: BillItem[]
  total_quantity: number
  total_amount: number
  grand_total?: number
  discounts?: number
  transport_fee?: number
  taxes?: number
  additional_charges?: number
  paid_amount?: number
  outstanding_amount?: number
  status?: string
  payment_status?: 'DRAFT' | 'PENDING' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | string
  gate_pass_id?: string
  notes?: string
  created_at: string
  updated_at?: string
  verification?: Verification
}

export interface BillPayload {
  quotation_id: string
  client_name: string
  quotation_title?: string
  items: Array<{
    item_name: string
    category?: string
    unit_price: number
    quantity: number
  }>
  notes?: string
  instant?: boolean
  discounts?: number
  transport_fee?: number
  taxes?: number
  additional_charges?: number
  delivery_ids?: string[]
  gate_pass_id?: string
}

export interface BillListParams {
  search?: string
  client_name?: string
  quotation_id?: string
  payment_status?: string
  date_from?: string
  date_to?: string
  gate_pass_date_from?: string
  gate_pass_date_to?: string
  skip?: number
  limit?: number
}

export interface BillListResponse {
  items: Bill[]
  total: number
}

export interface UnbilledGatePassItem {
  item_name: string
  category?: string
  received_qty: number
  delivered_qty: number
  billed_qty: number
  unbilled_qty: number
}

export interface UnbilledGatePass {
  id: string
  gate_pass_number: string
  client_name: string
  receiving_date: string
  quotation_id?: string
  delivery_ids: string[]
  unbilled_items: UnbilledGatePassItem[]
  total_unbilled_qty: number
  rewashed_items?: { item_name: string; specification: string; received_qty: number }[]
  total_rewashed_qty?: number
}