import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentsApi, customersApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, Trash2, X } from 'lucide-react'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { todayISO } from '../../../lib/date'
import { useDefaults } from '../../../components/ops'
import { invalidateResource } from '../../../cache/invalidation'

const METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE']
const PAGE_SIZE = 20
const LIST_LIMIT = 500

export default function ManagementPayments() {
  const qc = useQueryClient()
  const defaults = useDefaults()
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [customerId, setCustomerId] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const flow = useEnterFlow()

  useEffect(() => {
    setOffset(0)
  }, [customerId])

  useEscape(showForm, useCallback(() => setShowForm(false), []))

  const { data: customersData = { items: [] } } = useQuery({
    queryKey: ['mgmt-customers-list'],
    queryFn: () => customersApi.list('', LIST_LIMIT, 0).then(r => r.data),
  })

  const customers = customersData.items

  const { data: paymentsData = { items: [], total: 0 }, isLoading: _isLoading } = useQuery({
    queryKey: ['mgmt-payments', customerId, offset, limit],
    queryFn: () => paymentsApi.list({ customer_id: customerId, limit, offset }).then(r => r.data),
  })

  const payments = paymentsData.items

  const createMut = useMutation({
    mutationFn: (data: any) => paymentsApi.create(data),
    onSuccess: (_r: any, data: any) => {
      toast.success('Payment recorded')
      defaults.set('pay_customer', data.customer_id ?? '')
      defaults.set('pay_method', data.payment_method ?? 'CASH')
      invalidateResource(qc, 'mgmtPayments')
      setShowForm(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => paymentsApi.remove(id),
    onSuccess: () => { toast.success('Payment deleted'); invalidateResource(qc, 'mgmtPayments'); setDeleteTarget(null) },
  })

  const totalPaid = payments.reduce((s: number, p: any) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Payments</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <div className="flex gap-3 items-end">
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Customers</option>
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Payments</p>
          <p className="text-xl font-bold">LKR {totalPaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2.5 text-left">Date</th>
              <th className="px-3 py-2.5 text-left">Customer</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5 text-left">Method</th>
              <th className="px-3 py-2.5 text-left">Reference</th>
              <th className="px-3 py-2.5 text-left">Notes</th>
              <th className="px-3 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2">{p.payment_date}</td>
                <td className="px-3 py-2 font-medium">{p.customer_name}</td>
                <td className="px-3 py-2 text-right font-medium text-green-600">LKR {p.amount.toLocaleString()}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{p.payment_method}</span></td>
                <td className="px-3 py-2 text-gray-400">{p.reference}</td>
                <td className="px-3 py-2 text-gray-400">{p.notes}</td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => setDeleteTarget(p)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <TableEmptyRow colSpan={7} title="No payments recorded" description="Payments recorded for staff will appear here." />
            )}
          </tbody>
        </table>
      </div>

      <Pagination total={paymentsData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Record Payment</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data = Object.fromEntries(fd)
              data.amount = String(parseFloat(data.amount as string) || 0)
              createMut.mutate(data)
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <select name="customer_id" defaultValue={defaults.get('pay_customer') || ''} required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">Select Customer *</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="amount" type="number" step="0.01" placeholder="Amount *" required className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select name="payment_method" defaultValue={defaults.get('pay_method') || 'CASH'} className="px-3 py-2 border rounded-lg text-sm">
                  {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
                <input name="payment_date" type="date" defaultValue={todayISO()} required className="px-3 py-2 border rounded-lg text-sm" />
              </div>
              <input name="reference" placeholder="Reference" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <textarea name="notes" placeholder="Notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed">{createMut.isPending ? 'Saving…' : 'Save Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Payment"
        message={`Delete this payment of LKR ${deleteTarget?.amount?.toLocaleString() ?? ''}?`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
