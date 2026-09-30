import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Receipt } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { FilterBar } from '../../../components/ui/filter-bar'
import { DataTable } from '../../../components/ui/data-table'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { ExportButton } from '../../../components/ui/export-button'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { todayISO } from '../../../lib/date'
import { useDefaults } from '../../../components/ops'

const PAGE_SIZE = 20

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE']

export default function ManagementExpenses() {
  const qc = useQueryClient()
  const defaults = useDefaults()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const flow = useEnterFlow()

  useEffect(() => {
    setOffset(0)
  }, [startDate, endDate, catFilter])

  useEscape(showForm, useCallback(() => { setShowForm(false); setEditing(null) }, []))

  const { data: categories = [] } = useQuery({
    queryKey: ['mgmt-expense-cats'],
    queryFn: () => expensesApi.categories().then(r => r.data),
  })

  const { data: expensesData = { items: [], total: 0 }, isLoading: _isLoading } = useQuery({
    queryKey: ['mgmt-expenses', startDate, endDate, catFilter, offset, limit],
    queryFn: () => expensesApi.list({ start_date: startDate, end_date: endDate, category_id: catFilter, limit, offset }).then(r => r.data),
  })

  const pageExpenses = expensesData.items

  const { data: summary = [] } = useQuery({
    queryKey: ['mgmt-expense-summary', startDate, endDate],
    queryFn: () => expensesApi.summary({ start_date: startDate, end_date: endDate }).then(r => r.data),
  })

  const totalExpenses = summary.reduce((s: number, item: any) => s + (item.total || 0), 0)

  const createMut = useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess: (_r: any, data: any) => {
      toast.success('Expense added')
      defaults.set('exp_category', data.category_id ?? '')
      defaults.set('exp_method', data.payment_method ?? 'CASH')
      qc.invalidateQueries({ queryKey: ['mgmt-expenses'] })
      setShowForm(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => expensesApi.update(id, data),
    onSuccess: () => { toast.success('Expense updated'); qc.invalidateQueries({ queryKey: ['mgmt-expenses'] }); setEditing(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => { toast.success('Expense deleted'); qc.invalidateQueries({ queryKey: ['mgmt-expenses'] }); setDeleteTarget(null) },
  })

  const expenseColumns = [
    { key: 'date', header: 'Date' },
    { key: 'category_name', header: 'Category', render: (e: any) => <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">{e.category_name}</span> },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', align: 'right' as const, render: (e: any) => <span className="font-medium">LKR {e.amount.toLocaleString()}</span> },
    { key: 'payment_method', header: 'Payment', render: (e: any) => <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{e.payment_method}</span> },
    { key: 'reference', header: 'Reference', render: (e: any) => <span className="text-gray-400">{e.reference}</span> },
    {
      key: 'actions', header: 'Actions', align: 'center' as const,
      render: (e: any) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => { setEditing(e); setShowForm(true) }} className="p-1 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
          <button onClick={() => setDeleteTarget(e)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  const exportCols = [
    { key: 'date', label: 'Date' },
    { key: 'category_name', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount' },
    { key: 'payment_method', label: 'Payment' },
    { key: 'reference', label: 'Reference' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expense Management"
        subtitle={`${expensesData.total} expenses · LKR ${totalExpenses.toLocaleString()} total`}
        actions={
          <>
            <ExportButton data={pageExpenses} filename="expenses" columns={exportCols} />
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <Plus size={16} /> Add Expense
            </button>
          </>
        }
      />

      <FilterBar>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </FilterBar>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-xl font-bold">LKR {totalExpenses.toLocaleString()}</p>
        </div>
        {summary.slice(0, 3).map((s: any, i: number) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border p-4">
            <p className="text-sm text-gray-500">{s.category}</p>
            <p className="text-xl font-bold">LKR {s.total.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{s.count} entries</p>
          </div>
        ))}
      </div>

      {_isLoading ? (
        <LoadingSpinner label="Loading expenses..." className="py-12" />
      ) : (
        <>
          <DataTable
            columns={expenseColumns}
            data={pageExpenses}
            emptyState={<EmptyState icon={<Receipt size={28} />} title="No expenses found" description="No expenses match your filters." />}
          />
          <Pagination total={expensesData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Add'} Expense</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data = Object.fromEntries(fd)
              data.amount = String(parseFloat(data.amount as string) || 0)
              if (editing) updateMut.mutate({ id: editing.id, data })
              else createMut.mutate(data)
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <input name="date" type="date" defaultValue={editing?.date || todayISO()} required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select name="category_id" defaultValue={editing?.category_id || defaults.get('exp_category') || ''} required className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select Category *</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="amount" type="number" step="0.01" defaultValue={editing?.amount} placeholder="Amount *" required className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input name="description" defaultValue={editing?.description} placeholder="Description" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select name="payment_method" defaultValue={editing?.payment_method || defaults.get('exp_method') || 'CASH'} className="px-3 py-2 border rounded-lg text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
                <input name="reference" defaultValue={editing?.reference} placeholder="Reference" className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <textarea name="notes" defaultValue={editing?.notes} placeholder="Notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">{createMut.isPending || updateMut.isPending ? 'Saving…' : (editing ? 'Update' : 'Add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        message={`Delete this expense (LKR ${deleteTarget?.amount?.toLocaleString() ?? ''})?`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
