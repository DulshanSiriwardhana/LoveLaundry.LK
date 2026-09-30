export interface ShopBillItem {
  item_name: string
  specification?: string
  category?: string
  unit_price: number
  quantity: number
  discount: number
  discount_type: 'FIXED' | 'PERCENT'
  line_total: number
}

export interface ShopBill {
  id: string
  bill_number: string
  client_name: string
  quotation_id?: string
  items: ShopBillItem[]
  total_quantity: number
  total_amount: number
  discounts: number
  transport_fee: number
  taxes: number
  grand_total: number
  status: 'PENDING' | 'PROCESSING' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'
  payment_status: 'DRAFT' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED'
  paid_amount: number
  outstanding_amount: number
  notes?: string
  notes_history?: { old_notes: string; new_notes: string; changed_by: string; changed_at: string }[]
  delivery_date?: string
  tags?: string[]
  locked: boolean
  is_recurring: boolean
  recurring_interval?: string
  recurring_end_date?: string
  parent_bill_id?: string
  created_at: string
  updated_at: string
}

export interface ShopBillCreate {
  bill_number?: string
  client_name: string
  quotation_id?: string
  items: Omit<ShopBillItem, 'line_total'>[]
  notes?: string
  delivery_date?: string
  discounts?: number
  transport_fee?: number
  taxes?: number
  tags?: string[]
  locked?: boolean
  is_recurring?: boolean
  recurring_interval?: string
  recurring_end_date?: string
}

export interface ShopBillListParams {
  client_name?: string
  status?: string
  payment_status?: string
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  skip?: number
  limit?: number
}

export interface ShopBillPayment {
  amount: number
  payment_method: string
  payment_date: string
  reference?: string
  notes?: string
}

export interface BillTemplate {
  id: string
  name: string
  client_name?: string
  items: ShopBillItem[]
  discounts: number
  transport_fee: number
  taxes: number
  notes?: string
  use_count: number
  created_at: string
  updated_at: string
}

export interface BillTemplateCreate {
  name: string
  client_name?: string
  items: Omit<ShopBillItem, 'line_total'>[]
  discounts?: number
  transport_fee?: number
  taxes?: number
  notes?: string
}

export interface LegacyInvoiceEntry {
  date?: string
  bill_number?: string
  amount: number
}

export interface LegacyInvoiceCreate {
  shop_name: string
  description?: string
  entries: LegacyInvoiceEntry[]
}

export interface LegacyInvoice {
  id: string
  invoice_number: string
  shop_name: string
  description?: string
  entries: LegacyInvoiceEntry[]
  total_entries: number
  grand_total: number
  created_at: string
}
