import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Printer, X, Check } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { useQuotations } from '../../features/quotations/hooks/useQuotations'
import { formatDate } from '../../lib/utils'

interface PrintedBillModalProps {
  open: boolean
  onClose: () => void
  defaultQuotationId?: string | number
}

export function PrintedBillModal({ open, onClose, defaultQuotationId }: PrintedBillModalProps) {
  const { data: quotations = [] } = useQuotations()
  const [roomNumber, setRoomNumber] = useState('408')
  const [guestName, setGuestName] = useState('Valued Guest')
  const [selectedId, setSelectedId] = useState<string | number>(defaultQuotationId ?? '')
  const [selectedItem, setSelectedItem] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [express, setExpress] = useState(false)

  const resolvedId = selectedId || quotations[0]?.id || ''
  const quotation = quotations.find(q => String(q.id) === String(resolvedId)) ?? quotations[0]
  const lineItems = quotation?.line_items ?? []

  const resolvedItem = lineItems.find(li => li.item_name === selectedItem) ?? lineItems[0]
  const basePrice = resolvedItem?.unit_price ?? 0
  const subtotal = basePrice * quantity
  const expressSurcharge = express ? subtotal * 0.25 : 0
  const tax = (subtotal + expressSurcharge) * 0.1
  const grandTotal = subtotal + expressSurcharge + tax

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-[#101828]/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.16 }}
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl my-4 sm:my-8"
          >
            <div className="flex items-center justify-between border-b border-[#E4E7EC] bg-[#FAFAFA] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DC2626] text-white">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#101828]">Print Guest Receipt</p>
                  <p className="text-[11px] text-[#98A2B3]">Love Laundry · Reg. No: 40-3064</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#E5E7EB] transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-input-label text-[#475467]">Room No.</label>
                    <Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="408" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-input-label text-[#475467]">Quantity</label>
                    <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-input-label text-[#475467]">Guest Name</label>
                  <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="John Doe" />
                </div>

                <div className="space-y-1">
                  <label className="text-input-label text-[#475467]">Hotel / Quotation</label>
                  <select
                    value={resolvedId}
                    onChange={e => { setSelectedId(e.target.value); setSelectedItem('') }}
                    className="w-full h-9 rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
                  >
                    {quotations.map(q => (
                      <option key={q.id} value={q.id}>{q.client_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-input-label text-[#475467]">Item</label>
                  <select
                    value={selectedItem || (lineItems[0]?.item_name ?? '')}
                    onChange={e => setSelectedItem(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
                  >
                    {lineItems.map(li => (
                      <option key={li.id ?? li.item_name} value={li.item_name}>
                        {li.item_name}{li.notes ? ` (${li.notes})` : ''} — LKR {li.unit_price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-input-label text-[#475467]">Express Service (+25%)</label>
                  <button
                    type="button"
                    onClick={() => setExpress(!express)}
                    className={`w-full h-9 rounded-lg border px-3 flex items-center justify-center gap-2 text-[13px] font-medium transition cursor-pointer ${
                      express
                        ? 'border-[#DC2626] bg-[#FFF1F1] text-[#DC2626]'
                        : 'border-[#E4E7EC] bg-white text-[#6B7280] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {express && <Check className="h-3.5 w-3.5" />}
                    {express ? 'Express Turnaround' : 'Standard Service'}
                  </button>
                </div>

                <Button size="lg" className="w-full" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print Official Bill
                </Button>
              </div>

              <div className="lg:col-span-7">
                <div
                  id="printable-receipt"
                  className="rounded-xl border-2 border-dashed border-[#E4E7EC] bg-[#FAFAFA] p-5 space-y-4"
                >
                  <div className="text-center space-y-1 border-b border-[#E4E7EC] pb-4">
                    <h2 className="text-[15px] font-extrabold text-[#101828] uppercase tracking-tight">
                      Love Laundry
                    </h2>
                    <p className="text-[11px] text-[#DC2626] uppercase font-bold tracking-widest">
                      Hotel Laundry Bill
                    </p>
                    <p className="text-[10px] text-[#98A2B3]">
                      Medagama, Panirendawa · Reg. No: 40-3064
                    </p>
                    <p className="text-[10px] text-[#98A2B3]">
                      Printed: {formatDate(new Date().toISOString())}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-white p-3 border border-[#E4E7EC]">
                    <div>
                      <span className="text-[10px] font-bold text-[#98A2B3] uppercase block">Guest</span>
                      <span className="text-[13px] font-semibold text-[#101828]">{guestName || 'Valued Guest'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#98A2B3] uppercase block">Room</span>
                      <span className="text-[13px] font-semibold text-[#101828]">#{roomNumber || '---'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-[#98A2B3] uppercase block">Hotel</span>
                      <span className="text-[13px] font-semibold text-[#101828]">{quotation?.client_name ?? '—'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-semibold text-[#98A2B3] border-b border-[#E4E7EC] pb-1.5 uppercase">
                      <span>Item</span>
                      <span>Qty × Rate</span>
                      <span>Total</span>
                    </div>
                    {resolvedItem ? (
                      <div className="flex justify-between items-start text-[12px] py-0.5">
                        <div>
                          <p className="font-semibold text-[#101828]">{resolvedItem.item_name}</p>
                          {resolvedItem.notes && <p className="text-[11px] text-[#98A2B3]">{resolvedItem.notes}</p>}
                        </div>
                        <span className="text-[#6B7280]">{quantity} × LKR {basePrice.toFixed(2)}</span>
                        <span className="font-bold text-[#101828]">LKR {subtotal.toFixed(2)}</span>
                      </div>
                    ) : (
                      <p className="text-[12px] text-[#98A2B3]">No item selected</p>
                    )}
                  </div>

                  <div className="border-t border-[#E4E7EC] pt-3 space-y-1.5 text-[12px]">
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Subtotal</span>
                      <span className="font-medium">LKR {subtotal.toFixed(2)}</span>
                    </div>
                    {express && (
                      <div className="flex justify-between text-[#DC2626] font-medium">
                        <span>Express (+25%)</span>
                        <span>+ LKR {expressSurcharge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6B7280]">
                      <span>VAT (10%)</span>
                      <span className="font-medium">+ LKR {tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#374151] pt-2 text-[14px] font-bold text-[#101828]">
                      <span>Total Bill</span>
                      <span className="text-[#DC2626]">LKR {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-[#E4E7EC] pt-3 flex items-end justify-between">
                    <div>
                      <div className="h-8 border-b-2 border-[#D1D5DB] w-28 mb-1" />
                      <span className="text-[10px] font-bold text-[#98A2B3] uppercase">Guest Signature</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-[#98A2B3] block uppercase">Folio</span>
                      <span className="text-[11px] font-mono font-bold text-[#374151]">LL-{roomNumber}-2026</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
