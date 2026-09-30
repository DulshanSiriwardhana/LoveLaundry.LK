import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Truck } from 'lucide-react'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { returns as returnsApi } from '../services/returns.service'
import { gatepasses as gatepassApi } from '../services/gatepass.service'
import { deliveries as deliveriesApi } from '../services/delivery.service'
import type { GatePass, Delivery, ReturnItem, BillAdjustment } from '../../../types/operations'

const REASONS = [
  { value: 'WRONG_ITEM', label: 'Wrong Item Sent' },
  { value: 'DAMAGED', label: 'Damaged / Stained' },
  { value: 'MISSING', label: 'Missing Items' },
  { value: 'OTHER', label: 'Other' },
]

const CONDITIONS = [
  { value: 'GOOD', label: 'Good (re-usable)' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'STAINED', label: 'Stained' },
  { value: 'LOST', label: 'Lost (not returned)' },
]

const ACTIONS = [
  { value: 'RECEIVE_BACK', label: 'Receive Back' },
  { value: 'RE_WASH', label: 'Re-wash Cycle' },
  { value: 'DISCARD', label: 'Discard' },
  { value: 'COMPENSATE', label: 'Compensate Client' },
]

const ADJ_TYPES = [
  { value: 'NONE', label: 'No Adjustment' },
  { value: 'QUANTITY_REDUCE', label: 'Reduce Bill Quantity' },
  { value: 'AMOUNT_REDUCE', label: 'Reduce Bill Amount' },
  { value: 'COMPENSATE', label: 'Compensation' },
]

interface GPItemReturn {
  returned_qty: number
  reason: string
  condition: string
  action: string
  notes: string
}

function emptyCustomItem(): ReturnItem {
  return {
    item_name: '',
    returned_qty: 1,
    reason: 'WRONG_ITEM',
    condition: 'GOOD',
    action: 'RECEIVE_BACK',
    notes: '',
  }
}

function defaultGPItemReturn(): GPItemReturn {
  return {
    returned_qty: 1,
    reason: 'WRONG_ITEM',
    condition: 'GOOD',
    action: 'RECEIVE_BACK',
    notes: '',
  }
}

