import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { transactionsApi, customersApi, itemsApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, Copy, Trash2, Save, ArrowDown } from 'lucide-react'

const LIST_LIMIT = 500

interface Row {
  id: string
  date: string
  customer_id: string
  invoice_number: string
  item_id: string
  qty_received: number
  qty_washed: number
  qty_delivered: number
  qty_rejected: number
  qty_damaged: number
  rate: number
  cost: number
  notes: string
}

function newRow(): Row {
  return {
    id: crypto.randomUUID().slice(0, 8),
    date: new Date().toISOString().split('T')[0],
    customer_id: '',
    invoice_number: '',
    item_id: '',
    qty_received: 0,
    qty_washed: 0,
    qty_delivered: 0,
    qty_rejected: 0,
    qty_damaged: 0,
    rate: 0,
    cost: 0,
    notes: '',
  }
}

export default function HistoricalEntry() {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[]>([newRow()])
  const tableRef = useRef<HTMLDivElement>(null)

  const { data: customersData = { items: [] } } = useQuery({
    queryKey: ['mgmt-customers-list'],
    queryFn: () => customersApi.list('', LIST_LIMIT, 0).then(r => r.data),
  })

  const customers = customersData.items

  const { data: itemsEnvelope = { items: [] } } = useQuery({
    queryKey: ['mgmt-items-list'],
    queryFn: () => itemsApi.list({ limit: LIST_LIMIT, offset: 0 }).then(r => r.data),
  })

  const itemsData = itemsEnvelope.items

  const bulkMut = useMutation({
    mutationFn: (txns: any[]) => transactionsApi.bulkCreate({ transactions: txns }),
    onSuccess: () => {
      toast.success('Records saved successfully')
      qc.invalidateQueries({ queryKey: ['mgmt-transactions'] })
      setRows([newRow()])
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Save failed'),
  })

  const updateRow = useCallback((idx: number, field: keyof Row, value: any) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === 'item_id') {
        const item = itemsData.find((i: any) => i.id === value)
        if (item) next[idx].rate = item.default_rate
      }
      return next
    })
  }, [itemsData])

  const addRow = useCallback(() => setRows(prev => [...prev, newRow()]), [])

  const grid = useDataGrid({ columns: 12, rows: rows.length, onAppendRow: addRow })

  const copyRow = useCallback((idx: number) => {
    setRows(prev => {
      const copy = { ...prev[idx], id: crypto.randomUUID().slice(0, 8) }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const removeRow = useCallback((idx: number) => {
    setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }, [])

  const duplicatePrevDay = useCallback(() => {
    if (rows.length === 0) return
    const last = rows[rows.length - 1]
    const today = new Date().toISOString().split('T')[0]
    const copy = { ...last, id: crypto.randomUUID().slice(0, 8), date: today }
    setRows(prev => [...prev, copy])
  }, [rows])

  const handlePaste = useCallback((e: React.ClipboardEvent, rowIdx: number) => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    const lines = text.split('\n').filter(l => l.trim())
    const newRows: Row[] = []
    for (const line of lines) {
      const cols = line.split('\t')
      if (cols.length < 2) continue
      const r = newRow()
      r.date = cols[0] || r.date
      r.invoice_number = cols[1] || ''
      r.item_id = cols[2] || ''
      r.qty_received = parseFloat(cols[3]) || 0
      r.qty_washed = parseFloat(cols[4]) || r.qty_received
      r.qty_delivered = parseFloat(cols[5]) || 0
      r.qty_rejected = parseFloat(cols[6]) || 0
      r.qty_damaged = parseFloat(cols[7]) || 0
      r.rate = parseFloat(cols[8]) || 0
      r.cost = parseFloat(cols[9]) || 0
      r.notes = cols[10] || ''
      newRows.push(r)
    }
    if (newRows.length > 0) {
      setRows(prev => {
        const next = [...prev]
        next.splice(rowIdx, 1, ...newRows)
        return next
      })
    }
  }, [])

  const handleSave = () => {
    const validRows = rows.filter(r => r.customer_id && r.item_id && (r.qty_received > 0 || r.qty_washed > 0))
    if (validRows.length === 0) {
      toast.error('No valid rows to save')
      return
    }
    const txns = validRows.map(r => ({
      transaction_date: r.date,
      customer_id: r.customer_id,
      invoice_number: r.invoice_number,
      notes: r.notes,
      items: [{
        item_id: r.item_id,
        quantity_received: r.qty_received,
        quantity_washed: r.qty_washed || r.qty_received,
        quantity_delivered: r.qty_delivered,
        quantity_rejected: r.qty_rejected,
        quantity_damaged: r.qty_damaged,
        rate: r.rate,
        cost: r.cost,
        notes: r.notes,
      }],
    }))
    bulkMut.mutate(txns)
  }

  const customerOpts = customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)
  const itemOpts = itemsData.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)

  const totalAmt = rows.reduce((s, r) => s + (r.qty_washed || r.qty_received) * r.rate, 0)
  const totalCost = rows.reduce((s, r) => s + (r.qty_washed || r.qty_received) * r.cost, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Historical Data Entry</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => copyRow(Math.max(0, grid.active?.row ?? 0))} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <Copy size={14} /> Copy Row
          </button>
          <button onClick={duplicatePrevDay} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <ArrowDown size={14} /> Duplicate Prev
          </button>
          <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
            <Plus size={14} /> Add Row
          </button>
          <button onClick={handleSave} disabled={bulkMut.isPending} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
            {bulkMut.isPending ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white" /> : <Save size={14} />}
            Save All ({rows.length} rows)
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">Use <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Tab</kbd>/<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> to move between cells, <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">↑</kbd>/<kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">↓</kbd> for next/prev row, paste from Excel with <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+V</kbd></p>

      <div ref={tableRef} className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm" onKeyDown={grid.handleKeyDown}>
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left min-w-[120px]">Date</th>
              <th className="px-2 py-2 text-left min-w-[150px]">Customer</th>
              <th className="px-2 py-2 text-left min-w-[100px]">Invoice</th>
              <th className="px-2 py-2 text-left min-w-[140px]">Item</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Recv</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Washed</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Deliv</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Rej</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Dmg</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Rate</th>
              <th className="px-2 py-2 text-right min-w-[70px]">Cost</th>
              <th className="px-2 py-2 text-right min-w-[90px]">Total</th>
              <th className="px-2 py-2 text-left min-w-[100px]">Notes</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.id} className={`border-t ${grid.active?.row === ri ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                <td className="px-2 py-1 text-gray-400 text-xs">{ri + 1}</td>
                <td className="px-1 py-0.5">
                  <input type="date" value={row.date} onChange={e => updateRow(ri, 'date', e.target.value)}
                    ref={grid.registerCell(ri, 0)}
                    className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded" />
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.customer_id} onChange={e => updateRow(ri, 'customer_id', e.target.value)}
                    ref={grid.registerCell(ri, 1)}
                    className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded">
                    <option value="">Select...</option>
                    {customerOpts}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <input value={row.invoice_number} onChange={e => updateRow(ri, 'invoice_number', e.target.value)}
                    ref={grid.registerCell(ri, 2)}
                    className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded" placeholder="INV-" />
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.item_id} onChange={e => updateRow(ri, 'item_id', e.target.value)}
                    ref={grid.registerCell(ri, 3)}
                    className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded">
                    <option value="">Select...</option>
                    {itemOpts}
                  </select>
                </td>
                {(['qty_received', 'qty_washed', 'qty_delivered', 'qty_rejected', 'qty_damaged', 'rate', 'cost'] as const).map((field, ci) => (
                  <td key={field} className="px-1 py-0.5">
                    <input type="number" value={row[field]} onChange={e => updateRow(ri, field, parseFloat(e.target.value) || 0)}
                      ref={grid.registerCell(ri, ci + 4)}
                      onPaste={e => handlePaste(e, ri)}
                      className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded text-right" min={0} step={field === 'rate' || field === 'cost' ? 0.01 : 1} />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-medium text-sm">
                  {((row.qty_washed || row.qty_received) * row.rate).toFixed(2)}
                </td>
                <td className="px-1 py-0.5">
                  <input value={row.notes} onChange={e => updateRow(ri, 'notes', e.target.value)}
                    ref={grid.registerCell(ri, 11)}
                    className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-red-500 rounded" placeholder="Notes" />
                </td>
                <td className="px-1 py-0.5">
                  <button onClick={() => removeRow(ri)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold border-t-2">
            <tr>
              <td colSpan={11} className="px-2 py-2 text-right">Total:</td>
              <td className="px-2 py-2 text-right">{totalAmt.toFixed(2)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-sm text-gray-500 flex gap-4">
        <span>Rows: {rows.length}</span>
        <span>Total Amount: LKR {totalAmt.toLocaleString()}</span>
        <span>Total Cost: LKR {totalCost.toLocaleString()}</span>
        <span>Profit: LKR {(totalAmt - totalCost).toLocaleString()}</span>
      </div>
    </div>
  )
}
