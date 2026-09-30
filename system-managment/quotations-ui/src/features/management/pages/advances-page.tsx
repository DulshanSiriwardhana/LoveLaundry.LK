import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, advancesApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, X, Trash2 } from 'lucide-react'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { Pagination } from '../../../components/ui/pagination'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { todayISO } from '../../../lib/date'
import { invalidateResource } from '../../../cache/invalidation'

const PAGE_SIZE = 20

export default function AdvancesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [empFilter, setEmpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('OUTSTANDING')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const flow = useEnterFlow()
  useEscape(showForm, () => setShowForm(false))

  useEffect(() => {
    setOffset(0)
  }, [empFilter, statusFilter])

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data),
  })

  const { data: advancesData = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['advances', empFilter, statusFilter, offset, limit],
    queryFn: () => advancesApi.list({
      employee_id: empFilter || undefined,
      status: statusFilter || undefined,
      limit,
      offset,
    }).then(r => r.data),
  })

  const advances = advancesData.items

  const createMut = useMutation({
    mutationFn: (data: any) => advancesApi.create(data),
    onSuccess: () => {
      toast.success('Advance recorded')
      setShowForm(false)
      invalidateResource(qc, 'advances')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => advancesApi.cancel(id),
    onSuccess: () => {
      toast.success('Advance cancelled')
      setCancelTarget(null)
      invalidateResource(qc, 'advances')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const totalOutstanding = advances
    .filter((a: any) => a.status === 'OUTSTANDING')
    .reduce((sum: number, a: any) => sum + (a.outstanding || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salary Advances</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          <Plus size={16} /> Record Advance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="text-sm text-gray-500">Total Outstanding</div>
          <div className="text-2xl font-bold text-red-600">LKR {totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="text-sm text-gray-500">Records Shown</div>
          <div className="text-2xl font-bold">{advancesData.total}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Employee</label>
            <select
              value={empFilter}
              onChange={e => setEmpFilter(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All Employees</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">All</option>
              <option value="OUTSTANDING">Outstanding</option>
              <option value="FULLY_DEDUCTED">Fully Deducted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 dark:bg-gray-700/50">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Employee</th>
              <th className="text-right px-4 py-3 font-medium">Amount</th>
              <th className="text-right px-4 py-3 font-medium">Deducted</th>
              <th className="text-right px-4 py-3 font-medium">Outstanding</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8"><LoadingSpinner size="sm" /></td></tr>
            ) : advances.length === 0 ? (
              <TableEmptyRow colSpan={8} title="No advances found" description="Advances recorded for staff will appear here." />
            ) : (
              advances.map((adv: any) => {
                const emp = employees.find((e: any) => e.id === adv.employee_id)
                return (
                  <tr key={adv.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">{adv.date}</td>
                    <td className="px-4 py-3">{emp?.name || adv.employee_id}</td>
                    <td className="px-4 py-3 text-right">LKR {adv.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-green-600">LKR {adv.total_deducted.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">LKR {adv.outstanding.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{adv.reason || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        adv.status === 'OUTSTANDING' ? 'bg-yellow-100 text-yellow-800' :
                        adv.status === 'FULLY_DEDUCTED' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {adv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {adv.status === 'OUTSTANDING' && (
                        <button
                          onClick={() => setCancelTarget(adv.id)}
                          className="p-1.5 hover:bg-red-100 text-red-500 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination total={advancesData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Record Advance</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              createMut.mutate({
                employee_id: fd.get('employee_id'),
                amount: parseFloat(fd.get('amount') as string) || 0,
                date: fd.get('date'),
                reason: fd.get('reason'),
              })
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Employee *</label>
                <select name="employee_id" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Employee</option>
                  {employees.filter((e: any) => e.is_active).map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Amount (LKR) *</label>
                  <input name="amount" type="number" step="0.01" min="0.01" required className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Date *</label>
                  <input name="date" type="date" required defaultValue={todayISO()} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Reason</label>
                <input name="reason" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Reason for advance" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {createMut.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this advance?"
        message="This advance will be marked cancelled and will no longer be deducted from salary."
        confirmLabel="Cancel Advance"
        loading={cancelMut.isPending}
        onConfirm={() => { if (cancelTarget) cancelMut.mutate(cancelTarget) }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
