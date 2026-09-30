import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { holidaysApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, X, Trash2, Calendar } from 'lucide-react'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { todayISO } from '../../../lib/date'

export default function HolidaysPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const flow = useEnterFlow()
  useEscape(showForm, () => setShowForm(false))

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays', yearFilter],
    queryFn: () => holidaysApi.list(yearFilter).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => holidaysApi.create(data),
    onSuccess: () => {
      toast.success('Holiday added')
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['holidays'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => holidaysApi.remove(id),
    onSuccess: () => {
      toast.success('Holiday removed')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['holidays'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Holiday Calendar</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          <Plus size={16} /> Add Holiday
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input
              type="number"
              value={yearFilter}
              onChange={e => setYearFilter(Number(e.target.value))}
              className="w-32 mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="text-sm text-gray-500 py-2">
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} defined
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400 col-span-3"><LoadingSpinner size="sm" /></div>
        ) : holidays.length === 0 ? (
          <div className="col-span-3">
            <EmptyState
              bare
              kind="search"
              title={`No holidays defined for ${yearFilter}`}
              description="Add the public holidays that apply to this year."
            />
          </div>
        ) : (
          holidays.map((h: any) => (
            <div key={h.id} className="bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-red-500" />
                  <h3 className="font-semibold">{h.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">{h.date}</p>
                {h.description && <p className="text-xs text-gray-400 mt-1">{h.description}</p>}
                {h.is_recurring && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                    Recurring
                  </span>
                )}
              </div>
              <button
                onClick={() => setDeleteTarget(h.id)}
                className="p-1.5 hover:bg-red-100 text-red-500 rounded"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Holiday</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              createMut.mutate({
                name: fd.get('name'),
                date: fd.get('date'),
                description: fd.get('description'),
                is_recurring: fd.get('is_recurring') === 'on',
              })
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Holiday Name *</label>
                <input name="name" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. National Day" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Date *</label>
                <input name="date" type="date" required defaultValue={todayISO()} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Description</label>
                <input name="description" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input name="is_recurring" type="checkbox" className="rounded" />
                <label className="text-sm">Recurring annually</label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {createMut.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this holiday?"
        message="This holiday will be permanently removed from the calendar."
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
