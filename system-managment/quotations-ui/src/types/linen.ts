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
  IN_STOCK:    { label: 'In Stock',    color: 'var(--success-text)', bg: 'var(--success-soft)' },
  AT_CLIENT:   { label: 'At Client',   color: 'var(--brand-text)', bg: 'var(--brand-border)' },
  COLLECTED:   { label: 'Collected',   color: 'var(--brand-deep)', bg: 'var(--surface-2)' },
  AT_LAUNDRY:  { label: 'At Laundry',  color: 'var(--danger-text)', bg: 'var(--surface)' },
  WASHING:     { label: 'Washing',     color: 'var(--brand-text)', bg: 'var(--surface)' },
  DRYING:      { label: 'Drying',      color: 'var(--danger-text)', bg: 'var(--surface)' },
  PRESSING:    { label: 'Pressing',    color: 'var(--brand-deep)', bg: 'var(--surface-2)' },
  READY:       { label: 'Ready',       color: 'var(--success-text)', bg: 'var(--success-soft)' },
  DELIVERED:   { label: 'Delivered',   color: 'var(--success-text)', bg: 'var(--success-soft)' },
  MISSING:     { label: 'Missing',     color: 'var(--danger-deep)', bg: 'var(--surface-2)' },
  DAMAGED:     { label: 'Damaged',     color: 'var(--danger-deep)', bg: 'var(--surface-2)' },
  RETIRED:     { label: 'Retired',     color: 'var(--text-secondary)', bg: 'var(--surface)' },
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
  { value: 'collect', label: 'Collect', color: 'var(--brand-deep)' },
  { value: 'receive', label: 'Receive', color: 'var(--danger-text)' },
  { value: 'start_wash', label: 'Start Wash', color: 'var(--brand-text)' },
  { value: 'complete_wash', label: 'Complete Wash', color: 'var(--danger-text)' },
  { value: 'press', label: 'Press', color: 'var(--brand-deep)' },
  { value: 'ready', label: 'Ready', color: 'var(--success-text)' },
  { value: 'deliver', label: 'Deliver', color: 'var(--success-text)' },
  { value: 'mark_missing', label: 'Mark Missing', color: 'var(--danger-deep)' },
  { value: 'mark_damaged', label: 'Mark Damaged', color: 'var(--danger-deep)' },
  { value: 'retire', label: 'Retire', color: 'var(--text-secondary)' },
]