export default function CreateReturnPage() {
  const navigate = useNavigate()
  const [gatePasses, setGatePasses] = useState<GatePass[]>([])
  const [selectedGP, setSelectedGP] = useState<GatePass | null>(null)
  const [gpSearch, setGpSearch] = useState('')
  const [gpLoading, setGpLoading] = useState(true)
  const [gpError, setGpError] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('')

  // GP items: key = index in selectedGP.items, value = return details
  const [gpSelections, setGpSelections] = useState<Record<number, GPItemReturn>>({})

  // Custom items (not from gate pass)
  const [customItems, setCustomItems] = useState<ReturnItem[]>([])

  const [adjustment, setAdjustment] = useState<BillAdjustment>({ adjustment_type: 'NONE', amount: 0, notes: '' })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setGpLoading(true)
    setGpError(null)
    gatepassApi.list()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.items || data?.gatepasses || []
        setGatePasses(list)
        setGpLoading(false)
      })
      .catch((err: any) => {
        setGpError(err?.response?.data?.detail || err?.message || 'Failed to load gate passes')
        setGpLoading(false)
      })
  }, [])

  const toggleGPItem = (idx: number) => {
    setGpSelections((prev) => {
      const next = { ...prev }
      if (idx in next) {
        delete next[idx]
      } else {
        next[idx] = defaultGPItemReturn()
      }
      return next
    })
  }

  const updateGPItem = (idx: number, field: keyof GPItemReturn, value: any) => {
    setGpSelections((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value },
    }))
  }

  const addCustomItem = () => setCustomItems([...customItems, emptyCustomItem()])

  const updateCustomItem = (idx: number, field: keyof ReturnItem, value: any) => {
    const copy = [...customItems]
    ;(copy[idx] as any)[field] = value
    setCustomItems(copy)
  }

  const removeCustomItem = (idx: number) => {
    setCustomItems(customItems.filter((_, i) => i !== idx))
  }

  const selectedGPIndices = Object.keys(gpSelections).map(Number)
  const hasAnyItems = selectedGPIndices.length > 0 || customItems.some((i) => i.item_name.trim())

  // Selected gate-pass items (in GP item order) — the rows of the GP entry grid.
  const selectedGPItems = useMemo(
    () => (selectedGP ? (selectedGP.items ?? []).map((it, gi) => ({ it, gi })).filter(({ gi }) => gi in gpSelections) : []),
    [selectedGP, gpSelections],
  )

  // Grids: GP rows = qty(0) → reason(1) → condition(2) → action(3);
  // custom rows = name(0) → spec(1) → qty(2) → reason(3) → condition(4) → action(5) → notes(6).
  const gpGrid = useDataGrid({ columns: 4, rows: selectedGPItems.length })
  const customGrid = useDataGrid({ columns: 7, rows: customItems.length })

  const handleSubmit = async () => {
    if (!selectedGP) {
      setError('Select a gate pass')
      return
    }
    if (!hasAnyItems) {
      setError('Select at least one item to return')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const items: ReturnItem[] = []

      // Build items from GP selections
      for (const idx of selectedGPIndices) {
        const gpItem = selectedGP.items[idx]
        const sel = gpSelections[idx]
        if (!gpItem || !sel) continue
        items.push({
          item_name: gpItem.item_name,
          specification: gpItem.specification || '',
          returned_qty: sel.returned_qty,
          reason: sel.reason as any,
          condition: sel.condition as any,
          action: sel.action as any,
          notes: sel.notes || undefined,
          resend_status: sel.action === 'RECEIVE_BACK' || sel.action === 'RE_WASH' ? 'PENDING' as const : undefined,
        })
      }

      // Add custom items
      for (const ci of customItems) {
        if (!ci.item_name.trim()) continue
        items.push({
          ...ci,
          resend_status: ci.action === 'RECEIVE_BACK' || ci.action === 'RE_WASH' ? 'PENDING' as const : undefined,
        })
      }

      const created = await returnsApi.create({
        gate_pass_id: selectedGP.id!,
        delivery_id: selectedDeliveryId || undefined,
        client_name: clientName,
        items,
        bill_adjustment: adjustment.adjustment_type !== 'NONE' ? adjustment : undefined,
        notes: notes || undefined,
      })
      const createdId = created ? created.return_id || created._id : ''
      navigate(createdId ? `/returns/${String(createdId)}` : '/returns')
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create return')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-10 max-w-3xl">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Returns', href: '/returns' },
            { label: 'Record Return' },
          ]}
        />
        <h1 className="text-dashboard-title mt-1">Record Return</h1>
        <p className="text-[13px] text-[#98A2B3] mt-0.5">
          Record garments returned by a client
        </p>
      </div>

      {/* Gate Pass Selection */}
      <Card className="p-5">
        <h3 className="text-[14px] font-semibold text-[#101828] mb-3">Gate Pass</h3>
        {gpLoading ? (
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        ) : gpError ? (
          <div className="text-[13px] text-red-600">{gpError}</div>
        ) : (
          <>
            <input
              type="text"
              value={gpSearch}
              onChange={(e) => setGpSearch(e.target.value)}
              placeholder="Search gate pass number or client…"
              className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706] mb-2"
            />
            <div className="max-h-48 overflow-y-auto border border-[#E4E7EC] rounded-lg">
              {gatePasses
                .filter((gp) => {
                  if (!gpSearch.trim()) return true
                  const q = gpSearch.toLowerCase()
                  return (
                    gp.gate_pass_number.toLowerCase().includes(q) ||
                    gp.client_name.toLowerCase().includes(q)
                  )
                })
                .map((gp) => (
                  <button
                    key={gp.id}
                    type="button"
                    onClick={() => {
                      setSelectedGP(gp)
                      setClientName(gp.client_name)
                      setGpSearch('')
                      setGpSelections({})
                      setSelectedDeliveryId('')
                      // Fetch deliveries for this gate pass
                      deliveriesApi.list({ gate_pass_id: gp.id })
                        .then((data: any) => {
                          const list = Array.isArray(data) ? data : data?.items || data?.deliveries || []
                          setDeliveries(list)
                        })
                        .catch(() => setDeliveries([]))
                    }}
                    className={`w-full text-left px-3 py-2.5 text-[13px] border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer ${
                      selectedGP?.id === gp.id ? 'bg-amber-50 font-semibold' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[#6B7280]">{gp.gate_pass_number}</span>
                      <span className="text-[#101828]">{gp.client_name}</span>
                    </div>
                    <div className="text-[11px] text-[#98A2B3] mt-0.5">
                      {(gp.items ?? []).length} item types · {(gp.items ?? []).reduce((s, i) => s + i.received_qty, 0)} pcs
                    </div>
                  </button>
                ))}
              {gatePasses.filter((gp) => {
                if (!gpSearch.trim()) return true
                const q = gpSearch.toLowerCase()
                return gp.gate_pass_number.toLowerCase().includes(q) || gp.client_name.toLowerCase().includes(q)
              }).length === 0 && (
                <div className="px-3 py-4 text-center text-[13px] text-[#98A2B3]">No gate passes found</div>
              )}
            </div>
          </>
        )}

        {selectedGP && (
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[12px] text-[#98A2B3]">Selected: </span>
                <span className="text-[13px] font-semibold text-[#101828]">{selectedGP.gate_pass_number}</span>
                <span className="text-[12px] text-[#98A2B3]"> — {selectedGP.client_name}</span>
              </div>
              <button onClick={() => { setSelectedGP(null); setClientName(''); setGpSelections({}); setDeliveries([]); setSelectedDeliveryId('') }} className="text-[12px] text-[#DC2626] hover:underline cursor-pointer">Clear</button>
            </div>
          </div>
        )}
      </Card>

      {/* Delivery Selection (optional) */}
      {selectedGP && deliveries.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-[#6B7280]" />
            <h3 className="text-[14px] font-semibold text-[#101828]">Link Delivery (Optional)</h3>
          </div>
          <p className="text-[12px] text-[#98A2B3] mb-2">Link this return to a specific delivery if applicable.</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedDeliveryId('')}
              className={`w-full text-left px-3 py-2 rounded-lg text-[13px] border transition cursor-pointer ${
                !selectedDeliveryId ? 'border-amber-300 bg-amber-50 font-semibold' : 'border-[#E4E7EC] hover:bg-gray-50'
              }`}
            >
              No delivery linked
            </button>
            {deliveries.map((dl) => (
              <button
                key={dl.id}
                type="button"
                onClick={() => setSelectedDeliveryId(dl.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] border transition cursor-pointer ${
                  selectedDeliveryId === dl.id ? 'border-amber-300 bg-amber-50 font-semibold' : 'border-[#E4E7EC] hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7280] font-mono text-[11px]">{dl.id.slice(-8).toUpperCase()}</span>
                  <span className="text-[#101828]">{dl.delivered_by} · {(dl.items ?? []).length} items</span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Return Items */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-[#101828]">Returned Items</h3>
          <Button variant="outline" size="sm" onClick={addCustomItem}>
            <Plus className="h-3.5 w-3.5" /> Custom Item
          </Button>
        </div>

        {/* Gate Pass Items (selectable) */}
        {selectedGP && (selectedGP.items ?? []).length > 0 && (
          <div className="mb-4">
            <p className="text-[12px] font-semibold text-[#6B7280] mb-2">From Gate Pass — tick items being returned:</p>
            <div className="space-y-2" onKeyDown={gpGrid.handleKeyDown}>
              {selectedGPItems.map(({ it: gpItem, gi }, rIdx) => {
                const isSelected = gi in gpSelections
                const sel = gpSelections[gi]

                return (
                  <div
                    key={gi}
                    className={`rounded-lg border p-3 transition ${
                      isSelected ? 'border-amber-300 bg-amber-50' : 'border-[#E4E7EC] bg-white hover:bg-gray-50'
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGPItem(gi)}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[#101828]">{gpItem.item_name}</span>
                          {gpItem.specification && (
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white bg-gray-500">
                              {gpItem.specification}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#98A2B3]">
                          Received: {gpItem.received_qty} · Client: {gpItem.client_qty}
                        </span>
                      </div>
                    </label>

                    {isSelected && sel && (
                      <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-4 gap-2">
                        <div>
                          <label className="text-[10px] text-[#98A2B3] mb-0.5 block">Qty</label>
                          <input
                            ref={gpGrid.registerCell(rIdx, 0)}
                            type="number"
                            min={1}
                            max={gpItem.received_qty}
                            value={sel.returned_qty}
                            onChange={(e) => updateGPItem(gi, 'returned_qty', parseInt(e.target.value) || 1)}
                            className="h-8 w-full rounded border border-[#E4E7EC] bg-white px-2 text-[12px] outline-none focus:border-[#D97706]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#98A2B3] mb-0.5 block">Reason</label>
                          <select
                            ref={gpGrid.registerCell(rIdx, 1)}
                            value={sel.reason}
                            onChange={(e) => updateGPItem(gi, 'reason', e.target.value)}
                            className="h-8 w-full rounded border border-[#E4E7EC] bg-white px-2 text-[12px] outline-none focus:border-[#D97706]"
                          >
                            {REASONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#98A2B3] mb-0.5 block">Condition</label>
                          <select
                            ref={gpGrid.registerCell(rIdx, 2)}
                            value={sel.condition}
                            onChange={(e) => updateGPItem(gi, 'condition', e.target.value)}
                            className="h-8 w-full rounded border border-[#E4E7EC] bg-white px-2 text-[12px] outline-none focus:border-[#D97706]"
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-[#98A2B3] mb-0.5 block">Action</label>
                          <select
                            ref={gpGrid.registerCell(rIdx, 3)}
                            value={sel.action}
                            onChange={(e) => updateGPItem(gi, 'action', e.target.value)}
                            className="h-8 w-full rounded border border-[#E4E7EC] bg-white px-2 text-[12px] outline-none focus:border-[#D97706]"
                          >
                            {ACTIONS.map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom items */}
        {customItems.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold text-[#6B7280] mb-2">Custom items:</p>
            <div className="space-y-3" onKeyDown={customGrid.handleKeyDown}>
              {customItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-[#E4E7EC] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#6B7280]">Custom Item</span>
                    <button onClick={() => removeCustomItem(idx)} className="text-[#98A2B3] hover:text-[#DC2626] cursor-pointer">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Item Name</label>
                      <input
                        ref={customGrid.registerCell(idx, 0)}
                        type="text"
                        value={item.item_name}
                        onChange={(e) => updateCustomItem(idx, 'item_name', e.target.value)}
                        placeholder="e.g. Towel, Bed Sheet"
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Specification</label>
                      <input
                        ref={customGrid.registerCell(idx, 1)}
                        type="text"
                        value={item.specification || ''}
                        onChange={(e) => updateCustomItem(idx, 'specification', e.target.value || undefined)}
                        placeholder="e.g. White, King"
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Qty</label>
                      <input
                        ref={customGrid.registerCell(idx, 2)}
                        type="number"
                        min={1}
                        value={item.returned_qty}
                        onChange={(e) => updateCustomItem(idx, 'returned_qty', parseInt(e.target.value) || 1)}
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Reason</label>
                      <select
                        ref={customGrid.registerCell(idx, 3)}
                        value={item.reason}
                        onChange={(e) => updateCustomItem(idx, 'reason', e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      >
                        {REASONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Condition</label>
                      <select
                        ref={customGrid.registerCell(idx, 4)}
                        value={item.condition}
                        onChange={(e) => updateCustomItem(idx, 'condition', e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      >
                        {CONDITIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-[#98A2B3] mb-1 block">Action</label>
                      <select
                        ref={customGrid.registerCell(idx, 5)}
                        value={item.action}
                        onChange={(e) => updateCustomItem(idx, 'action', e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                      >
                        {ACTIONS.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#98A2B3] mb-1 block">Notes</label>
                    <input
                      ref={customGrid.registerCell(idx, 6)}
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => updateCustomItem(idx, 'notes', e.target.value || undefined)}
                      placeholder="Optional notes"
                      className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedGP && customItems.length === 0 && selectedGPIndices.length === 0 && (
          <p className="text-[13px] text-[#98A2B3] text-center py-4">
            Tick items above or add a custom item
          </p>
        )}
        {!selectedGP && customItems.length === 0 && (
          <p className="text-[13px] text-[#98A2B3] text-center py-4">
            Select a gate pass first, or add custom items
          </p>
        )}
      </Card>

      {/* Bill Adjustment */}
      <Card className="p-5">
        <h3 className="text-[14px] font-semibold text-[#101828] mb-3">Bill Adjustment (Optional)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-[#98A2B3] mb-1 block">Adjustment Type</label>
            <select
              value={adjustment.adjustment_type}
              onChange={(e) => setAdjustment({ ...adjustment, adjustment_type: e.target.value as any })}
              className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
            >
              {ADJ_TYPES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          {adjustment.adjustment_type !== 'NONE' && (
            <div>
              <label className="text-[11px] text-[#98A2B3] mb-1 block">Amount (LKR)</label>
              <input
                type="number"
                min={0}
                value={adjustment.amount}
                onChange={(e) => setAdjustment({ ...adjustment, amount: parseFloat(e.target.value) || 0 })}
                className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
              />
            </div>
          )}
        </div>
        {adjustment.adjustment_type !== 'NONE' && (
          <div className="mt-3">
            <label className="text-[11px] text-[#98A2B3] mb-1 block">Adjustment Notes</label>
            <input
              type="text"
              value={adjustment.notes || ''}
              onChange={(e) => setAdjustment({ ...adjustment, notes: e.target.value })}
              placeholder="Reason for adjustment"
              className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] outline-none focus:border-[#D97706]"
            />
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-5">
        <h3 className="text-[14px] font-semibold text-[#101828] mb-3">Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes about this return…"
          rows={3}
          className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#D97706] resize-none"
        />
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link to="/returns">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[#D97706] hover:bg-[#B45309] text-white"
        >
          {saving ? 'Saving…' : 'Record Return'}
        </Button>
      </div>
    </div>
  )
}
