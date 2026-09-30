import { useState, useMemo, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, FileText, X, LayoutTemplate, Repeat } from 'lucide-react'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { todayISO } from '../../../lib/date'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '../../../components/ui/dialog'
import { useCreateShopBill, useShopBillTemplates } from '../hooks/useShopBills'
import { useQuotations } from '../../quotations/hooks/useQuotations'
import type { Quotation } from '../../../types/quotation'
import type { BillTemplate } from '../../../types/shop-bill'

interface LineItem {
  key: number
  item_name: string
  specification: string
  category: string
  unit_price: number
  quantity: number
  discount: number
  discount_type: 'FIXED' | 'PERCENT'
}

let nextKey = 1

const inputClass = 'h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition'

export default function CreateShopBillPage() {
  const navigate = useNavigate()
  const createBill = useCreateShopBill()
  const { data: quotations = [] } = useQuotations()
  const { data: templateData } = useShopBillTemplates()

  const [billNumber, setBillNumber] = useState('')
  const [clientName, setClientName] = useState('')
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [notes, setNotes] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(() => todayISO())
  const [discounts, setDiscounts] = useState<number>(0)
  const [transportFee, setTransportFee] = useState<number>(0)
  const [taxes, setTaxes] = useState<number>(0)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringInterval, setRecurringInterval] = useState('MONTHLY')
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [locked, setLocked] = useState(false)
  const [items, setItems] = useState<LineItem[]>([
    { key: nextKey++, item_name: '', specification: '', category: '', unit_price: 0, quantity: 1, discount: 0, discount_type: 'FIXED' },
  ])
  const [quotationSearch, setQuotationSearch] = useState('')
  const [showQuotationPicker, setShowQuotationPicker] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  const templates = templateData?.items ?? []

  const filteredQuotations = useMemo(() => {
    const q = quotationSearch.trim().toLowerCase()
    if (!q) return quotations
    return quotations.filter(quo =>
      [quo.client_name, quo.quotation_title ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [quotations, quotationSearch])

  const updateItem = (key: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item))
  }

  const addItem = () => {
    setItems(prev => [...prev, { key: nextKey++, item_name: '', specification: '', category: '', unit_price: 0, quantity: 1, discount: 0, discount_type: 'FIXED' }])
  }

  const removeItem = (key: number) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(item => item.key !== key))
  }

  const grid = useDataGrid({ columns: 5, rows: items.length, onAppendRow: addItem })

  const flow = useEnterFlow<HTMLDivElement>()

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented) return
    const target = e.target as HTMLElement
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA') return
    e.preventDefault()
  }

  const loadFromQuotation = (quo: Quotation) => {
    setSelectedQuotation(quo)
    setClientName(quo.client_name)
    setShowQuotationPicker(false)
    if (quo.line_items && quo.line_items.length > 0) {
      setItems(quo.line_items.map((qi) => ({
        key: nextKey++,
        item_name: qi.item_name ?? '',
        specification: '',
        category: qi.category ?? '',
        unit_price: qi.unit_price ?? 0,
        quantity: 1,
        discount: 0,
        discount_type: 'FIXED' as const,
      })))
    }
  }

  const loadFromTemplate = (templateId: string) => {
    const tmpl = templates.find((t: BillTemplate) => t.id === templateId)
    if (!tmpl) return
    setClientName(tmpl.client_name || clientName)
    setDiscounts(tmpl.discounts)
    setTransportFee(tmpl.transport_fee)
    setTaxes(tmpl.taxes)
    setNotes(tmpl.notes || '')
    setItems(tmpl.items.map((i: any) => ({
      key: nextKey++,
      item_name: i.item_name,
      specification: i.specification || '',
      category: i.category || '',
      unit_price: i.unit_price,
      quantity: i.quantity,
      discount: i.discount || 0,
      discount_type: i.discount_type || 'FIXED',
    })))
    setShowTemplatePicker(false)
  }

  const calcItemTotal = (item: LineItem) => {
    const base = item.unit_price * item.quantity
    if (item.discount_type === 'PERCENT') return base * (1 - item.discount / 100)
    return base - item.discount
  }

  const totals = useMemo(() => {
    const totalAmount = items.reduce((sum, item) => sum + Math.max(0, calcItemTotal(item)), 0)
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    const grandTotal = totalAmount - discounts + transportFee + taxes
    return { totalAmount, totalQuantity, grandTotal: Math.max(0, grandTotal) }
  }, [items, discounts, transportFee, taxes])

  const isValid = clientName.trim() && items.some(i => i.item_name.trim() && i.unit_price > 0 && i.quantity > 0)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    createBill.mutate(
      {
        bill_number: billNumber.trim() || undefined,
        client_name: clientName.trim(),
        quotation_id: selectedQuotation ? String(selectedQuotation.id) : undefined,
        items: items
          .filter(i => i.item_name.trim() && i.unit_price > 0 && i.quantity > 0)
          .map(i => ({
            item_name: i.item_name.trim(),
            specification: i.specification.trim() || undefined,
            category: i.category.trim() || undefined,
            unit_price: i.unit_price,
            quantity: i.quantity,
            discount: i.discount || 0,
            discount_type: i.discount_type,
          })),
        notes: notes.trim() || undefined,
        delivery_date: deliveryDate || undefined,
        discounts: discounts || undefined,
        transport_fee: transportFee || undefined,
        taxes: taxes || undefined,
        is_recurring: isRecurring || undefined,
        recurring_interval: isRecurring ? recurringInterval : undefined,
        recurring_end_date: recurringEndDate || undefined,
        locked: locked || undefined,
      },
      { onSuccess: (bill) => navigate(`/shop-bills/${bill.id}`) },
    )
  }

  const fmt = (v: number) => `LKR ${v.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Shop Bills', href: '/shop-bills' }, { label: 'New Bill' }]} />
        <div className="flex items-center gap-3 mt-1">
          <button onClick={() => navigate('/shop-bills')} className="p-1 rounded hover:bg-gray-100 transition cursor-pointer">
            <ArrowLeft className="h-5 w-5 text-[#6B7280]" />
          </button>
          <div className="flex-1">
            <h1 className="text-dashboard-title">New Shop Bill</h1>
            <p className="text-[13px] text-[#98A2B3] mt-0.5">
              {selectedQuotation ? `Creating bill from "${selectedQuotation.quotation_title ?? selectedQuotation.client_name}"` : 'Enter bill details manually or load from template/quotation'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowTemplatePicker(true)} className="gap-1.5 cursor-pointer">
            <LayoutTemplate size={14} /> Load Template
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-5">
        {/* Bill Info */}
        <Card>
          <CardHeader><CardTitle className="text-[15px]">Bill Information</CardTitle></CardHeader>
          <CardContent>
            <div ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Bill Number (auto-generated if empty)</label>
                <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. SB-12345678" className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Client Name *</label>
                <input type="text" required autoFocus value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Shop / client name" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Quotation (optional)</label>
                {selectedQuotation ? (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-[13px] text-[#101828] bg-[#F9FAFB] rounded-lg px-3 py-2 border border-[#E4E7EC]">
                      {selectedQuotation.quotation_title ?? selectedQuotation.client_name}
                    </span>
                    <button type="button" onClick={() => { setSelectedQuotation(null); setQuotationSearch('') }} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                      <X className="h-4 w-4 text-[#6B7280]" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => setShowQuotationPicker(!showQuotationPicker)} className={`${inputClass} text-left flex items-center gap-2 cursor-pointer`}>
                      <FileText className="h-4 w-4 text-[#98A2B3]" />
                      <span className="text-[#98A2B3]">Link a quotation…</span>
                    </button>
                    {showQuotationPicker && (
                      <div className="mt-1 border border-[#E4E7EC] rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto">
                        <div className="p-2 border-b border-[#E4E7EC]">
                          <input type="text" value={quotationSearch} onChange={e => setQuotationSearch(e.target.value)} placeholder="Search…" className="h-8 w-full rounded border border-[#E4E7EC] px-2 text-[12px] outline-none" />
                        </div>
                        {filteredQuotations.length === 0 ? (
                          <div className="p-3 text-[12px] text-[#98A2B3] text-center">No quotations found</div>
                        ) : filteredQuotations.map(quo => (
                          <button key={quo.id} type="button" onClick={() => loadFromQuotation(quo)} className="w-full text-left px-3 py-2 hover:bg-[#FFF1F1] transition text-[12px] cursor-pointer">
                            <p className="font-medium text-[#101828]">{quo.client_name}</p>
                            <p className="text-[#6B7280]">{quo.quotation_title ?? 'Untitled'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" className={`${inputClass} h-auto py-2 resize-none`} />
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-[15px]">Items</CardTitle>
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-[12px] font-medium text-[#DC2626] hover:text-[#B91C1C] cursor-pointer">
                <Plus size={14} /> Add Item
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3" onKeyDown={grid.handleKeyDown}>
            {items.map((item, idx) => (
              <div key={item.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-2">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Item Name *</label>}
                  <input type="text" value={item.item_name} onChange={e => updateItem(item.key, 'item_name', e.target.value)} placeholder="Item name" className={inputClass} ref={grid.registerCell(idx, 0)} />
                </div>
                <div className="col-span-3 md:col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Qty *</label>}
                  <input type="number" min={1} value={item.quantity} onChange={e => updateItem(item.key, 'quantity', e.target.value ? Number(e.target.value) : 1)} className={inputClass} ref={grid.registerCell(idx, 1)} />
                </div>
                <div className="col-span-4 md:col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Price *</label>}
                  <input type="number" min={0} step="0.01" value={item.unit_price || ''} onChange={e => updateItem(item.key, 'unit_price', e.target.value ? Number(e.target.value) : 0)} placeholder="0.00" className={inputClass} ref={grid.registerCell(idx, 2)} />
                </div>
                <div className="col-span-3 md:col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Disc</label>}
                  <input type="number" min={0} step="0.01" value={item.discount || ''} onChange={e => updateItem(item.key, 'discount', e.target.value ? Number(e.target.value) : 0)} placeholder="0" className={inputClass} ref={grid.registerCell(idx, 3)} />
                </div>
                <div className="col-span-3 md:col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Type</label>}
                  <select value={item.discount_type} onChange={e => updateItem(item.key, 'discount_type', e.target.value)} className={inputClass} ref={grid.registerCell(idx, 4)}>
                    <option value="FIXED">Fixed</option>
                    <option value="PERCENT">%</option>
                  </select>
                </div>
                <div className="col-span-6 md:col-span-2">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Spec</label>}
                  <input type="text" value={item.specification} onChange={e => updateItem(item.key, 'specification', e.target.value)} placeholder="Size / color" className={inputClass} />
                </div>
                <div className="col-span-6 md:col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-semibold uppercase text-[#98A2B3] mb-1">Category</label>}
                  <input type="text" value={item.category} onChange={e => updateItem(item.key, 'category', e.target.value)} placeholder="Cat" className={inputClass} />
                </div>
                <div className="col-span-2 md:col-span-1 text-right">
                  {idx === 0 && <label className="block text-[10px] font-transparent mb-1">&nbsp;</label>}
                  <span className="text-[12px] text-[#6B7280] font-medium">{fmt(Math.max(0, calcItemTotal(item)))}</span>
                </div>
                <div className="col-span-1">
                  {idx === 0 && <label className="block text-[10px] font-transparent mb-1">&nbsp;</label>}
                  <button type="button" onClick={() => removeItem(item.key)} disabled={items.length <= 1} className="p-1 rounded text-[#98A2B3] hover:text-[#DC2626] hover:bg-red-50 disabled:opacity-30 cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Bill Discount (LKR)</label>
                  <input type="number" min={0} step="0.01" value={discounts || ''} onChange={e => setDiscounts(e.target.value ? Number(e.target.value) : 0)} placeholder="0.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Transport Fee (LKR)</label>
                  <input type="number" min={0} step="0.01" value={transportFee || ''} onChange={e => setTransportFee(e.target.value ? Number(e.target.value) : 0)} placeholder="0.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Taxes (LKR)</label>
                  <input type="number" min={0} step="0.01" value={taxes || ''} onChange={e => setTaxes(e.target.value ? Number(e.target.value) : 0)} placeholder="0.00" className={inputClass} />
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-2 text-right">
                <div className="flex justify-between md:justify-end md:gap-8">
                  <span className="text-[13px] text-[#6B7280]">Subtotal</span>
                  <span className="text-[13px] font-medium text-[#101828]">{fmt(totals.totalAmount)}</span>
                </div>
                {discounts > 0 && (
                  <div className="flex justify-between md:justify-end md:gap-8">
                    <span className="text-[13px] text-[#6B7280]">Discounts</span>
                    <span className="text-[13px] font-medium text-[#DC2626]">-{fmt(discounts)}</span>
                  </div>
                )}
                {transportFee > 0 && (
                  <div className="flex justify-between md:justify-end md:gap-8">
                    <span className="text-[13px] text-[#6B7280]">Transport</span>
                    <span className="text-[13px] font-medium text-[#101828]">+{fmt(transportFee)}</span>
                  </div>
                )}
                {taxes > 0 && (
                  <div className="flex justify-between md:justify-end md:gap-8">
                    <span className="text-[13px] text-[#6B7280]">Taxes</span>
                    <span className="text-[13px] font-medium text-[#101828]">+{fmt(taxes)}</span>
                  </div>
                )}
                <div className="border-t border-[#E4E7EC] pt-2 flex justify-between md:justify-end md:gap-8">
                  <span className="text-[14px] font-semibold text-[#101828]">Grand Total</span>
                  <span className="text-[18px] font-bold text-[#DC2626]">{fmt(totals.grandTotal)}</span>
                </div>
                <p className="text-[11px] text-[#98A2B3]">{totals.totalQuantity} item{totals.totalQuantity === 1 ? '' : 's'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recurring & Lock Options */}
        <Card>
          <CardHeader><CardTitle className="text-[15px]">Options</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="recurring" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="h-4 w-4 accent-[#DC2626] cursor-pointer" />
              <label htmlFor="recurring" className="text-[13px] text-[#101828] cursor-pointer flex items-center gap-1.5">
                <Repeat size={14} /> Make this a recurring bill
              </label>
            </div>
            {isRecurring && (
              <div className="grid grid-cols-2 gap-3 ml-7">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#6B7280] mb-1.5">Interval</label>
                  <select value={recurringInterval} onChange={e => setRecurringInterval(e.target.value)} className={inputClass}>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#6B7280] mb-1.5">End Date (optional)</label>
                  <input type="date" value={recurringEndDate} onChange={e => setRecurringEndDate(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <input type="checkbox" id="locked" checked={locked} onChange={e => setLocked(e.target.checked)} className="h-4 w-4 accent-[#6B7280] cursor-pointer" />
              <label htmlFor="locked" className="text-[13px] text-[#101828] cursor-pointer">Lock this bill (prevent edits after creation)</label>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/shop-bills')} className="cursor-pointer">Cancel</Button>
          <Button type="submit" disabled={!isValid || createBill.isPending} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer">
            {createBill.isPending ? 'Creating…' : 'Create Shop Bill'}
          </Button>
        </div>
      </form>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Load Template</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {templates.length === 0 ? (
              <p className="text-[13px] text-[#98A2B3] text-center py-4">No templates available. Create one from the Templates button on the list page.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {templates.map((t: BillTemplate) => (
                  <button key={t.id} type="button" onClick={() => loadFromTemplate(t.id)} className="w-full text-left p-3 rounded-lg border border-[#E4E7EC] hover:bg-[#FFF1F1] transition cursor-pointer">
                    <p className="text-[13px] font-medium text-[#101828]">{t.name}</p>
                    <p className="text-[11px] text-[#6B7280]">{t.items.length} items &middot; Used {t.use_count}x</p>
                  </button>
                ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}
