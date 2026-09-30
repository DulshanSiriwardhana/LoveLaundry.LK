import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { shopBillService } from '../services/shop-bill.service'
import type { ShopBillCreate, ShopBillListParams, ShopBillPayment, BillTemplateCreate } from '../../../types/shop-bill'

export const shopBillKeys = {
  all: ['shop-bills'] as const,
  list: (params: ShopBillListParams) => [...shopBillKeys.all, 'list', params] as const,
  detail: (id: string) => [...shopBillKeys.all, id] as const,
  templates: ['shop-bill-templates'] as const,
  templateList: (search?: string) => [...shopBillKeys.templates, search] as const,
  templateDetail: (id: string) => [...shopBillKeys.templates, id] as const,
  recurringDue: ['shop-bills', 'recurring-due'] as const,
  expiring: (days: number) => ['shop-bills', 'expiring', days] as const,
}

export function useShopBills(params: ShopBillListParams = {}) {
  return useQuery({
    queryKey: shopBillKeys.list(params),
    queryFn: () => shopBillService.list(params),
  })
}

export function useShopBill(id?: string) {
  return useQuery({
    queryKey: shopBillKeys.detail(id ?? ''),
    queryFn: () => shopBillService.get(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateShopBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ShopBillCreate) => shopBillService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Shop bill created')
    },
    onError: () => toast.error('Failed to create shop bill'),
  })
}

export function useUpdateShopBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      shopBillService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Shop bill updated')
    },
    onError: () => toast.error('Failed to update shop bill'),
  })
}

export function useRecordShopBillPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ShopBillPayment }) =>
      shopBillService.recordPayment(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Payment recorded')
    },
    onError: () => toast.error('Failed to record payment'),
  })
}

export function useDeleteShopBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Shop bill deleted')
    },
    onError: () => toast.error('Failed to delete shop bill'),
  })
}

export function useDuplicateShopBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill duplicated')
    },
    onError: () => toast.error('Failed to duplicate bill'),
  })
}

export function useBulkUpdateShopBillStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      shopBillService.bulkStatus(ids, status),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success(`${data.updated} bill(s) updated`)
    },
    onError: () => toast.error('Failed to update bills'),
  })
}

export function useShopBillTemplates(search?: string) {
  return useQuery({
    queryKey: shopBillKeys.templateList(search),
    queryFn: () => shopBillService.listTemplates(search),
  })
}

export function useCreateBillTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: BillTemplateCreate) => shopBillService.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.templates })
      toast.success('Template created')
    },
    onError: () => toast.error('Failed to create template'),
  })
}

export function useDeleteBillTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => shopBillService.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.templates })
      toast.success('Template deleted')
    },
    onError: () => toast.error('Failed to delete template'),
  })
}

export function useQuickBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientName, templateId }: { clientName: string; templateId?: string }) =>
      shopBillService.quickBill(clientName, templateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Quick bill created')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || 'Failed to create quick bill'
      toast.error(msg)
    },
  })
}

export function useManualBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientName, amount, date, notes }: { clientName: string; amount: number; date?: string; notes?: string }) =>
      shopBillService.manualBill(clientName, amount, date, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill created')
    },
    onError: () => toast.error('Failed to create bill'),
  })
}

export function useSplitShopBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, itemIndices }: { billId: string; itemIndices: number[] }) =>
      shopBillService.split(billId, itemIndices),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill split successfully')
    },
    onError: () => toast.error('Failed to split bill'),
  })
}

export function useMergeShopBills() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billIds: string[]) => shopBillService.merge(billIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bills merged successfully')
    },
    onError: () => toast.error('Failed to merge bills'),
  })
}

export function useMakeRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, interval, endDate }: { billId: string; interval: string; endDate?: string }) =>
      shopBillService.makeRecurring(billId, interval, endDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Recurring schedule set')
    },
    onError: () => toast.error('Failed to set recurring'),
  })
}

export function useExpiringBills(days: number = 7) {
  return useQuery({
    queryKey: shopBillKeys.expiring(days),
    queryFn: () => shopBillService.getExpiring(days),
  })
}

// Feature 11: Dashboard Summary
export function useShopBillDashboard(days: number = 30) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'dashboard', days] as const,
    queryFn: () => shopBillService.getDashboardSummary(days),
  })
}

// Feature 13: Client Statement
export function useClientStatement(clientName: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'client-statement', clientName] as const,
    queryFn: () => shopBillService.getClientStatement(clientName),
    enabled: Boolean(clientName),
  })
}

// Feature 14: Revenue Report
export function useRevenueReport(params?: { start_date?: string; end_date?: string; group_by?: string }) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'revenue', params] as const,
    queryFn: () => shopBillService.getRevenueReport(params),
  })
}

// Feature 15: Tax Report
export function useTaxReport(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'tax', params] as const,
    queryFn: () => shopBillService.getTaxReport(params),
  })
}

