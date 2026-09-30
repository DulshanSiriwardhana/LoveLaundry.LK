import billsApi from '../../../api/bills-api'
import type { ShopBill, ShopBillCreate, ShopBillListParams, ShopBillPayment, BillTemplate, BillTemplateCreate, LegacyInvoice, LegacyInvoiceCreate } from '../../../types/shop-bill'

export const shopBillService = {
  list: (params?: ShopBillListParams) =>
    billsApi.get<{ items: ShopBill[]; total: number }>('/shop-bills', { params }).then((r: any) => r.data),

  get: (id: string) =>
    billsApi.get<ShopBill>(`/shop-bills/${id}`).then((r: any) => r.data),

  create: (data: ShopBillCreate) =>
    billsApi.post<ShopBill>('/shop-bills', data).then((r: any) => r.data),

  update: (id: string, data: Record<string, any>) =>
    billsApi.patch<ShopBill>(`/shop-bills/${id}`, data).then((r: any) => r.data),

  recordPayment: (id: string, data: ShopBillPayment) =>
    billsApi.post<ShopBill>(`/shop-bills/${id}/record-payment`, data).then((r: any) => r.data),

  delete: (id: string) =>
    billsApi.delete(`/shop-bills/${id}`).then((r: any) => r.data),

  // Feature 1: Duplicate
  duplicate: (id: string) =>
    billsApi.post<ShopBill>(`/shop-bills/${id}/duplicate`).then((r: any) => r.data),

  // Feature 2: Notes History
  getNotesHistory: (id: string) =>
    billsApi.get<{ notes_history: any[] }>(`/shop-bills/${id}/notes-history`).then((r: any) => r.data),

  // Feature 3: Bulk Status
  bulkStatus: (billIds: string[], status: string) =>
    billsApi.post<{ updated: number }>('/shop-bills/bulk-status', { bill_ids: billIds, status }).then((r: any) => r.data),

  // Feature 4: Templates
  listTemplates: (search?: string) =>
    billsApi.get<{ items: BillTemplate[]; total: number }>('/shop-bills/templates', { params: { search } }).then((r: any) => r.data),

  getTemplate: (id: string) =>
    billsApi.get<BillTemplate>(`/shop-bills/templates/${id}`).then((r: any) => r.data),

  createTemplate: (data: BillTemplateCreate) =>
    billsApi.post<BillTemplate>('/shop-bills/templates', data).then((r: any) => r.data),

  deleteTemplate: (id: string) =>
    billsApi.delete(`/shop-bills/templates/${id}`).then((r: any) => r.data),

  // Feature 5: Quick Bill
  quickBill: (clientName: string, templateId?: string) =>
    billsApi.post<ShopBill>('/shop-bills/quick-bill', { client_name: clientName, template_id: templateId }).then((r: any) => r.data),

  // Feature 5b: Manual Bill
  manualBill: (clientName: string, amount: number, date?: string, notes?: string) =>
    billsApi.post<ShopBill>('/shop-bills/manual-bill', { client_name: clientName, amount, date, notes }).then((r: any) => r.data),

  // Legacy invoices (manually-entered, must always be persisted)
  createLegacyInvoice: (data: LegacyInvoiceCreate) =>
    billsApi.post<LegacyInvoice>('/shop-bills/legacy', data).then((r: any) => r.data),

  listLegacyInvoices: (params?: { skip?: number; limit?: number; search?: string }) =>
    billsApi.get<{ items: LegacyInvoice[]; total: number }>('/shop-bills/legacy', { params }).then((r: any) => r.data),

  getLegacyInvoice: (id: string) =>
    billsApi.get<LegacyInvoice>(`/shop-bills/legacy/${id}`).then((r: any) => r.data),

  deleteLegacyInvoice: (id: string) =>
    billsApi.delete(`/shop-bills/legacy/${id}`).then((r: any) => r.data),

  // Feature 6: Split
  split: (billId: string, itemIndices: number[]) =>
    billsApi.post<ShopBill>(`/shop-bills/${billId}/split-bill`, { item_indices: itemIndices }).then((r: any) => r.data),

  // Feature 7: Merge (first id is the base bill; backend route is bill-scoped)
  merge: (billIds: string[]) =>
    billsApi.post<ShopBill>(`/shop-bills/${billIds[0]}/merge-bills`, { bill_ids: billIds }).then((r: any) => r.data),

  // Feature 8: Recurring
  makeRecurring: (billId: string, interval: string, endDate?: string) =>
    billsApi.post<ShopBill>(`/shop-bills/${billId}/make-recurring`, null, { params: { interval, end_date: endDate } }).then((r: any) => r.data),

  getRecurringDue: () =>
    billsApi.get<{ items: any[]; total: number }>('/shop-bills/recurring/due').then((r: any) => r.data),

  // Feature 9: Expiry
  getExpiring: (days: number = 7) =>
    billsApi.get<{ items: ShopBill[]; total: number }>('/shop-bills/expiring', { params: { days } }).then((r: any) => r.data),

  expireOld: (maxDays: number = 30) =>
    billsApi.post<{ expired: number }>('/shop-bills/expire-old', null, { params: { max_days: maxDays } }).then((r: any) => r.data),

  // Feature 11: Dashboard Summary
  getDashboardSummary: (days: number = 30) =>
    billsApi.get('/shop-bills/dashboard/summary', { params: { days } }).then((r: any) => r.data),

  // Feature 12: Export CSV
  exportCsv: (params?: { status?: string; payment_status?: string; client_name?: string }) =>
    billsApi.get('/shop-bills/export/csv', { params, responseType: 'blob' }).then((r: any) => r.data),

  // Feature 13: Client Statement
  getClientStatement: (clientName: string) =>
    billsApi.get(`/shop-bills/clients/${encodeURIComponent(clientName)}/statement`).then((r: any) => r.data),

  // Feature 14: Revenue Report
  getRevenueReport: (params?: { start_date?: string; end_date?: string; group_by?: string }) =>
    billsApi.get('/shop-bills/stats/revenue', { params }).then((r: any) => r.data),

  // Feature 15: Tax Report
  getTaxReport: (params?: { start_date?: string; end_date?: string }) =>
    billsApi.get('/shop-bills/reports/tax', { params }).then((r: any) => r.data),

  // Feature 16: Payment History
  getPaymentHistory: (billId: string) =>
    billsApi.get(`/shop-bills/${billId}/payment-history`).then((r: any) => r.data),

  // Feature 17: Overdue Bills
  getOverdue: (days: number = 30) =>
    billsApi.get('/shop-bills/overdue', { params: { days } }).then((r: any) => r.data),

  // Feature 18: Status Counts
  getStatusCounts: () =>
    billsApi.get('/shop-bills/stats/by-status').then((r: any) => r.data),

  // Feature 19: Client Summary
  getClientSummary: (limit: number = 20) =>
    billsApi.get('/shop-bills/stats/by-client', { params: { limit } }).then((r: any) => r.data),

  // Feature 20: Payment Summary
  getPaymentSummary: () =>
    billsApi.get('/shop-bills/stats/payment-summary').then((r: any) => r.data),

  // Feature 21: Audit Trail
  getAuditTrail: (billId?: string, limit: number = 50) =>
    billsApi.get(`/shop-bills/audit-trail/${billId ?? ''}`, { params: { limit } }).then((r: any) => r.data),

  // Feature 22: Client Search
  searchClients: (q: string) =>
    billsApi.get('/shop-bills/clients/search', { params: { q } }).then((r: any) => r.data),

  // Feature 23: Date Range Stats
  getDateRangeStats: (startDate: string, endDate: string) =>
    billsApi.get('/shop-bills/stats/date-range', { params: { start_date: startDate, end_date: endDate } }).then((r: any) => r.data),

  // Feature 24: Export Selected
  exportSelected: (billIds: string[]) =>
    billsApi.post('/shop-bills/export/csv-selected', { bill_ids: billIds }, { responseType: 'blob' }).then((r: any) => r.data),

  // Feature 25: Bulk Mark Paid
  bulkMarkPaid: (billIds: string[]) =>
    billsApi.post('/shop-bills/bulk-mark-paid', { bill_ids: billIds }).then((r: any) => r.data),

  // Feature 26: Tag Summary
  getTagSummary: () =>
    billsApi.get('/shop-bills/stats/tag-summary').then((r: any) => r.data),

  // Feature 27: Top Items
  getTopItems: (limit: number = 20) =>
    billsApi.get('/shop-bills/stats/top-items', { params: { limit } }).then((r: any) => r.data),

  // Feature 28: Update Notes
  updateNotes: (billId: string, notes: string) =>
    billsApi.post(`/shop-bills/${billId}/notes`, { notes }).then((r: any) => r.data),

  // Feature 29: Recent Activity
  getRecentActivity: (limit: number = 20) =>
    billsApi.get('/shop-bills/recent-activity', { params: { limit } }).then((r: any) => r.data),

  // Feature 30: Collection Rate
  getCollectionRate: () =>
    billsApi.get('/shop-bills/stats/collection-rate').then((r: any) => r.data),

  // Feature 31: Monthly Trends
  getMonthlyTrends: (months: number = 12) =>
    billsApi.get('/shop-bills/stats/monthly-trends', { params: { months } }).then((r: any) => r.data),

  // Feature 32: Bill Timeline
  getTimeline: (billId: string) =>
    billsApi.get(`/shop-bills/${billId}/timeline`).then((r: any) => r.data),

  // Feature 33: Archive
  archive: (billId: string) =>
    billsApi.post(`/shop-bills/${billId}/archive`).then((r: any) => r.data),

  // Feature 34: Restore
  restore: (billId: string) =>
    billsApi.post(`/shop-bills/${billId}/restore`).then((r: any) => r.data),

  // Feature 35: Archived Bills
  listArchived: (skip: number = 0, limit: number = 50) =>
    billsApi.get('/shop-bills/archived', { params: { skip, limit } }).then((r: any) => r.data),

  // Feature 36: Compare
  compare: (billIds: string[]) =>
    billsApi.post('/shop-bills/diff', { bill_id_1: billIds[0], bill_id_2: billIds[1] }).then((r: any) => r.data),

  // Feature 37: Bulk Delete
  bulkDelete: (billIds: string[]) =>
    billsApi.post('/shop-bills/bulk-delete', { bill_ids: billIds }).then((r: any) => r.data),

  // Feature 38: Mark Delivered
  deliver: (billId: string) =>
    billsApi.post(`/shop-bills/${billId}/mark-delivered`).then((r: any) => r.data),

  // Feature 39: Add Tag
  addTag: (billId: string, tag: string) =>
    billsApi.post(`/shop-bills/${billId}/tag`, { tag }).then((r: any) => r.data),

  // Feature 40: Remove Tag
  removeTag: (billId: string, tag: string) =>
    billsApi.delete(`/shop-bills/${billId}/tag/${encodeURIComponent(tag)}`).then((r: any) => r.data),

  // Feature 41: Add Item
  addItem: (billId: string, item: any) =>
    billsApi.post(`/shop-bills/${billId}/item`, item).then((r: any) => r.data),

  // Feature 42: Remove Item
  removeItem: (billId: string, itemIndex: number) =>
    billsApi.delete(`/shop-bills/${billId}/item/${itemIndex}`).then((r: any) => r.data),

  // Feature 43: By Bill Number
  getByNumber: (billNumber: string) =>
    billsApi.get(`/shop-bills/by-number/${encodeURIComponent(billNumber)}`).then((r: any) => r.data),

  // Feature 44: Avg Value
  getAvgValue: (days: number = 30) =>
    billsApi.get('/shop-bills/stats/avg-value', { params: { days } }).then((r: any) => r.data),

  // Feature 45: Attention Needed
  getAttentionNeeded: () =>
    billsApi.get('/shop-bills/attention-needed').then((r: any) => r.data),

  // Feature 46: Transfer Client
  transferClient: (billId: string, clientName: string) =>
    billsApi.post(`/shop-bills/${billId}/transfer-client`, { client_name: clientName }).then((r: any) => r.data),

  // Feature 47: Change Delivery Date
  changeDeliveryDate: (billId: string, deliveryDate: string | null) =>
    billsApi.patch(`/shop-bills/${billId}/delivery-date`, { delivery_date: deliveryDate }).then((r: any) => r.data),

  // Feature 48: Void
  voidBill: (billId: string, reason: string) =>
    billsApi.post(`/shop-bills/${billId}/void`, { reason }).then((r: any) => r.data),

  // Feature 49: Count
  getCount: (status?: string, paymentStatus?: string) =>
    billsApi.get('/shop-bills/count', { params: { status, payment_status: paymentStatus } }).then((r: any) => r.data),

  // Feature 50: Update Discount
  updateDiscount: (billId: string, discount: number) =>
    billsApi.patch(`/shop-bills/${billId}/discount`, { discount }).then((r: any) => r.data),

  // Feature 51: Update Transport Fee
  updateTransportFee: (billId: string, fee: number) =>
    billsApi.patch(`/shop-bills/${billId}/transport-fee`, { transport_fee: fee }).then((r: any) => r.data),

  // Feature 52: Update Taxes
  updateTaxes: (billId: string, taxes: number) =>
    billsApi.patch(`/shop-bills/${billId}/taxes`, { taxes }).then((r: any) => r.data),

  // Feature 53: Update Item
  updateItem: (billId: string, itemIndex: number, data: Record<string, any>) =>
    billsApi.patch(`/shop-bills/${billId}/items/${itemIndex}`, data).then((r: any) => r.data),

  // Feature 54: Reorder Items
  reorderItems: (billId: string, order: number[]) =>
    billsApi.patch(`/shop-bills/${billId}/items/reorder`, { order }).then((r: any) => r.data),

  // Feature 55: Link Quotation
  linkQuotation: (billId: string, quotationId: string) =>
    billsApi.patch(`/shop-bills/${billId}/link-quotation`, { quotation_id: quotationId }).then((r: any) => r.data),

  // Feature 55b: Unlink Quotation
  unlinkQuotation: (billId: string) =>
    billsApi.delete(`/shop-bills/${billId}/link-quotation`).then((r: any) => r.data),

  // Feature 56: Bulk Status with Notes
  bulkStatusNotes: (billIds: string[], status: string, notes: string) =>
    billsApi.post('/shop-bills/bulk-status-notes', { bill_ids: billIds, status, notes }).then((r: any) => r.data),

  // Feature 57: Advanced Search
  advancedSearch: (query: string, filters?: Record<string, any>) =>
    billsApi.post('/shop-bills/search', { query, filters }).then((r: any) => r.data),

  // Feature 58: Duplicate Options
  duplicateWithOptions: (billId: string, options: { client_name?: string; keep_items?: boolean }) =>
    billsApi.post(`/shop-bills/${billId}/duplicate-options`, options).then((r: any) => r.data),

  // Feature 59: Fulltext Search
  fulltextSearch: (q: string) =>
    billsApi.post('/shop-bills/fulltext-search', { q }).then((r: any) => r.data),

  // Feature 60: Get All Tags
  getTags: () =>
    billsApi.get<{ tags: string[] }>('/shop-bills/tags').then((r: any) => r.data),

  // Feature 60b: Bills by Tag
  getBillsByTag: (tag: string) =>
    billsApi.get(`/shop-bills/by-tag/${encodeURIComponent(tag)}`).then((r: any) => r.data),

  // Feature 61: Notes with Category
  addNoteCategory: (billId: string, note: string, category: string) =>
    billsApi.post(`/shop-bills/${billId}/notes-category`, { note, category }).then((r: any) => r.data),

  // Feature 62: From Quotation
  createFromQuotation: (quotationId: string) =>
    billsApi.post(`/shop-bills/from-quotation/${quotationId}`).then((r: any) => r.data),

  // Feature 63: Daily Summary
  getDailySummary: (date?: string) =>
    billsApi.get('/shop-bills/stats/daily', { params: { date } }).then((r: any) => r.data),

  // Feature 64: Weekly Summary
  getWeeklySummary: () =>
    billsApi.get('/shop-bills/stats/weekly').then((r: any) => r.data),

  // Feature 65: Monthly Summary
  getMonthlySummary: (year?: number, month?: number) =>
    billsApi.get('/shop-bills/stats/monthly', { params: { year, month } }).then((r: any) => r.data),

  // Feature 66: Yearly Summary
  getYearlySummary: (year?: number) =>
    billsApi.get('/shop-bills/stats/yearly', { params: { year } }).then((r: any) => r.data),

  // Feature 67: Client Loyalty
  getClientLoyalty: (clientName: string) =>
    billsApi.get(`/shop-bills/client-loyalty/${encodeURIComponent(clientName)}`).then((r: any) => r.data),

  // Feature 68: Template Usage
  getTemplateUsage: (templateId: string) =>
    billsApi.get(`/shop-bills/templates/${templateId}/usage`).then((r: any) => r.data),

  // Feature 68b: Duplicate Template
  duplicateTemplate: (templateId: string) =>
    billsApi.post(`/shop-bills/templates/${templateId}/duplicate`).then((r: any) => r.data),

  // Feature 68c: Update Template
  updateTemplate: (templateId: string, data: Record<string, any>) =>
    billsApi.patch(`/shop-bills/templates/${templateId}`, data).then((r: any) => r.data),

  // Feature 69: Attachments
  addAttachment: (billId: string, data: { name: string; url: string }) =>
    billsApi.post(`/shop-bills/${billId}/attachments`, data).then((r: any) => r.data),

  getAttachments: (billId: string) =>
    billsApi.get(`/shop-bills/${billId}/attachments`).then((r: any) => r.data),

  deleteAttachment: (billId: string, index: number) =>
    billsApi.delete(`/shop-bills/${billId}/attachments/${index}`).then((r: any) => r.data),

  // Feature 70: Version History
  getVersions: (billId: string) =>
    billsApi.get(`/shop-bills/${billId}/versions`).then((r: any) => r.data),

  // Feature 71: Print Data
  getPrintData: (billId: string) =>
    billsApi.get(`/shop-bills/${billId}/print-data`).then((r: any) => r.data),

  // Feature 71b: Bulk Print
  getBulkPrintData: (billIds: string[]) =>
    billsApi.post('/shop-bills/bulk-print-data', { bill_ids: billIds }).then((r: any) => r.data),

  // Feature 72: Calculate Tax
  calculateTax: (subtotal: number, taxRate: number) =>
    billsApi.post('/shop-bills/calculate-tax', { subtotal, tax_rate: taxRate }).then((r: any) => r.data),

  // Feature 72b: Calculate Discount
  calculateDiscount: (subtotal: number, discount: number, discountType: string) =>
    billsApi.post('/shop-bills/calculate-discount', { subtotal, discount, discount_type: discountType }).then((r: any) => r.data),

  // Feature 73: Batch Create
  batchCreate: (bills: any[]) =>
    billsApi.post('/shop-bills/batch-create', { bills }).then((r: any) => r.data),

  // Feature 74: Lookup
  lookup: (q: string) =>
    billsApi.get('/shop-bills/lookup', { params: { q } }).then((r: any) => r.data),

  // Feature 75: Client Count
  getClientCount: (clientName: string) =>
    billsApi.get(`/shop-bills/client-count/${encodeURIComponent(clientName)}`).then((r: any) => r.data),

  // Feature 76: Bills Today
  getBillsToday: () =>
    billsApi.get('/shop-bills/today').then((r: any) => r.data),

  // Feature 76b: Bills This Week
  getBillsThisWeek: () =>
    billsApi.get('/shop-bills/this-week').then((r: any) => r.data),

  // Feature 76c: Bills This Month
  getBillsThisMonth: () =>
    billsApi.get('/shop-bills/this-month').then((r: any) => r.data),

  // Feature 77: Client Turnaround
  getClientTurnaround: () =>
    billsApi.get('/shop-bills/stats/client-turnaround').then((r: any) => r.data),

  // Feature 78: Payment Methods
  getPaymentMethods: () =>
    billsApi.get('/shop-bills/stats/payment-methods').then((r: any) => r.data),

  // Feature 79: Export JSON
  exportJson: (status?: string) =>
    billsApi.get('/shop-bills/export/json', { params: { status } }).then((r: any) => r.data),

  // Feature 80: Bill Diff
  billDiff: (billId1: string, billId2: string) =>
    billsApi.post('/shop-bills/diff', { bill_id_1: billId1, bill_id_2: billId2 }).then((r: any) => r.data),

  // Feature 81: Health Check
  healthCheck: () =>
    billsApi.get('/shop-bills/health').then((r: any) => r.data),

  // Feature 82: Schema Info
  getSchema: () =>
    billsApi.get('/shop-bills/schema').then((r: any) => r.data),

  // Feature 83: CSV by IDs
  exportCsvByIds: (billIds: string[]) =>
    billsApi.post('/shop-bills/export/csv-by-ids', { bill_ids: billIds }, { responseType: 'blob' }).then((r: any) => r.data),

  // Feature 84: Payment Projection
  getPaymentProjection: (days: number = 30) =>
    billsApi.get('/shop-bills/stats/payment-projection', { params: { days } }).then((r: any) => r.data),

  // Feature 85: Refund
  refund: (billId: string, amount: number, reason?: string) =>
    billsApi.post(`/shop-bills/${billId}/refund`, { amount, reason }).then((r: any) => r.data),

  // Feature 86: Credit Note
  creditNote: (billId: string, amount: number, reason: string) =>
    billsApi.post(`/shop-bills/${billId}/credit-note`, { amount, reason }).then((r: any) => r.data),

  // Feature 87: Bulk Update Items
  bulkUpdateItems: (billId: string, items: { index: number; unit_price?: number; quantity?: number; discount?: number }[]) =>
    billsApi.patch(`/shop-bills/${billId}/items/bulk-update`, { items }).then((r: any) => r.data),

  // Feature 88: Export Summary
  getExportSummary: () =>
    billsApi.get('/shop-bills/export/summary').then((r: any) => r.data),

  // Feature 89: API Info
  getApiInfo: () =>
    billsApi.get('/shop-bills/info').then((r: any) => r.data),

  // Feature 90: Recurring Due v2
  getRecurringDueV2: () =>
    billsApi.get('/shop-bills/recurring/due-v2').then((r: any) => r.data),
}
