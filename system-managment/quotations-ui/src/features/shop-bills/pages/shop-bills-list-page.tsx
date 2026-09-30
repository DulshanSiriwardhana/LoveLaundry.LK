import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Receipt, X, ArrowUpDown, Zap, LayoutTemplate, Trash2 } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../../../components/ui/dialog'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { OfflineChangesChip, PendingSyncBadge } from '../../../components/ui/pending-sync-indicators'
import { useShopBills, useBulkUpdateShopBillStatus, useShopBillTemplates, useCreateBillTemplate, useDeleteBillTemplate, useQuickBill } from '../hooks/useShopBills'
import { formatCurrency } from '../../../lib/utils'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  DELIVERED: 'bg-purple-50 text-purple-700 border border-purple-200',
  COMPLETED: 'bg-green-50 text-green-700 border border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const PAYMENT_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-500 border border-gray-200',
  PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
  PARTIALLY_PAID: 'bg-orange-50 text-orange-700 border border-orange-200',
  PAID: 'bg-green-50 text-green-700 border border-green-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border border-gray-200',
}

const inputClass = 'h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition'

export default function ShopBillsListPage() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showTemplates, setShowTemplates] = useState(false)
  const [showQuickBill, setShowQuickBill] = useState(false)
  const [quickClientName, setQuickClientName] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDeleteId, setTemplateDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data, isLoading, isError, error } = useShopBills({
    search: search || undefined,
    status: statusFilter || undefined,
    payment_status: paymentFilter || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    limit: 100,
  })

  const bulkUpdate = useBulkUpdateShopBillStatus()
  const { data: templateData } = useShopBillTemplates()
  const createTemplate = useCreateBillTemplate()
  const deleteTemplate = useDeleteBillTemplate()
  const quickBill = useQuickBill()

  const bills = data?.items ?? []
  const templates = templateData?.items ?? []
  const hasFilters = Boolean(search || statusFilter || paymentFilter)

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
    setPaymentFilter('')
  }

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortOrder('desc') }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkStatus = (status: string) => {
    bulkUpdate.mutate({ ids: Array.from(selectedIds), status }, {
      onSuccess: () => setSelectedIds(new Set())
    })
  }

  const handleQuickBill = () => {
    if (!quickClientName.trim()) return
    quickBill.mutate({ clientName: quickClientName.trim() }, {
      onSuccess: (bill: any) => { setShowQuickBill(false); setQuickClientName(''); navigate(`/shop-bills/${bill.id}`) }
    })
  }

  const handleCreateTemplate = () => {
    if (!templateName.trim() || bills.length === 0) return
    const latest = bills[0]
    createTemplate.mutate({
      name: templateName.trim(),
      client_name: latest.client_name,
      items: latest.items.map((i: any) => ({
        item_name: i.item_name, specification: i.specification, category: i.category,
        unit_price: i.unit_price, quantity: i.quantity, discount: i.discount || 0, discount_type: i.discount_type || 'FIXED',
      })),
      discounts: latest.discounts, transport_fee: latest.transport_fee, taxes: latest.taxes,
    }, { onSuccess: () => setTemplateName('') })
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Shop Bills' }]} />
          <h1 className="text-dashboard-title mt-1">Shop Bills</h1>
          <p className="text-[13px] text-[#98A2B3] mt-0.5">{data ? `${data.total} bill${data.total === 1 ? '' : 's'}` : 'Shop bills'}</p>
          <OfflineChangesChip service="bills" resource="shop-bills" className="mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="gap-1.5 cursor-pointer"><LayoutTemplate size={14} /> Templates</Button>
          <Button variant="outline" size="sm" onClick={() => setShowQuickBill(true)} className="gap-1.5 cursor-pointer"><Zap size={14} /> Quick Bill</Button>
          <Link to="/shop-bills/new"><Button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white gap-2 cursor-pointer"><Plus size={16} /> New Bill</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by bill number or client…" className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-10 pr-9 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition" />
          {search && <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="h-10 rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] transition">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="DELIVERED">Delivered</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} aria-label="Filter by payment status" className="h-10 rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] transition">
          <option value="">All Payments</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
        </select>
        <button onClick={() => toggleSort('grand_total')} className="flex items-center gap-1 h-10 px-3 rounded-lg border border-[#E4E7EC] bg-white text-[13px] text-[#101828] hover:bg-gray-50 cursor-pointer">
          <ArrowUpDown size={14} /> Amount {sortBy === 'grand_total' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        {hasFilters && <button onClick={clearFilters} className="text-[12px] text-[#DC2626] hover:text-[#B91C1C] underline cursor-pointer">Clear filters</button>}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[#EFF4FF] border border-[#C7D7FE]">
          <span className="text-[13px] font-medium text-[#3538CD]">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            {['PENDING', 'PROCESSING', 'DELIVERED', 'COMPLETED', 'CANCELLED'].map(s => (
              <Button key={s} size="sm" variant="outline" onClick={() => handleBulkStatus(s)} disabled={bulkUpdate.isPending} className="text-[11px] cursor-pointer">{s}</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} aria-label="Clear selection" className="cursor-pointer"><X size={14} /></Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : isError ? (
        <ErrorState description={error instanceof Error ? error.message : 'Unable to load shop bills'} />
      ) : bills.length === 0 ? (
        <EmptyState title="No shop bills found" description={hasFilters ? 'Try adjusting your filters.' : 'Create your first shop bill to get started.'}
          action={!hasFilters ? <Link to="/shop-bills/new"><Button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white gap-2"><Plus size={16} /> New Shop Bill</Button></Link> : undefined} />
      ) : (
        <div className="space-y-2">
          {bills.map((bill: any) => (
            <div key={bill.id} className="flex items-center gap-2">
              <input type="checkbox" checked={selectedIds.has(bill.id)} onChange={() => toggleSelect(bill.id)} aria-label={`Select bill ${bill.bill_number}`} className="h-4 w-4 rounded border-[#E4E7EC] accent-[#DC2626] cursor-pointer shrink-0" />
              <Link to={`/shop-bills/${bill.id}`} className="flex-1">
                <Card className="flex items-center gap-4 p-4 hover:border-[#DC2626]/40 transition cursor-pointer">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA]">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[#101828]">{bill.bill_number}</p>
                      {bill.locked && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">LOCKED</span>}
                      {bill.is_recurring && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">RECURRING</span>}
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[bill.status] ?? 'bg-gray-100 text-gray-500'}`}>{bill.status}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${PAYMENT_COLORS[bill.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>{bill.payment_status.replaceAll('_', ' ')}</span>
                        <PendingSyncBadge service="bills" entityId={bill.id} />
                    </div>
                    <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{bill.client_name} &middot; {bill.items.length} item{bill.items.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-semibold text-[#101828]">{formatCurrency(bill.grand_total)}</p>
                    {bill.outstanding_amount > 0 && <p className="text-[11px] text-[#DC2626]">{formatCurrency(bill.outstanding_amount)} due</p>}
                  </div>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bill Templates</DialogTitle><DialogDescription>Save and reuse item combinations for quick billing.</DialogDescription></DialogHeader>
          <DialogBody>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" className={inputClass} />
                <Button size="sm" onClick={handleCreateTemplate} disabled={!templateName.trim() || createTemplate.isPending || bills.length === 0} className="bg-[#DC2626] text-white shrink-0 cursor-pointer">Save Latest</Button>
              </div>
              {templates.length === 0 ? (
                <p className="text-[13px] text-[#98A2B3] text-center py-4">No templates yet. Create one from an existing bill.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {templates.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E4E7EC] hover:bg-gray-50">
                      <LayoutTemplate size={16} className="text-[#6B7280] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#101828]">{t.name}</p>
                        <p className="text-[11px] text-[#6B7280]">{t.items.length} items &middot; Used {t.use_count}x</p>
                      </div>
                      <button onClick={() => setTemplateDeleteId(t.id)} className="p-1 text-[#98A2B3] hover:text-[#DC2626] cursor-pointer" aria-label={`Delete template ${t.name}`}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Quick Bill Dialog */}
      <Dialog open={showQuickBill} onOpenChange={setShowQuickBill}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] border border-[#FDE68A]"><Zap className="h-5 w-5 text-[#D97706]" /></div>
            <DialogTitle>Quick Bill</DialogTitle><DialogDescription>Create a bill instantly from a client's last order.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Client Name *</label>
              <input type="text" value={quickClientName} onChange={e => setQuickClientName(e.target.value)} placeholder="Enter client name" className={inputClass} autoFocus />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={handleQuickBill} disabled={!quickClientName.trim() || quickBill.isPending} className="w-full bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer">{quickBill.isPending ? 'Creating…' : 'Create Quick Bill'}</Button>
            <Button variant="secondary" onClick={() => setShowQuickBill(false)} className="w-full cursor-pointer">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirm */}
      <ConfirmDialog open={!!templateDeleteId} onCancel={() => setTemplateDeleteId(null)} onConfirm={() => { if (templateDeleteId) deleteTemplate.mutate(templateDeleteId, { onSuccess: () => setTemplateDeleteId(null) }) }} title="Delete Template" description="Are you sure you want to delete this template?" confirmLabel="Delete" variant="danger" />
    </div>
  )
}