// Feature 17: Overdue Bills
export function useOverdueBills(days: number = 30) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'overdue', days] as const,
    queryFn: () => shopBillService.getOverdue(days),
  })
}

// Feature 18-20: Stats
export function useStatusCounts() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'status-counts'] as const,
    queryFn: () => shopBillService.getStatusCounts(),
  })
}

export function useClientSummary(limit: number = 20) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'client-summary', limit] as const,
    queryFn: () => shopBillService.getClientSummary(limit),
  })
}

export function usePaymentSummary() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'payment-summary'] as const,
    queryFn: () => shopBillService.getPaymentSummary(),
  })
}

// Feature 21: Audit Trail
export function useAuditTrail(billId?: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'audit-trail', billId] as const,
    queryFn: () => shopBillService.getAuditTrail(billId),
  })
}

// Feature 22: Client Search
export function useClientSearch(q: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'client-search', q] as const,
    queryFn: () => shopBillService.searchClients(q),
    enabled: q.length >= 1,
  })
}

// Feature 25: Bulk Mark Paid
export function useBulkMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billIds: string[]) => shopBillService.bulkMarkPaid(billIds),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success(`${data.updated} bill(s) marked as paid`)
    },
    onError: () => toast.error('Failed to mark bills as paid'),
  })
}

// Feature 27: Top Items
export function useTopItems(limit: number = 20) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'top-items', limit] as const,
    queryFn: () => shopBillService.getTopItems(limit),
  })
}

// Feature 29: Recent Activity
export function useRecentActivity(limit: number = 20) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'recent-activity', limit] as const,
    queryFn: () => shopBillService.getRecentActivity(limit),
  })
}

// Feature 30: Collection Rate
export function useCollectionRate() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'collection-rate'] as const,
    queryFn: () => shopBillService.getCollectionRate(),
  })
}

// Feature 31: Monthly Trends
export function useMonthlyTrends(months: number = 12) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'monthly-trends', months] as const,
    queryFn: () => shopBillService.getMonthlyTrends(months),
  })
}

// Feature 32: Bill Timeline
export function useBillTimeline(billId?: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'timeline', billId] as const,
    queryFn: () => shopBillService.getTimeline(billId!),
    enabled: Boolean(billId),
  })
}

// Feature 33: Archive Bill
export function useArchiveBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) => shopBillService.archive(billId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill archived')
    },
    onError: () => toast.error('Failed to archive bill'),
  })
}

// Feature 34: Restore Bill
export function useRestoreBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) => shopBillService.restore(billId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill restored')
    },
    onError: () => toast.error('Failed to restore bill'),
  })
}

// Feature 37: Bulk Delete
export function useBulkDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billIds: string[]) => shopBillService.bulkDelete(billIds),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success(`${data.deleted} bill(s) deleted`)
    },
    onError: () => toast.error('Failed to delete bills'),
  })
}

// Feature 38: Mark Delivered
export function useMarkDelivered() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) => shopBillService.deliver(billId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill marked as delivered')
    },
    onError: () => toast.error('Failed to mark as delivered'),
  })
}

// Feature 45: Attention Needed
export function useAttentionNeeded() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'attention-needed'] as const,
    queryFn: () => shopBillService.getAttentionNeeded(),
  })
}

// Feature 48: Void Bill
export function useVoidBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, reason }: { billId: string; reason: string }) => shopBillService.voidBill(billId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shopBillKeys.all })
      toast.success('Bill voided')
    },
    onError: () => toast.error('Failed to void bill'),
  })
}

// Feature 51: Update Transport Fee
export function useUpdateTransportFee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, fee }: { billId: string; fee: number }) => shopBillService.updateTransportFee(billId, fee),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Transport fee updated') },
    onError: () => toast.error('Failed to update transport fee'),
  })
}

// Feature 52: Update Taxes
export function useUpdateTaxes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, taxes }: { billId: string; taxes: number }) => shopBillService.updateTaxes(billId, taxes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Taxes updated') },
    onError: () => toast.error('Failed to update taxes'),
  })
}

// Feature 53: Update Item
export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, itemIndex, data }: { billId: string; itemIndex: number; data: Record<string, any> }) =>
      shopBillService.updateItem(billId, itemIndex, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Item updated') },
    onError: () => toast.error('Failed to update item'),
  })
}

// Feature 54: Reorder Items
export function useReorderItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, order }: { billId: string; order: number[] }) => shopBillService.reorderItems(billId, order),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Items reordered') },
    onError: () => toast.error('Failed to reorder items'),
  })
}

// Feature 55: Link/Unlink Quotation
export function useLinkQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, quotationId }: { billId: string; quotationId: string }) =>
      shopBillService.linkQuotation(billId, quotationId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Quotation linked') },
    onError: () => toast.error('Failed to link quotation'),
  })
}

