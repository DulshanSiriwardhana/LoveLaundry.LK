import { useState, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Building2, Calendar, Trash2, Banknote, Wallet, FileText } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { PrintTarget } from '../../../components/ui/print-target'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../../../components/ui/dialog'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { formatDate } from '../../../lib/utils'
import { useBill, useDeleteBill, useEditBill } from '../hooks/useBills'
import { usePayments, useCreatePayment } from '../hooks/usePayments'
import { useReactToPrint } from 'react-to-print'
import { BillPrintTemplate } from '../components/bill-print-template'
import { BillStatusBadge } from '../../../components/ui/bill-status-badge'
import { useRef } from 'react'
import { formatCalendarDate } from '../../../lib/time'
import { todayISO } from '../../../lib/time'

function RecordPaymentModal({
  isOpen,
  onClose,
  billId,
  suggestedAmount,
}: {
  isOpen: boolean
  onClose: () => void
  billId: string
  suggestedAmount: number
}) {
  const createPayment = useCreatePayment()
  const [amount, setAmount] = useState<number | ''>(suggestedAmount)
  const [method, setMethod] = useState('Cash')
  const [date, setDate] = useState(() => todayISO())
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const isValid = amount !== '' && amount > 0 && method && date

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    createPayment.mutate(
      { billId, data: { amount: Number(amount), payment_method: method, payment_date: date, reference, notes } },
      { onSuccess: () => { onClose(); setAmount(0); setReference(''); setNotes('') } }
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
            <DialogDescription>Submit a new payment record for this bill.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Amount (LKR)</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Method</label>
                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className={inputClass}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="Cheque # or TXN ID"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional details..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="submit"
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white disabled:opacity-50"
              disabled={!isValid || createPayment.isPending}
            >
              {createPayment.isPending ? 'Logging Payment...' : 'Record Payment'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function BillDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { data: bill, isLoading, isError, error } = useBill(id)
  const { data: payments = [], isLoading: paymentsLoading } = usePayments(id)

  const deleteBill = useDeleteBill()
  const editBill = useEditBill()
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<{client_name: string; notes: string; discounts: number; transport_fee: number; taxes: number; additional_charges: number}>({client_name: '', notes: '', discounts: 0, transport_fee: 0, taxes: 0, additional_charges: 0})
  
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: bill ? `Bill-${bill.client_name}-${bill.id}` : 'Bill',
  })

  const handleDelete = () => {
    if (!bill) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = () => {
    if (!bill) return
    setShowDeleteConfirm(false)
    deleteBill.mutate(bill.id, { onSuccess: () => navigate('/bills') })
  }

  const startEdit = () => {
    if (!bill) return
    setEditForm({
      client_name: bill.client_name || '',
      notes: bill.notes || '',
      discounts: bill.discounts || 0,
      transport_fee: bill.transport_fee || 0,
      taxes: bill.taxes || 0,
      additional_charges: bill.additional_charges || 0,
    })
    setIsEditing(true)
  }

  const saveEdit = () => {
    if (!bill) return
    editBill.mutate(
      { id: bill.id, payload: editForm },
      { onSuccess: () => setIsEditing(false) }
    )
  }

  const outstanding = bill?.outstanding_amount ?? (bill ? (bill.grand_total ?? bill.total_amount) : 0)
  const grandTotal = bill?.grand_total ?? bill?.total_amount ?? 0

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Bills', href: '/bills' },
              { label: bill?.client_name ?? '...' },
            ]}
          />
          <div className="flex items-center gap-3 mt-1">
            <Link to="/bills" className="text-[#98A2B3] hover:text-[#374151]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-dashboard-title">Bill Details</h1>
            <BillStatusBadge status={bill?.payment_status} />
          </div>
        </div>

        {bill && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => handlePrint()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            {bill.payment_status !== 'PAID' && bill.payment_status !== 'CANCELLED' && (
              <>
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={saveEdit} disabled={editBill.isPending}>
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    Edit
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={deleteBill.isPending}
              className="text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3 flex flex-col md:flex-row gap-5">
          <Skeleton className="h-96 flex-grow" />
          <Skeleton className="h-96 md:w-80" />
        </div>
      ) : isError ? (
        <ErrorState description={error instanceof Error ? error.message : 'Unable to load bill'} />
      ) : !bill ? (
        <EmptyState title="Bill not found" description="This bill may have been deleted." />
      ) : (
        <div className="flex flex-col md:flex-row items-start gap-5">
          {/* Main Bill Container */}
          <Card className="flex-1 w-full">
            <CardHeader className="border-b border-[#F2F4F7] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <CardTitle>{bill.client_name}</CardTitle>
                  <p className="text-[12px] text-[#98A2B3] mt-0.5">
                    {bill.quotation_title || 'General Price List'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-[#98A2B3] mt-4">
                <Calendar className="h-3.5 w-3.5" /> Date:
                <span className="font-medium text-[#374151]">{formatDate(bill.created_at)}</span>
              </div>
            </CardHeader>

            <CardContent className="pt-4">
{/* The money columns carry fixed widths (24+28+32 = 84rem of
                  column), so on a phone they cannot fit. `overflow-hidden`
                  clipped the amounts off with no way to reach them — the
                  item column now yields and the frame scrolls. */}
              <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
                <table className="w-full min-w-[420px] text-left text-[13px]">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-2.5">Item</th>
                      <th className="px-4 py-2.5 text-right w-20">Qty</th>
                      <th className="px-4 py-2.5 text-right w-24">Rate</th>
                      <th className="px-4 py-2.5 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F4F7] bg-white">
                    {(bill.items ?? []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium text-[#101828]">{item.item_name}</td>
                        <td className="px-4 py-3 text-right text-[#374151]">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-[#6B7280]">{item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#101828]">{item.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-72 space-y-3 pt-4 border-t border-[#E4E7EC]">
                  <div className="flex items-center justify-between text-[13px] text-[#6B7280]">
                    <span>Total Quantity</span>
                    <span className="font-medium text-[#374151]">{bill.total_quantity} pcs</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#F2F4F7] pt-3 text-[14px] font-semibold text-[#101828]">
                    <span>Gross Amount</span>
                    <span>LKR {bill.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info Sidebar */}
          <div className="w-full md:w-80 space-y-5 flex-shrink-0">
            {/* Payment Summary */}
            <Card>
              <CardHeader className="border-b border-[#F2F4F7] pb-3 bg-[#F9FAFB] rounded-t-lg">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                  <Wallet className="h-4 w-4 text-[#6B7280]" /> Payment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Gross Amount</span>
                  <span className="text-[14px] font-semibold text-[#101828]">LKR {bill.total_amount.toFixed(2)}</span>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280]">Discount (LKR)</label>
                      <input type="number" value={editForm.discounts} onChange={e => setEditForm(f => ({...f, discounts: Number(e.target.value)}))}
                        className="w-full mt-1 rounded-lg border px-2.5 py-1.5 text-[13px]" style={{borderColor: 'var(--border)'}} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280]">Transport Fee (LKR)</label>
                      <input type="number" value={editForm.transport_fee} onChange={e => setEditForm(f => ({...f, transport_fee: Number(e.target.value)}))}
                        className="w-full mt-1 rounded-lg border px-2.5 py-1.5 text-[13px]" style={{borderColor: 'var(--border)'}} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280]">Taxes (LKR)</label>
                      <input type="number" value={editForm.taxes} onChange={e => setEditForm(f => ({...f, taxes: Number(e.target.value)}))}
                        className="w-full mt-1 rounded-lg border px-2.5 py-1.5 text-[13px]" style={{borderColor: 'var(--border)'}} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280]">Other Charges (LKR)</label>
                      <input type="number" value={editForm.additional_charges} onChange={e => setEditForm(f => ({...f, additional_charges: Number(e.target.value)}))}
                        className="w-full mt-1 rounded-lg border px-2.5 py-1.5 text-[13px]" style={{borderColor: 'var(--border)'}} />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-[#6B7280]">Notes</label>
                      <textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} rows={2}
                        className="w-full mt-1 rounded-lg border px-2.5 py-1.5 text-[13px] resize-none" style={{borderColor: 'var(--border)'}} />
                    </div>
                  </div>
                ) : (
                  <>
                    {(bill.discounts ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Discount</span>
                        <span className="text-[14px] font-semibold text-[#D97706]">- LKR {(bill.discounts ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(bill.transport_fee ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Transport</span>
                        <span className="text-[14px] font-semibold text-[#101828]">+ LKR {(bill.transport_fee ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(bill.taxes ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Taxes</span>
                        <span className="text-[14px] font-semibold text-[#101828]">+ LKR {(bill.taxes ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(bill.additional_charges ?? 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6B7280]">Other Charges</span>
                        <span className="text-[14px] font-semibold text-[#101828]">+ LKR {(bill.additional_charges ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[#F2F4F7]">
                  <span className="text-[13px] font-semibold text-[#101828]">Grand Total</span>
                  <span className="text-[15px] font-bold text-[#101828]">LKR {grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">Paid</span>
                  <span className="text-[14px] font-semibold text-[#16A34A]">LKR {(bill.paid_amount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#F2F4F7]">
                  <span className="text-[13px] font-semibold text-[#101828]">Available Deficit</span>
                  <span className="text-[16px] font-bold text-[#DC2626]">LKR {outstanding.toFixed(2)}</span>
                </div>

                {outstanding > 0 && (
                  <Button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white shadow-sm mt-2"
                  >
                    <Banknote className="h-4 w-4 mr-1.5" /> Add Payment
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader className="border-b border-[#F2F4F7] pb-3">
                <CardTitle className="flex items-center gap-2 text-[14px]">
                  <FileText className="h-4 w-4 text-[#6B7280]" /> Payment History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 p-0">
                {paymentsLoading ? (
                  <div className="p-4"><Skeleton className="h-10" /></div>
                ) : payments.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[#98A2B3]">No payments recorded yet.</div>
                ) : (
                  <div className="divide-y divide-[#F2F4F7]">
                    {payments.map((p: any) => (
                      <div key={p.id} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] transition">
                        <div>
                          <p className="text-[13px] font-semibold text-[#101828]">LKR {p.amount.toFixed(2)}</p>
                          <div className="text-[11px] text-[#6B7280] flex items-center gap-1.5 mt-0.5">
                            <span className="font-medium text-[#374151]">{p.payment_method}</span>
                            <span>•</span>
                            <span>{formatCalendarDate(p.payment_date)}</span>
                          </div>
                        </div>
                        {p.reference && (
                          <span className="text-[11px] bg-[#F3F4F6] text-[#4B5563] px-2 py-0.5 rounded-full border border-[#E5E7EB] font-mono">
                            {p.reference}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {bill && isPaymentModalOpen && (
        <RecordPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          billId={bill.id}
          suggestedAmount={outstanding}
        />
      )}
      
      {/* Hidden Print Template */}
      {bill && (
        <PrintTarget>
          <BillPrintTemplate
            ref={printRef}
            bill={bill}
            contactNo=""
            address=""
            receivedDate={formatDate(bill.created_at)}
            deliveryDate=""
            gatePass=""
          />
        </PrintTarget>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Bill"
        description={`Delete this bill for ${bill?.client_name || 'this client'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}