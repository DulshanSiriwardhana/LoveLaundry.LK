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
          <h1 className="text-[22px] font-semibold text-[#111827] tracking-tight">Staff Management</h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">Manage your laundry team members</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B91C1C] transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Total Staff', value: workers.length, icon: UsersThree, color: 'text-[#6366F1]' },
          { label: 'Active Now', value: activeCount, icon: UserCircle, color: 'text-[#10B981]' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-sm">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[#F9FAFB] ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-[22px] font-bold text-[#111827] leading-none">{s.value}</p>
              <p className="text-[12px] text-[#6B7280] mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search staff by name, department, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all"
          />
        </div>
        <div className="relative">
          <FunnelSimple size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-8 py-2.5 text-[13px] text-[#111827] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase().replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden px-6 py-16">
          <ErrorState
            title="Couldn't load staff"
            description="We couldn't reach the server. Please check your connection and try again."
          />
        </div>
      ) : (
      <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-[#F2F4F7]">
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
            <UsersThree size={40} className="mx-auto mb-3 text-[#D1D5DB]" />
            <p className="text-[14px] font-medium text-[#374151]">
              {search || deptFilter !== 'all' ? 'No staff match your filters' : 'No staff yet'}
            </p>
            <p className="text-[12px] text-[#9CA3AF] mt-1">
              {search || deptFilter !== 'all' ? 'Try a different search or filter' : 'Add your first team member to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Name</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Department</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Phone</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">Joined</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map(w => (
                  <tr key={w.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-[11px] font-bold text-[#6B7280] uppercase shrink-0">
                          {w.worker_name.slice(0, 2)}
                        </div>
                        <span className="text-[13px] font-medium text-[#111827]">{w.worker_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#374151] capitalize">{w.department.toLowerCase().replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#6B7280]">{w.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${w.is_active ? statusColors.active : statusColors.inactive}`}>
                        {w.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[#9CA3AF]">{w.joined_date ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(w)}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <PencilSimple size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(w)}
                          className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
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
              className="w-full max-w-md rounded-xl bg-white shadow-xl border border-[#E5E7EB]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
                <h3 className="text-[15px] font-semibold text-[#111827]">
                  {editWorker ? 'Edit Staff' : 'Add Staff'}
                </h3>
                <button
                  onClick={() => setDialogOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                >
                  <X size={16} className="text-[#6B7280]" />
                </button>
              </div>

              <div ref={flow.ref} onKeyDown={flow.handleKeyDown} className="px-5 py-4 space-y-4">
                <div>
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.worker_name}
                    onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))}
                    placeholder="e.g. Ravi Kumar"
                    autoFocus
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[12px] font-medium text-[#374151] block mb-1">Department</label>
                    <select
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-[13px] text-[#111827] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all appearance-none cursor-pointer"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase().replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-[#374151] block mb-1">Phone</label>
                    <input
                      type="text"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[#374151] block mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-[13px] text-[#111827] placeholder-[#9CA3AF] focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 transition-all"
                  />
                </div>
                {editWorker && (
                  <div className="flex items-center gap-3">
                    <label className="text-[12px] font-medium text-[#374151]">Active</label>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-[#16A34A]' : 'bg-[#D1D5DB]'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#F3F4F6]">
                <button
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.worker_name.trim() || createWorker.isPending || updateWorker.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#DC2626] text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
              className="w-full max-w-sm rounded-xl bg-white shadow-xl border border-[#E5E7EB]"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 mb-3">
                  <TrashSimple size={18} className="text-[#DC2626]" />
                </div>
                <p className="text-[14px] font-semibold text-[#111827]">Remove Staff?</p>
                <p className="text-[12px] text-[#6B7280] mt-1">
                  This will permanently remove <strong>{deleteConfirm.worker_name}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 px-5 py-3.5 border-t border-[#F3F4F6]">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 rounded-lg text-[13px] font-medium text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteWorker.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#DC2626] text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 transition-colors cursor-pointer"
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
