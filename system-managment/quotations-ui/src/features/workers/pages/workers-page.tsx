import { useState } from 'react'
import {
  Plus,
  MagnifyingGlass,
  UsersThree,
  UserCircle,
  PencilSimple,
  TrashSimple,
  X,
  Check,
  FunnelSimple,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkers, useCreateWorker, useUpdateWorker, useDeleteWorker } from '../hooks/useWorkers'
import { DEPARTMENTS } from '../types'
import type { Worker } from '../types'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'

const statusColors = {
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  inactive: 'bg-gray-50 text-gray-500 border border-gray-200',
}

export function WorkersPage() {
  const { data: workers = [], isLoading, isError } = useWorkers()
  const createWorker = useCreateWorker()
  const updateWorker = useUpdateWorker()
  const deleteWorker = useDeleteWorker()

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editWorker, setEditWorker] = useState<Worker | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Worker | null>(null)
  const flow = useEnterFlow<HTMLDivElement>()
  useEscape(dialogOpen, () => setDialogOpen(false))
  useEscape(!!deleteConfirm, () => setDeleteConfirm(null))
  const [form, setForm] = useState({
    worker_name: '',
    department: 'GENERAL',
    phone: '',
    is_active: true,
    notes: '',
  })

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    const matchSearch = !q || w.worker_name.toLowerCase().includes(q) || w.department.toLowerCase().includes(q) || w.phone?.toLowerCase().includes(q)
    const matchDept = deptFilter === 'all' || w.department === deptFilter
    return matchSearch && matchDept
  })

  const activeCount = workers.filter(w => w.is_active).length

  const openCreate = () => {
    setEditWorker(null)
    setForm({ worker_name: '', department: 'GENERAL', phone: '', is_active: true, notes: '' })
    setDialogOpen(true)
  }

  const openEdit = (w: Worker) => {
    setEditWorker(w)
    setForm({
      worker_name: w.worker_name,
      department: w.department,
      phone: w.phone ?? '',
      is_active: w.is_active,
      notes: w.notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    if (!form.worker_name.trim()) return
    if (editWorker) {
      updateWorker.mutate({ id: editWorker.id, data: form }, {
        onSuccess: () => { setDialogOpen(false); setEditWorker(null) },
      })
    } else {
      createWorker.mutate({ ...form, is_active: true }, {
        onSuccess: () => { setDialogOpen(false) },
      })
    }
  }

  const handleDelete = () => {
    if (!deleteConfirm) return
    deleteWorker.mutate(deleteConfirm.id, {
      onSuccess: () => { setDeleteConfirm(null) },
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">Staff Management</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Manage your laundry team members</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--danger-deep)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Total Staff', value: workers.length, icon: UsersThree, color: 'text-[var(--brand-text)]' },
          { label: 'Active Now', value: activeCount, icon: UserCircle, color: 'text-[var(--success-text)]' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[22px] font-bold text-[var(--text-primary)] leading-none">{s.value}</p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search staff by name, department, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
          />
        </div>
        <div className="relative">
          <FunnelSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white pl-9 pr-8 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase().replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden px-6 py-16">
          <ErrorState
            title="Couldn't load staff"
            description="We couldn't reach the server. Please check your connection and try again."
          />
        </div>
      ) : (
      <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[var(--border)]">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersThree size={40} className="mx-auto mb-3 text-[var(--text-primary)]" />
            <p className="text-[14px] font-medium text-[var(--text-primary)]">
              {search || deptFilter !== 'all' ? 'No staff match your filters' : 'No staff yet'}
            </p>
            <p className="text-[12px] text-[var(--text-faint)] mt-1">
              {search || deptFilter !== 'all' ? 'Try a different search or filter' : 'Add your first team member to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Department</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Phone</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Joined</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map(w => (
                  <tr key={w.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-bold text-[var(--text-secondary)] uppercase shrink-0">
                          {w.worker_name.slice(0, 2)}
                        </div>
                        <span className="text-[13px] font-medium text-[var(--text-primary)]">{w.worker_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[var(--text-primary)] capitalize">{w.department.toLowerCase().replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[var(--text-secondary)]">{w.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${w.is_active ? statusColors.active : statusColors.inactive}`}>
                        {w.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[var(--text-faint)]">{w.joined_date ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(w)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <PencilSimple size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(w)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger-deep)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <TrashSimple size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setDialogOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[var(--border)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {editWorker ? 'Edit Staff' : 'Add Staff'}
                </h3>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <X size={16} className="text-[var(--text-secondary)]" />
                </button>
              </div>

              <div ref={flow.ref} onKeyDown={flow.handleKeyDown} className="px-5 py-4 space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.worker_name}
                    onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))}
                    placeholder="e.g. Ravi Kumar"
                    autoFocus
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Department</label>
                    <select
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase().replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                  />
                </div>
                {editWorker && (
                  <div className="flex items-center gap-3">
                    <label className="text-[12px] font-medium text-[var(--text-primary)]">Active</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-[var(--success-text)]' : 'bg-[var(--border-2)]'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)]">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.worker_name.trim() || createWorker.isPending || updateWorker.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--danger-deep)] text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {(createWorker.isPending || updateWorker.isPending) ? (
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Check size={14} weight="bold" />
                  )}
                  {editWorker ? 'Save Changes' : 'Add Staff'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[var(--border)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 mb-3">
                  <TrashSimple size={18} className="text-[var(--danger-deep)]" />
                </div>
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">Remove Staff?</p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  This will permanently remove <strong>{deleteConfirm.worker_name}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 px-5 py-3.5 border-t border-[var(--border)]">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-primary)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteWorker.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--danger-deep)] text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {deleteWorker.isPending ? (
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
