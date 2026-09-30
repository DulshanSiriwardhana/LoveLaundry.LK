import { useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Trash2, Banknote, Wallet, CheckCircle, Copy, Scissors, Lock, Unlock, Repeat, MessageSquare } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../../../components/ui/dialog'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { formatDate } from '../../../lib/utils'
import { useShopBill, useUpdateShopBill, useDeleteShopBill, useRecordShopBillPayment, useDuplicateShopBill, useSplitShopBill, useMakeRecurring } from '../hooks/useShopBills'
import { shopBillService } from '../services/shop-bill.service'
import { todayISO } from '../../../lib/time'

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

const fmt = (v: number) => `LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function RecordPaymentModal({ isOpen, onClose, billId, outstanding }: { isOpen: boolean; onClose: () => void; billId: string; outstanding: number }) {
  const recordPayment = useRecordShopBillPayment()
  const [amount, setAmount] = useState<number | ''>(outstanding)
  const [method, setMethod] = useState('Cash')
  const [date, setDate] = useState(() => todayISO())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const isValid = amount !== '' && amount > 0 && method && date

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    recordPayment.mutate(
      { id: billId, payload: { amount: Number(amount), payment_method: method, payment_date: date, reference, notes } },
      { onSuccess: () => { onClose(); setAmount(''); setReference(''); setNotes(''); setDate(todayISO()); setMethod('Cash'); } }
    )
  }

  const inputClass = 'h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#F0FDF4] border border-[#BBF7D0]">
              <Banknote className="h-5 w-5 text-[#16A34A]" />
            </div>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Submit a new payment record for this shop bill.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Amount (LKR)</label>
                <input type="number" min={0.01} step="0.01" required value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')} className={inputClass} aria-label="Payment amount" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Method</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className={inputClass} aria-label="Payment method">
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputClass} aria-label="Payment date" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Reference (Optional)</label>
                <input type="text" placeholder="Cheque # or TXN ID" value={reference} onChange={e => setReference(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Notes (Optional)</label>
                <input type="text" placeholder="Additional details..." value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white disabled:opacity-50 cursor-pointer" disabled={!isValid || recordPayment.isPending}>
              {recordPayment.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="w-full cursor-pointer">Cancel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SplitBillModal({ isOpen, onClose, bill, onSplit }: { isOpen: boolean; onClose: () => void; bill: any; onSplit: (indices: number[]) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] border border-[#FDE68A]">
            <Scissors className="h-5 w-5 text-[#D97706]" />
          </div>
          <DialogTitle>Split Bill</DialogTitle>
          <DialogDescription>Select items to move to a new bill.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {bill.items.map((item: any, idx: number) => (
              <label key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(idx)} onChange={() => toggle(idx)} className="h-4 w-4 accent-[#D97706]" aria-label={`Select ${item.item_name}`} />
                <span className="flex-1 text-[13px] text-[#101828]">{item.item_name} {item.specification ? `(${item.specification})` : ''}</span>
                <span className="text-[12px] text-[#6B7280]">x{item.quantity}</span>
              </label>
            ))}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => { onSplit(Array.from(selected)); onClose() }} disabled={selected.size === 0} className="w-full bg-[#D97706] hover:bg-[#B45309] text-white cursor-pointer">
            Split {selected.size} item(s) to New Bill
          </Button>
          <Button variant="secondary" onClick={onClose} className="w-full cursor-pointer">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NotesHistoryModal({ isOpen, onClose, notesHistory }: { isOpen: boolean; onClose: () => void; notesHistory: any[] }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes History</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {notesHistory.length === 0 ? (
            <p className="text-[13px] text-[#98A2B3] text-center py-4">No notes changes recorded.</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {notesHistory.slice().reverse().map((entry, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-[#E4E7EC]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-medium text-[#101828]">{entry.changed_by}</span>
                    <span className="text-[10px] text-[#98A2B3]">{formatDate(entry.changed_at)}</span>
                  </div>
                  {entry.old_notes && <p className="text-[12px] text-[#DC2626] line-through">{entry.old_notes}</p>}
                  <p className="text-[12px] text-[#101828]">{entry.new_notes || '(empty)'}</p>
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function MakeRecurringModal({ isOpen, onClose, billId: _billId, onMake }: { isOpen: boolean; onClose: () => void; billId: string; onMake: (interval: string, endDate?: string) => void }) {
  const [interval, setInterval] = useState('MONTHLY')
  const [endDate, setEndDate] = useState('')

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF4FF] border border-[#C7D7FE]">
            <Repeat className="h-5 w-5 text-[#3538CD]" />
          </div>
          <DialogTitle>Make Recurring</DialogTitle>
          <DialogDescription>Set this bill to auto-generate copies on a schedule.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#6B7280] mb-1.5">Interval</label>
              <select value={interval} onChange={e => setInterval(e.target.value)} className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none" aria-label="Recurring interval">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Bi-weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[#6B7280] mb-1.5">End Date (optional)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none" aria-label="Recurring end date" />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => { onMake(interval, endDate || undefined); onClose() }} className="w-full bg-[#3538CD] hover:bg-[#2D32B0] text-white cursor-pointer">Set Recurring</Button>
          <Button variant="secondary" onClick={onClose} className="w-full cursor-pointer">Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ShopBillDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data: bill, isLoading, isError, error } = useShopBill(id)
  const updateBill = useUpdateShopBill()
  const deleteBill = useDeleteShopBill()
  const duplicateBill = useDuplicateShopBill()
  const splitBill = useSplitShopBill()
  const makeRecurring = useMakeRecurring()

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [showNotesHistory, setShowNotesHistory] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [notesHistory, setNotesHistory] = useState<any[]>([])

  const handleDelete = () => { if (bill) setShowDeleteConfirm(true) }
  const confirmDelete = () => {
    if (!bill) return
    setShowDeleteConfirm(false)
    deleteBill.mutate(bill.id, { onSuccess: () => navigate('/shop-bills') })
  }

  const advanceStatus = () => {
    if (!bill) return
    const flow: Record<string, string> = { PENDING: 'PROCESSING', PROCESSING: 'DELIVERED', DELIVERED: 'COMPLETED' }
    const next = flow[bill.status]
    if (next) updateBill.mutate({ id: bill.id, payload: { status: next } as any })
  }

  const handleDuplicate = () => {
    if (!bill) return
    duplicateBill.mutate(bill.id, { onSuccess: (newBill: any) => navigate(`/shop-bills/${newBill.id}`) })
  }

  const handleSplit = (indices: number[]) => {
    if (!bill) return
    splitBill.mutate({ billId: bill.id, itemIndices: indices }, { onSuccess: () => {} })
  }

  const handleToggleLock = () => {
    if (!bill) return
    updateBill.mutate({ id: bill.id, payload: { locked: !bill.locked } as any })
  }

  const handleMakeRecurring = (interval: string, endDate?: string) => {
    if (!bill) return
    makeRecurring.mutate({ billId: bill.id, interval, endDate })
  }

  const loadNotesHistory = async () => {
    if (!bill) return
    try {
      const data = await shopBillService.getNotesHistory(bill.id)
      setNotesHistory(data.notes_history || [])
    } catch {
      console.warn('Failed to load notes history')
      setNotesHistory([])
    }
    setShowNotesHistory(true)
  }

  const isCancelled = bill?.status === 'CANCELLED'
  const isPaid = bill?.payment_status === 'PAID'

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Shop Bills', href: '/shop-bills' }, { label: bill?.bill_number ?? '...' }]} />
          <div className="flex items-center gap-3 mt-1">
            <Link to="/shop-bills" className="text-[#98A2B3] hover:text-[#374151]"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="text-dashboard-title">Shop Bill</h1>
            {bill && <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[bill.status] ?? 'bg-gray-100 text-gray-500'}`}>{bill.status}</span>}
            {bill?.locked && <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]"><Lock size={12} /> Locked</span>}
            {bill?.is_recurring && <span className="inline-flex items-center gap-1 text-[11px] text-[#3538CD]"><Repeat size={12} /> {bill.recurring_interval ?? 'RECURRING'}</span>}
          </div>
        </div>
        {bill && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {!isCancelled && bill.status !== 'COMPLETED' && (
              <Button size="sm" onClick={advanceStatus} disabled={updateBill.isPending} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white gap-1.5 cursor-pointer">
                <CheckCircle className="h-3.5 w-3.5" />
                {bill.status === 'PENDING' && 'Start Processing'}
                {bill.status === 'PROCESSING' && 'Mark Delivered'}
                {bill.status === 'DELIVERED' && 'Mark Completed'}
              </Button>
            )}
            {!isCancelled && !isPaid && bill.outstanding_amount > 0 && (
              <Button size="sm" onClick={() => setIsPaymentModalOpen(true)} className="bg-[#16A34A] hover:bg-[#15803D] text-white gap-1.5 cursor-pointer">
                <Wallet className="h-3.5 w-3.5" /> Pay
              </Button>
            )}
            {!isCancelled && (
              <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={duplicateBill.isPending} className="gap-1 cursor-pointer">
                <Copy size={13} /> Clone
              </Button>
            )}
            {!isCancelled && bill.items.length > 1 && !isPaid && (
              <Button size="sm" variant="outline" onClick={() => setShowSplitModal(true)} className="gap-1 cursor-pointer">
                <Scissors size={13} /> Split
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={loadNotesHistory} className="gap-1 cursor-pointer" aria-label="Notes history">
              <MessageSquare size={13} />
            </Button>
            <Button size="sm" variant="outline" onClick={handleToggleLock} className="gap-1 cursor-pointer" aria-label={bill.locked ? 'Unlock bill' : 'Lock bill'}>
              {bill.locked ? <Unlock size={13} /> : <Lock size={13} />}
            </Button>
            {!bill.is_recurring && !isCancelled && (
              <Button size="sm" variant="outline" onClick={() => setShowRecurringModal(true)} className="gap-1 cursor-pointer" aria-label="Make recurring">
                <Repeat size={13} />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteBill.isPending} className="text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer" aria-label="Delete bill">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
      ) : isError ? (
        <ErrorState description={error instanceof Error ? error.message : 'Unable to load shop bill'} />
      ) : !bill ? (
        <EmptyState title="Shop bill not found" description="This shop bill may have been deleted." />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Grand Total</p>
              <p className="text-[18px] font-bold text-[#101828] mt-1">{fmt(bill.grand_total)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Paid</p>
              <p className="text-[18px] font-bold text-[#16A34A] mt-1">{fmt(bill.paid_amount)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Outstanding</p>
              <p className={`text-[18px] font-bold mt-1 ${bill.outstanding_amount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>{fmt(bill.outstanding_amount)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Payment Status</p>
              <div className="mt-1.5">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${PAYMENT_COLORS[bill.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {(bill.payment_status ?? 'DRAFT').replace('_', ' ')}
                </span>
              </div>
            </Card>
          </div>

          {/* Bill Info */}
          <Card>
            <CardHeader><CardTitle className="text-[15px]">Bill Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Bill Number</p>
                <p className="font-medium text-[#101828] mt-0.5">{bill.bill_number}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Client Name</p>
                <p className="font-medium text-[#101828] mt-0.5">{bill.client_name || '—'}</p>
              </div>
              {bill.delivery_date && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Delivery Date</p>
                  <p className="font-medium text-[#101828] mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-[#6B7280]" />{formatDate(bill.delivery_date)}
                  </p>
                </div>
              )}
              {bill.quotation_id && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Quotation</p>
                  <Link to={`/quotations/${bill.quotation_id}`} className="font-medium text-[#DC2626] hover:underline mt-0.5 inline-block">View linked quotation →</Link>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Created</p>
                <p className="font-medium text-[#101828] mt-0.5">{formatDate(bill.created_at)}</p>
              </div>
              {bill.parent_bill_id && (
                <div>
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Parent Bill</p>
                  <Link to={`/shop-bills/${bill.parent_bill_id}`} className="font-medium text-[#DC2626] hover:underline mt-0.5 inline-block">View parent →</Link>
                </div>
              )}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Notes</p>
                  <button onClick={loadNotesHistory} className="text-[10px] text-[#DC2626] hover:underline cursor-pointer">history</button>
                </div>
                <p className="text-[#374151] mt-0.5 whitespace-pre-wrap">{bill.notes || '—'}</p>
              </div>
              {bill.tags && bill.tags.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-[11px] font-semibold uppercase text-[#6B7280]">Tags</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {bill.tags.map((tag: string, i: number) => (
                      <span key={i} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader><CardTitle className="text-[15px]">Items ({bill.items.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E4E7EC]">
                      <th className="text-left py-2 font-semibold text-[#6B7280]" scope="col">#</th>
                      <th className="text-left py-2 font-semibold text-[#6B7280]" scope="col">Item</th>
                      <th className="text-left py-2 font-semibold text-[#6B7280]" scope="col">Spec</th>
                      <th className="text-left py-2 font-semibold text-[#6B7280]" scope="col">Category</th>
                      <th className="text-right py-2 font-semibold text-[#6B7280]" scope="col">Price</th>
                      <th className="text-right py-2 font-semibold text-[#6B7280]" scope="col">Qty</th>
                      <th className="text-right py-2 font-semibold text-[#6B7280]" scope="col">Disc</th>
                      <th className="text-right py-2 font-semibold text-[#6B7280]" scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-[#F3F4F6] last:border-0">
                        <td className="py-2 text-[#98A2B3]">{idx + 1}</td>
                        <td className="py-2 font-medium text-[#101828]">{item.item_name}</td>
                        <td className="py-2 text-[#6B7280]">{item.specification || '-'}</td>
                        <td className="py-2 text-[#6B7280]">{item.category || '-'}</td>
                        <td className="py-2 text-right">{fmt(item.unit_price)}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right text-[#DC2626]">{item.discount > 0 ? `${item.discount_type === 'PERCENT' ? item.discount + '%' : fmt(item.discount)}` : '-'}</td>
                        <td className="py-2 text-right font-medium">{fmt(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#E4E7EC]">
                      <td colSpan={5} />
                      <td className="py-2 text-right font-semibold text-[#101828]" colSpan={2}>Subtotal</td>
                      <td className="py-2 text-right font-semibold text-[#101828]">{fmt(bill.total_amount)}</td>
                    </tr>
                    {bill.discounts > 0 && (
                      <tr><td colSpan={5} /><td className="py-1 text-right text-[#DC2626]" colSpan={2}>Discounts</td><td className="py-1 text-right text-[#DC2626]">-{fmt(bill.discounts)}</td></tr>
                    )}
                    {bill.transport_fee > 0 && (
                      <tr><td colSpan={5} /><td className="py-1 text-right" colSpan={2}>Transport</td><td className="py-1 text-right">+{fmt(bill.transport_fee)}</td></tr>
                    )}
                    {bill.taxes > 0 && (
                      <tr><td colSpan={5} /><td className="py-1 text-right" colSpan={2}>Taxes</td><td className="py-1 text-right">+{fmt(bill.taxes)}</td></tr>
                    )}
                    <tr className="border-t-2 border-[#DC2626]">
                      <td colSpan={5} />
                      <td className="py-2 text-right font-bold text-[#101828]" colSpan={2}>Grand Total</td>
                      <td className="py-2 text-right font-bold text-[#DC2626] text-[15px]">{fmt(bill.grand_total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Modals */}
          <RecordPaymentModal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} billId={bill.id} outstanding={bill.outstanding_amount} />
          <SplitBillModal isOpen={showSplitModal} onClose={() => setShowSplitModal(false)} bill={bill} onSplit={handleSplit} />
          <NotesHistoryModal isOpen={showNotesHistory} onClose={() => setShowNotesHistory(false)} notesHistory={notesHistory} />
          <MakeRecurringModal isOpen={showRecurringModal} onClose={() => setShowRecurringModal(false)} billId={bill.id} onMake={handleMakeRecurring} />
          <ConfirmDialog open={showDeleteConfirm} onCancel={() => setShowDeleteConfirm(false)} onConfirm={confirmDelete} title="Delete Shop Bill" description={`Are you sure you want to delete bill ${bill.bill_number}? This action cannot be undone.`} confirmLabel="Delete" variant="danger" />
        </>
      )}
    </div>
  )
}
