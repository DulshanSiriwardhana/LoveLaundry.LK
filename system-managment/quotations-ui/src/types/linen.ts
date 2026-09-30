export type LinenStatus =
  | 'IN_STOCK' | 'AT_CLIENT' | 'COLLECTED' | 'AT_LAUNDRY'
  | 'WASHING' | 'DRYING' | 'PRESSING' | 'READY'
  | 'DELIVERED' | 'MISSING' | 'DAMAGED' | 'RETIRED'

export type LinenCategory =
  | 'BEDSHEET' | 'PILLOWCASE' | 'TOWEL' | 'DUVET_COVER'
  | 'BATH_MAT' | 'UNIFORM' | 'TABLECLOTH' | 'NAPKIN'
  | 'ROBE' | 'SLIPPER' | 'OTHER'

export type LinenCondition = 'NEW' | 'GOOD' | 'FAIR' | 'WORN' | 'DAMAGED'

export interface Linen {
  id: string
  linen_id: string
  category: string
  item_type: string
  description?: string
  size?: string
  color?: string
  client_name: string
  department?: string
  status: LinenStatus
  condition: LinenCondition
  location?: string
  wash_count: number
  last_washed_date?: string
  last_scanned_date?: string
  retirement_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface LinenEvent {
  id: string
  linen_id: string
  action: string
  from_status?: string
  to_status: string
  location?: string
  user?: string
  related_order?: string
  notes?: string
  timestamp: string
}

export interface LinenListResponse {
  items: Linen[]
  total: number
}

export interface LinenEventListResponse {
  items: LinenEvent[]
  total: number
}

export interface LinenStats {
  total: number
  in_stock: number
  at_client: number
  collected: number
  at_laundry: number
  washing: number
  drying: number
  pressing: number
  ready: number
  delivered: number
  missing: number
  damaged: number
  retired: number
  total_wash_cycles: number
  recently_scanned: number
}

export interface LinenListParams {
  search?: string
  category?: string
  status?: string
  client_name?: string
  condition?: string
  sort_by?: string
  sort_order?: string
  skip?: number
  limit?: number
}

export interface LinenBulkCreate {
  category: string
  item_type: string
  description?: string
  size?: string
  color?: string
  client_name: string
  department?: string
  quantity: number
  notes?: string
}

export interface LinenScanAction {
  action: string
  location?: string
  user?: string
  related_order?: string
  notes?: string
}

export interface LinenTagGenerate {
  category: string
  item_type: string
  client_name: string
  quantity: number
  size?: string
  color?: string
  department?: string
}

export const LINEN_STATUS_CONFIG: Record<LinenStatus, { label: string; color: string; bg: string }> = {
  IN_STOCK:    { label: 'In Stock',    color: '#16A34A', bg: '#DCFCE7' },
  AT_CLIENT:   { label: 'At Client',   color: '#2563EB', bg: '#DBEAFE' },
  COLLECTED:   { label: 'Collected',   color: '#9333EA', bg: '#F3E8FF' },
  AT_LAUNDRY:  { label: 'At Laundry',  color: '#EA580C', bg: '#FFF7ED' },
  WASHING:     { label: 'Washing',     color: '#0891B2', bg: '#ECFEFF' },
  DRYING:      { label: 'Drying',      color: '#D97706', bg: '#FFFBEB' },
  PRESSING:    { label: 'Pressing',    color: '#7C3AED', bg: '#EDE9FE' },
  READY:       { label: 'Ready',       color: '#16A34A', bg: '#DCFCE7' },
  DELIVERED:   { label: 'Delivered',   color: '#059669', bg: '#D1FAE5' },
  MISSING:     { label: 'Missing',     color: '#DC2626', bg: '#FEE2E2' },
  DAMAGED:     { label: 'Damaged',     color: '#DC2626', bg: '#FEE2E2' },
  RETIRED:     { label: 'Retired',     color: '#6B7280', bg: '#F3F4F6' },
}

export const LINEN_CATEGORIES: { value: string; label: string }[] = [
  { value: 'BEDSHEET', label: 'Bedsheet' },
  { value: 'PILLOWCASE', label: 'Pillowcase' },
  { value: 'TOWEL', label: 'Towel' },
  { value: 'DUVET_COVER', label: 'Duvet Cover' },
  { value: 'BATH_MAT', label: 'Bath Mat' },
  { value: 'UNIFORM', label: 'Uniform' },
  { value: 'TABLECLOTH', label: 'Tablecloth' },
  { value: 'NAPKIN', label: 'Napkin' },
  { value: 'ROBE', label: 'Robe' },
  { value: 'SLIPPER', label: 'Slipper' },
  { value: 'OTHER', label: 'Other' },
]

export const LINEN_CONDITIONS: { value: string; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'WORN', label: 'Worn' },
  { value: 'DAMAGED', label: 'Damaged' },
]

export const SCAN_ACTIONS: { value: string; label: string; color: string }[] = [
  { value: 'collect', label: 'Collect', color: '#9333EA' },
  { value: 'receive', label: 'Receive', color: '#EA580C' },
  { value: 'start_wash', label: 'Start Wash', color: '#0891B2' },
  { value: 'complete_wash', label: 'Complete Wash', color: '#D97706' },
  { value: 'press', label: 'Press', color: '#7C3AED' },
  { value: 'ready', label: 'Ready', color: '#16A34A' },
  { value: 'deliver', label: 'Deliver', color: '#059669' },
  { value: 'mark_missing', label: 'Mark Missing', color: '#DC2626' },
  { value: 'mark_damaged', label: 'Mark Damaged', color: '#DC2626' },
  { value: 'retire', label: 'Retire', color: '#6B7280' },
]