export function useUnlinkQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (billId: string) => shopBillService.unlinkQuotation(billId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Quotation unlinked') },
    onError: () => toast.error('Failed to unlink quotation'),
  })
}

// Feature 57: Advanced Search
export function useAdvancedSearch(query: string, filters?: Record<string, any>) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'search', query, filters] as const,
    queryFn: () => shopBillService.advancedSearch(query, filters),
    enabled: query.length >= 1,
  })
}

// Feature 59: Fulltext Search
export function useFulltextSearch(q: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'fulltext', q] as const,
    queryFn: () => shopBillService.fulltextSearch(q),
    enabled: q.length >= 2,
  })
}

// Feature 60: Tags
export function useShopBillTags() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'tags'] as const,
    queryFn: () => shopBillService.getTags(),
  })
}

// Feature 62: From Quotation
export function useCreateFromQuotation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (quotationId: string) => shopBillService.createFromQuotation(quotationId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Bill created from quotation') },
    onError: () => toast.error('Failed to create bill'),
  })
}

// Feature 63-66: Time Period Summaries
export function useDailySummary(date?: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'daily', date] as const,
    queryFn: () => shopBillService.getDailySummary(date),
  })
}

export function useWeeklySummary() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'weekly'] as const,
    queryFn: () => shopBillService.getWeeklySummary(),
  })
}

export function useMonthlySummary(year?: number, month?: number) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'monthly', year, month] as const,
    queryFn: () => shopBillService.getMonthlySummary(year, month),
  })
}

export function useYearlySummary(year?: number) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'yearly', year] as const,
    queryFn: () => shopBillService.getYearlySummary(year),
  })
}

// Feature 67: Client Loyalty
export function useClientLoyalty(clientName: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'loyalty', clientName] as const,
    queryFn: () => shopBillService.getClientLoyalty(clientName),
    enabled: Boolean(clientName),
  })
}

// Feature 69: Attachments
export function useAddAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, data }: { billId: string; data: { name: string; url: string } }) =>
      shopBillService.addAttachment(billId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Attachment added') },
    onError: () => toast.error('Failed to add attachment'),
  })
}

// Feature 73: Batch Create
export function useBatchCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bills: any[]) => shopBillService.batchCreate(bills),
    onSuccess: (data: any) => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success(`${data.created} bill(s) created`) },
    onError: () => toast.error('Failed to batch create'),
  })
}

// Feature 75: Client Count
export function useClientBillCount(clientName: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'client-count', clientName] as const,
    queryFn: () => shopBillService.getClientCount(clientName),
    enabled: Boolean(clientName),
  })
}

// Feature 76: Today/Week/Month
export function useBillsToday() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'today'] as const,
    queryFn: () => shopBillService.getBillsToday(),
  })
}

export function useBillsThisWeek() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'this-week'] as const,
    queryFn: () => shopBillService.getBillsThisWeek(),
  })
}

export function useBillsThisMonth() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'this-month'] as const,
    queryFn: () => shopBillService.getBillsThisMonth(),
  })
}

// Feature 77: Client Turnaround
export function useClientTurnaround() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'turnaround'] as const,
    queryFn: () => shopBillService.getClientTurnaround(),
  })
}

// Feature 80: Bill Diff
export function useBillDiff(billId1?: string, billId2?: string) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'diff', billId1, billId2] as const,
    queryFn: () => shopBillService.billDiff(billId1!, billId2!),
    enabled: Boolean(billId1 && billId2),
  })
}

// Feature 81: Health Check
export function useShopBillHealth() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'health'] as const,
    queryFn: () => shopBillService.healthCheck(),
    refetchInterval: 60000,
  })
}

// Feature 84: Payment Projection
export function usePaymentProjection(days: number = 30) {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'projection', days] as const,
    queryFn: () => shopBillService.getPaymentProjection(days),
  })
}

// Feature 85: Refund
export function useRefund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, amount, reason }: { billId: string; amount: number; reason?: string }) =>
      shopBillService.refund(billId, amount, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Refund processed') },
    onError: () => toast.error('Failed to process refund'),
  })
}

// Feature 86: Credit Note
export function useCreditNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ billId, amount, reason }: { billId: string; amount: number; reason: string }) =>
      shopBillService.creditNote(billId, amount, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: shopBillKeys.all }); toast.success('Credit note issued') },
    onError: () => toast.error('Failed to issue credit note'),
  })
}

// Feature 89: API Info
export function useShopBillApiInfo() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'info'] as const,
    queryFn: () => shopBillService.getApiInfo(),
    staleTime: Infinity,
  })
}

// Feature 90: Recurring Due v2
export function useRecurringDueV2() {
  return useQuery({
    queryKey: [...shopBillKeys.all, 'recurring-due-v2'] as const,
    queryFn: () => shopBillService.getRecurringDueV2(),
  })
}
