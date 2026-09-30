import type { Quotation } from './quotation'

export type NotificationType = 'gatepass_pending' | 'quotation_accepted' | 'quotation_delivered'

export interface GatePassPendingEntry {
  gate_pass_id: string
  gate_pass_number: string
  client_name: string
  item_name: string
  /** Lets the close-day screen scope outstanding quantity to a day. */
  receiving_date?: string
  /** Server-computed. The browser must not re-derive any of these. */
  received: number
  delivered: number
  pending: number
  specification?: string | null
  item_key?: string
  returned?: number
  status?: string
}

export interface NotificationSummary {
  pending_pieces: number
  pending_items: number
  pending_gate_passes: number
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  count: number
  route: string
  gatePassItems?: GatePassPendingEntry[]
  quotations?: Quotation[]
}
