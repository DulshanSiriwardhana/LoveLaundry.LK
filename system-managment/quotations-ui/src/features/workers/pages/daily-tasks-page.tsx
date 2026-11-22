import { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  MagnifyingGlass,
  CalendarBlank,
  Clock,
  ClipboardText,
  FunnelSimple,
  X,
  Check,
  TrashSimple,
  PencilSimple,
  User,
  Users,
  Package,
  TShirt,
  ArrowsClockwise,
  HandPalm,
  Cube,
  Tag,
  ListChecks,
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkers, useDailyTasks, useCreateDailyTask, useUpdateDailyTask, useDeleteDailyTask, useGatePassesForWorker } from '../hooks/useWorkers'
import type { DailyLog, DailyLogCreate, TaskEntry, Worker } from '../types'
import type { GatePass, GatePassItem } from '../../../types/operations'
import { ErrorState } from '../../../components/ui/error-state'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { addDaysISO, todayISO } from '../../../lib/time'

const taskTypes = [
  { value: 'WASHING', label: 'Washing', icon: ArrowsClockwise, color: 'bg-blue-50 text-blue-600' },
  { value: 'PRESSING', label: 'Pressing', icon: HandPalm, color: 'bg-orange-50 text-orange-600' },
  { value: 'FOLDING', label: 'Folding', icon: Cube, color: 'bg-purple-50 text-purple-600' },
  { value: 'PACKING', label: 'Packing', icon: Package, color: 'bg-green-50 text-green-600' },
  { value: 'STAIN_TREATMENT', label: 'Stain Removal', icon: TShirt, color: 'bg-pink-50 text-pink-600' },
  { value: 'DRY_CLEANING', label: 'Dry Cleaning', icon: Tag, color: 'bg-teal-50 text-teal-600' },
  { value: 'MACHINE_CLEANING', label: 'Machine Clean', icon: ArrowsClockwise, color: 'bg-cyan-50 text-cyan-600' },
  { value: 'SORTING_TAGGING', label: 'Sorting', icon: Tag, color: 'bg-amber-50 text-amber-600' },
  { value: 'DELIVERY_SUPPORT', label: 'Delivery', icon: Package, color: 'bg-indigo-50 text-indigo-600' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Cube, color: 'bg-gray-50 text-gray-600' },
  { value: 'OTHER', label: 'Other', icon: Tag, color: 'bg-gray-50 text-gray-600' },
]

const taskTypeMap = Object.fromEntries(taskTypes.map(t => [t.value, t]))

function today() {
  return todayISO()
}

function getDateRange(start: string, days: number) {
  const dates: string[] = []
  let current = start
  for (let i = 0; i < days; i++) {
    dates.push(current)
    current = addDaysISO(current, 1)
  }
  return dates
}

export function DailyTasksPage() {
  const { data: workers = [], isLoading: loadingWorkers } = useWorkers()
  const [selectedDate, setSelectedDate] = useState(today())
  const [dateRangeDays, setDateRangeDays] = useState(7)
  const [workerFilter, setWorkerFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<{ log: DailyLog; taskIndex: number; task: TaskEntry } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ log: DailyLog; taskIndex: number; task: TaskEntry } | null>(null)

  const dateRange = useMemo(() => getDateRange(selectedDate, dateRangeDays), [selectedDate, dateRangeDays])
  const { data: gatePasses = [] } = useGatePassesForWorker()

  const { data: allLogs = [], isLoading: loadingTasks, isError } = useDailyTasks({
    date_from: dateRange[0],
    date_to: dateRange[dateRange.length - 1],
  })

  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      const workerMatch =
        workerFilter === 'all' ||
        log.worker_name === workerFilter ||
        (log.team_members ?? []).includes(workerFilter)
      if (!workerMatch) return false
      const q = search.toLowerCase()
      if (!q) return true
      return (
        log.worker_name.toLowerCase().includes(q) ||
        log.tasks.some(t =>
          t.description?.toLowerCase().includes(q) ||
          t.task_type.toLowerCase().includes(q) ||
          t.gate_pass_number?.toLowerCase().includes(q)
        )
      )
    })
  }, [allLogs, workerFilter, search])

  const createTask = useCreateDailyTask()
  const updateTask = useUpdateDailyTask()
  const deleteTask = useDeleteDailyTask()

  const stats = useMemo(() => {
    const logsInRange = allLogs.filter(l => dateRange.includes(l.work_date))
    const totalTasks = logsInRange.reduce((sum, l) => sum + l.tasks.length, 0)
    const totalHours = logsInRange.reduce((sum, l) =>
      sum + l.tasks.reduce((s, t) => s + (t.hours_spent ?? 0), 0), 0)
    const gatePassRefs = new Set(
      logsInRange.flatMap(l => l.tasks.filter(t => t.gate_pass_number).map(t => t.gate_pass_number))
    ).size
    return { totalTasks, totalHours: totalHours.toFixed(1), gatePassRefs, uniqueWorkers: new Set(logsInRange.flatMap(l => l.is_group_work ? (l.team_members ?? []) : [l.worker_name])).size }
  }, [allLogs, dateRange])

  const openCreate = () => {
    setEditEntry(null)
    setDialogOpen(true)
  }

  const openEdit = (log: DailyLog, taskIndex: number, task: TaskEntry) => {
    setEditEntry({ log, taskIndex, task })
    setDialogOpen(true)
  }

  const handleDelete = () => {
    if (!deleteConfirm) return
    const { log, taskIndex } = deleteConfirm
    const updatedTasks = log.tasks.filter((_, i) => i !== taskIndex)
    if (updatedTasks.length === 0) {
      deleteTask.mutate({ logId: log.id })
    } else {
      updateTask.mutate({
        logId: log.id,
        data: {
          worker_name: log.worker_name,
          work_date: log.work_date,
          tasks: updatedTasks,
        },
      })
    }
    setDeleteConfirm(null)
  }

  const getTaskTypeInfo = (t: string) => taskTypeMap[t] ?? taskTypeMap.OTHER

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--text-primary)] tracking-tight">Staff Daily Tasks</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">Track tasks, link to gate passes, monitor productivity</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--danger-deep)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={16} weight="bold" />
          Log Task
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tasks Logged', value: stats.totalTasks, icon: ListChecks, color: 'text-[var(--brand-text)]' },
          { label: 'Hours Spent', value: stats.totalHours, icon: Clock, color: 'text-[var(--danger-text)]' },
          { label: 'Gate Passes', value: stats.gatePassRefs, icon: ClipboardText, color: 'text-[var(--success-text)]' },
          { label: 'Active Staff', value: stats.uniqueWorkers, icon: User, color: 'text-[var(--danger-text)]' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 shadow-sm">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] ${s.color}`}>
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--text-primary)] leading-none">{s.value}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-[var(--border)] rounded-lg px-3 py-2.5 shadow-sm">
          <CalendarBlank size={14} className="text-[var(--text-secondary)]" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-[13px] text-[var(--text-primary)] border-none outline-none bg-transparent cursor-pointer"
          />
          <span className="text-[11px] text-[var(--text-faint)] border-l border-[var(--border)] pl-2 ml-1">to</span>
          <select
            value={dateRangeDays}
            onChange={e => setDateRangeDays(Number(e.target.value))}
            className="text-[13px] text-[var(--text-primary)] border-none outline-none bg-transparent cursor-pointer"
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>

        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="Search tasks, gate passes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
          />
        </div>

        <div className="relative">
          <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <select
            value={workerFilter}
            onChange={e => setWorkerFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white pl-9 pr-8 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Staff</option>
            {workers.map(w => (
              <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <FunnelSimple size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-white pl-9 pr-8 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            {taskTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {isError ? (
          <div className="rounded-xl border border-[var(--border)] bg-white shadow-sm px-6 py-16">
            <ErrorState
              title="Couldn't load tasks"
              description="We couldn't reach the server. Please check your connection and try again."
            />
          </div>
        ) : loadingTasks || loadingWorkers ? (
          <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-16 text-center shadow-sm">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-[var(--danger-deep)] border-t-transparent rounded-full mb-3" />
            <p className="text-[13px] text-[var(--text-secondary)]">Loading tasks...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white px-6 py-16 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] mb-4">
              <ClipboardText size={24} className="text-[var(--text-faint)]" />
            </div>
            <p className="text-[14px] font-medium text-[var(--text-primary)]">
              {search || workerFilter !== 'all' || typeFilter !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks logged yet'}
            </p>
            <p className="text-[12px] text-[var(--text-faint)] mt-1">
              {search || workerFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Log your first task or link one to a gate pass'}
            </p>
            {!search && workerFilter === 'all' && typeFilter === 'all' && (
              <button
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--danger-deep)] text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] transition-colors cursor-pointer"
              >
                <Plus size={14} weight="bold" />
                Log First Task
              </button>
            )}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="rounded-xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-bold text-[var(--text-secondary)] uppercase">
                    {log.is_group_work ? 'GR' : log.worker_name?.slice(0, 2) ?? '??'}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {log.is_group_work ? 'Group Work' : log.worker_name}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {log.work_date} · {log.shift?.replace('_', ' ').toLowerCase()}
                      {log.is_group_work && log.team_members?.length
                        ? ` · ${log.team_members.join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                  <span>{log.tasks.length} task{log.tasks.length !== 1 ? 's' : ''}</span>
                  {log.is_group_work && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--brand-deep)] border border-[var(--brand-border)] text-[10px] font-medium">
                      <Users size={10} /> Group
                    </span>
                  )}
                  <span>{log.attendance_status?.toLowerCase().replace('_', ' ')}</span>
                </div>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {(typeFilter === 'all' ? log.tasks : log.tasks.filter(t => t.task_type === typeFilter)).map((task, idx) => {
                  const tInfo = getTaskTypeInfo(task.task_type)
                  return (
                    <div key={idx} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors group">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 mt-0.5 ${tInfo.color}`}>
                        <tInfo.icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-[var(--text-primary)]">{task.task_type.replace('_', ' ')}</span>
                          {task.gate_pass_number && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[11px] font-medium text-[var(--brand-text)] border border-[var(--brand-border)]">
                              <ClipboardText size={10} />
                              {task.gate_pass_number}
                            </span>
                          )}
                          {task.hours_spent != null && task.hours_spent > 0 && (
                            <span className="text-[11px] text-[var(--text-faint)]">{task.hours_spent}h</span>
                          )}
                          {task.quantity > 0 && (
                            <span className="text-[11px] text-[var(--text-faint)]">{task.quantity} {task.unit?.toLowerCase() ?? 'pcs'}</span>
                          )}
                        </div>
                        {task.description && (
                           <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{task.description}</p>
                         )}
                        {task.remark && (
                           <p className="text-[11px] text-[var(--text-faint)] mt-0.5 line-clamp-1 italic">Remark: {task.remark}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEdit(log, idx, task)}
                          className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <PencilSimple size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ log, taskIndex: idx, task })}
                          className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--danger-deep)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <TrashSimple size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditEntry(null) }}
        editEntry={editEntry}
        workers={workers}
        gatePasses={gatePasses}
        onSubmit={(data) => {
          if (editEntry) {
            const { log, taskIndex } = editEntry
            const updatedTasks = [...log.tasks]
            updatedTasks[taskIndex] = data.tasks[0]
            updateTask.mutate({
              logId: log.id,
              data: {
                worker_name: log.worker_name,
                work_date: log.work_date,
                tasks: updatedTasks,
              },
            }, { onSuccess: () => { setDialogOpen(false); setEditEntry(null) } })
          } else {
            // Avoid creating a duplicate daily log for the same worker + date;
            // merge the new task into the existing log when one already exists.
            const existing = allLogs.find(
              (l) => l.worker_name === data.worker_name && l.work_date === data.work_date
            )
            if (existing) {
              updateTask.mutate({
                logId: existing.id,
                data: {
                  worker_name: existing.worker_name,
                  work_date: existing.work_date,
                  tasks: [...existing.tasks, ...data.tasks],
                },
              }, { onSuccess: () => { setDialogOpen(false) } })
            } else {
              createTask.mutate(data, {
                onSuccess: () => { setDialogOpen(false) },
              })
            }
          }
        }}
        isPending={createTask.isPending || updateTask.isPending}
      />

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
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">Delete Task?</p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  This will permanently remove the <strong>{deleteConfirm.task.task_type.replace('_', ' ')}</strong> entry.
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
                  disabled={deleteTask.isPending || updateTask.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--danger-deep)] text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {(deleteTask.isPending || updateTask.isPending) ? (
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

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  editEntry: { log: DailyLog; taskIndex: number; task: TaskEntry } | null
  workers: Worker[]
  gatePasses: GatePass[]
  onSubmit: (data: DailyLogCreate) => void
  isPending: boolean
}

interface TaskRow {
  key: string
  task_type: string
  description: string
  quantity: string
  unit: string
  hours_spent: string
  remark: string
  gate_pass_id?: string
  gate_pass_number?: string
  fromGatePass?: boolean
}

function GatePassPicker({
  gatePasses,
  gatePassNumber,
  setGatePassNumber,
  search,
  setSearch,
  showPicker,
  setShowPicker,
}: {
  gatePasses: GatePass[]
  gatePassNumber: string
  setGatePassNumber: (v: string) => void
  search: string
  setSearch: (v: string) => void
  showPicker: boolean
  setShowPicker: (v: boolean) => void
}) {
  const filtered = gatePasses.filter(gp =>
    !search ||
    gp.gate_pass_number.toLowerCase().includes(search.toLowerCase()) ||
    gp.client_name.toLowerCase().includes(search.toLowerCase())
  )
  const selected = gatePasses.find(gp => gp.gate_pass_number === gatePassNumber)

  if (gatePassNumber && selected) {
    return (
      <div>
        <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Linked Gate Pass</label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--brand-border)] text-[12px]">
          <ClipboardText size={13} className="text-[var(--brand-text)] shrink-0" />
          <span className="font-medium text-[var(--brand-deep)]">{selected.gate_pass_number}</span>
          <span className="text-[var(--text-secondary)] truncate">— {selected.client_name}, {selected.items.length} items</span>
          <button
            type="button"
            onClick={() => { setGatePassNumber(''); setSearch('') }}
            className="ml-auto p-0.5 rounded hover:bg-[var(--brand-border)] cursor-pointer shrink-0"
            aria-label="Clear gate pass"
          >
            <X size={13} className="text-[var(--brand-text)]" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Link to Gate Pass (optional)</label>
      <div className="relative">
        <ClipboardText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowPicker(true) }}
          onFocus={() => setShowPicker(true)}
          placeholder="Search gate pass number or client..."
          className="w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
        />
        {showPicker && filtered.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-white shadow-lg">
            {filtered.slice(0, 20).map(gp => (
              <button
                type="button"
                key={gp.gate_pass_number}
                onClick={() => { setGatePassNumber(gp.gate_pass_number); setSearch(''); setShowPicker(false) }}
                className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors border-b border-[var(--border)] last:border-0 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{gp.gate_pass_number}</span>
                  <span className="text-[11px] text-[var(--text-faint)]">{gp.receiving_date}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{gp.client_name} · {gp.items.length} item{gp.items.length !== 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskDialog({ open, onClose, editEntry, workers, gatePasses, onSubmit, isPending }: TaskDialogProps) {

  const isEdit = !!editEntry
  const [workerName, setWorkerName] = useState(editEntry?.log.worker_name ?? (workers[0]?.worker_name ?? ''))
  const [isGroup, setIsGroup] = useState(!!editEntry?.log.is_group_work)
  const [teamMembers, setTeamMembers] = useState<string[]>(editEntry?.log.team_members ?? [])
  const [workDate, setWorkDate] = useState(editEntry?.log.work_date ?? today())
  const [taskType, setTaskType] = useState(editEntry?.task.task_type ?? 'WASHING')
  const [gatePassNumber, setGatePassNumber] = useState(editEntry?.task.gate_pass_number ?? '')
  const [gatePassSearch, setGatePassSearch] = useState('')
  const [showGatePassPicker, setShowGatePassPicker] = useState(false)
  const [rows, setRows] = useState<TaskRow[]>([])
  const [editDescription, setEditDescription] = useState(editEntry?.task.description ?? '')
  const [editQuantity, setEditQuantity] = useState(editEntry?.task.quantity?.toString() ?? '')
  const [editUnit, setEditUnit] = useState(editEntry?.task.unit ?? 'PIECES')
  const [editHours, setEditHours] = useState(editEntry?.task.hours_spent?.toString() ?? '')
  const [editRemark, setEditRemark] = useState(editEntry?.task.remark ?? '')

  const selectedGatePass = gatePasses.find(gp => gp.gate_pass_number === gatePassNumber)

  // Reset all state every time the dialog (re)opens.
  useEffect(() => {
    if (!open) return
    setWorkerName(editEntry?.log.worker_name ?? (workers[0]?.worker_name ?? ''))
    setIsGroup(!!editEntry?.log.is_group_work)
    setTeamMembers(editEntry?.log.team_members ?? [])
    setWorkDate(editEntry?.log.work_date ?? today())
    setTaskType(editEntry?.task.task_type ?? 'WASHING')
    setGatePassNumber(editEntry?.task.gate_pass_number ?? '')
    setGatePassSearch('')
    setShowGatePassPicker(false)
    setRows([])
    setEditDescription(editEntry?.task.description ?? '')
    setEditQuantity(editEntry?.task.quantity?.toString() ?? '')
    setEditUnit(editEntry?.task.unit ?? 'PIECES')
    setEditHours(editEntry?.task.hours_spent?.toString() ?? '')
    setEditRemark(editEntry?.task.remark ?? '')
  }, [open, editEntry])

  const addGatePassItem = (item: GatePassItem) => {
    if (!selectedGatePass) return
    const key = `gp:${selectedGatePass.gate_pass_number}:${item.item_name}`
    setRows(prev => prev.some(r => r.key === key)
      ? prev
      : [...prev, {
          key,
          task_type: taskType,
          description: item.category ? `${item.item_name} (${item.category})` : item.item_name,
          quantity: String(item.received_qty),
          unit: 'PIECES',
          hours_spent: '',
          remark: '',
          gate_pass_id: selectedGatePass.id,
          gate_pass_number: selectedGatePass.gate_pass_number,
          fromGatePass: true,
        }])
  }

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key))

  const addManualRow = () => setRows(prev => [...prev, {
    key: `manual:${Date.now()}:${prev.length}`,
    task_type: taskType,
    description: '',
    quantity: '1',
    unit: 'PIECES',
    hours_spent: '',
    remark: '',
    fromGatePass: false,
  }])

  const updateRow = (key: string, patch: Partial<TaskRow>) =>
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  const grid = useDataGrid({ columns: 6, rows: rows.length, onAppendRow: addManualRow })

  const handleCreateSubmit = () => {
    const tasks: TaskEntry[] = rows.map(r => ({
      task_type: r.task_type,
      description: r.description.trim() || undefined,
      quantity: parseFloat(r.quantity) || 0,
      unit: r.unit,
      hours_spent: r.hours_spent ? parseFloat(r.hours_spent) : undefined,
      remark: r.remark.trim() || undefined,
      gate_pass_id: r.gate_pass_id,
      gate_pass_number: r.gate_pass_number,
    }))
    if (isGroup) {
      if (teamMembers.length < 2 || rows.length === 0) return
      onSubmit({
        worker_name: teamMembers.join(' + '),
        work_date: workDate,
        tasks,
        is_group_work: true,
        team_members: teamMembers,
      })
    } else {
      if (!workerName.trim() || rows.length === 0) return
      onSubmit({ worker_name: workerName, work_date: workDate, tasks })
    }
  }

  const handleEditSubmit = () => {
    if (!workerName.trim()) return
    onSubmit({
      worker_name: workerName,
      work_date: workDate,
      tasks: [{
        task_type: taskType,
        description: editDescription.trim() || undefined,
        quantity: parseFloat(editQuantity) || 0,
        unit: editUnit,
        hours_spent: editHours ? parseFloat(editHours) : undefined,
        remark: editRemark.trim() || undefined,
        gate_pass_id: selectedGatePass?.id,
        gate_pass_number: selectedGatePass?.gate_pass_number,
      }],
    })
  }

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {editEntry ? 'Edit Task' : 'Log New Task'}
          </h3>
          <button onClick={onClose} aria-label="Close dialog" className="p-1 rounded-lg hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
            <X size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[12px] font-medium text-[var(--text-primary)]">Staff *</label>
                {!isEdit && (
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isGroup}
                      onChange={e => setIsGroup(e.target.checked)}
                      className="accent-[var(--danger-deep)] w-3.5 h-3.5"
                    />
                    Group work
                  </label>
                )}
              </div>
              {isEdit ? (
                <input
                  value={workerName}
                  disabled
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] bg-[var(--surface-2)] disabled:opacity-60 cursor-not-allowed"
                />
              ) : isGroup ? (
                <div className="rounded-lg border border-[var(--border)] p-2 max-h-40 overflow-y-auto space-y-1 bg-white">
                  {workers.map(w => {
                    const checked = teamMembers.includes(w.worker_name)
                    return (
                      <label key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--surface-2)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e =>
                            setTeamMembers(prev =>
                              e.target.checked
                                ? [...prev, w.worker_name]
                                : prev.filter(n => n !== w.worker_name)
                            )
                          }
                          className="accent-[var(--danger-deep)] w-4 h-4 shrink-0"
                        />
                        <span className="text-[13px] text-[var(--text-primary)]">{w.worker_name}</span>
                      </label>
                    )
                  })}
                  {teamMembers.length > 0 && (
                    <p className="text-[11px] text-[var(--text-secondary)] px-2 pt-1">{teamMembers.length} member(s) selected</p>
                  )}
                </div>
              ) : (
                <select
                  value={workerName}
                  onChange={e => setWorkerName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Date *</label>
              <input
                type="date"
                value={workDate}
                onChange={e => setWorkDate(e.target.value)}
                disabled={isEdit}
                className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {isEdit ? (
            <>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Task Type *</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {taskTypes.map(t => {
                    const isSelected = taskType === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTaskType(t.value)}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[var(--danger-deep)] text-white border-[var(--danger-deep)] shadow-sm'
                            : 'bg-white text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--border)] hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <t.icon size={16} className={isSelected ? 'text-white' : 'text-[var(--text-secondary)]'} />
                        <span className="truncate w-full text-center">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={editQuantity}
                    onChange={e => setEditQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Unit</label>
                  <select
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
                  >
                    <option value="PIECES">Pieces</option>
                    <option value="KG">Kg</option>
                    <option value="LOADS">Loads</option>
                    <option value="HOURS">Hours</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Hours Spent</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editHours}
                    onChange={e => setEditHours(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                  />
                </div>
              </div>

              <GatePassPicker
                gatePasses={gatePasses}
                gatePassNumber={gatePassNumber}
                setGatePassNumber={setGatePassNumber}
                search={gatePassSearch}
                setSearch={setGatePassSearch}
                showPicker={showGatePassPicker}
                setShowPicker={setShowGatePassPicker}
              />

              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Item / Service</label>
                <input
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="e.g. 20 shirts, Washing load A"
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">Remark</label>
                <textarea
                  value={editRemark}
                  onChange={e => setEditRemark(e.target.value)}
                  placeholder="Optional remark about this task..."
                  rows={2}
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <GatePassPicker
                gatePasses={gatePasses}
                gatePassNumber={gatePassNumber}
                setGatePassNumber={setGatePassNumber}
                search={gatePassSearch}
                setSearch={setGatePassSearch}
                showPicker={showGatePassPicker}
                setShowPicker={setShowGatePassPicker}
              />

              {selectedGatePass && (
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] mb-2">
                    Items in {selectedGatePass.gate_pass_number} — select what was worked on
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {selectedGatePass.items.map((item, i) => {
                      const checked = rows.some(r => r.key === `gp:${selectedGatePass.gate_pass_number}:${item.item_name}`)
                      return (
                        <label key={`${item.item_name}-${i}`} className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[var(--surface-2)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => e.target.checked ? addGatePassItem(item) : removeRow(`gp:${selectedGatePass.gate_pass_number}:${item.item_name}`)}
                            className="accent-[var(--danger-deep)] w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{item.item_name}{item.category ? ` (${item.category})` : ''}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">Client: {item.client_qty} · Received: {item.received_qty}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-[var(--text-primary)]">Tasks to log ({rows.length})</p>
                <button
                  type="button"
                  onClick={addManualRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                >
                  <Plus size={13} weight="bold" /> Add item manually
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="text-[12px] text-[var(--text-faint)] text-center py-4 border border-dashed border-[var(--border)] rounded-lg">
                  Select gate pass items above, or add an item manually
                </p>
              ) : (
                <div onKeyDown={grid.handleKeyDown} className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {rows.map((row, ri) => (
                    <div key={row.key} className="rounded-lg border border-[var(--border)] p-3 space-y-2 bg-[var(--surface-2)]">
                      <div className="flex items-center gap-2">
                        <select
                          ref={grid.registerCell(ri, 0)}
                          value={row.task_type}
                          onChange={e => updateRow(row.key, { task_type: e.target.value })}
                          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
                        >
                          {taskTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        {row.fromGatePass && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-medium text-[var(--brand-text)] border border-[var(--brand-border)]">
                            <ClipboardText size={9} /> GP
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          className="ml-auto p-1 rounded hover:bg-[var(--surface-2)] cursor-pointer"
                          aria-label="Remove"
                        >
                          <TrashSimple size={13} className="text-[var(--text-faint)] hover:text-[var(--danger-deep)]" />
                        </button>
                      </div>
                      <input
                        ref={grid.registerCell(ri, 1)}
                        value={row.description}
                        onChange={e => updateRow(row.key, { description: e.target.value })}
                        placeholder="Item / service description"
                        className="w-full rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          ref={grid.registerCell(ri, 2)}
                          type="number" min="0"
                          value={row.quantity}
                          onChange={e => updateRow(row.key, { quantity: e.target.value })}
                          placeholder="Qty"
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                        />
                        <select
                          ref={grid.registerCell(ri, 3)}
                          value={row.unit}
                          onChange={e => updateRow(row.key, { unit: e.target.value })}
                          className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all appearance-none cursor-pointer"
                        >
                          {['PIECES', 'KG', 'LOADS', 'HOURS'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          ref={grid.registerCell(ri, 4)}
                          type="number" step="0.5" min="0"
                          value={row.hours_spent}
                          onChange={e => updateRow(row.key, { hours_spent: e.target.value })}
                          placeholder="Hrs"
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                        />
                      </div>
                      <input
                        ref={grid.registerCell(ri, 5)}
                        value={row.remark}
                        onChange={e => updateRow(row.key, { remark: e.target.value })}
                        placeholder="Remark (optional)"
                        className="w-full rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10 transition-all"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleEditSubmit : handleCreateSubmit}
            disabled={(isGroup ? teamMembers.length < 2 : !workerName.trim()) || (!isEdit && rows.length === 0) || isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--danger-deep)] text-[13px] font-semibold text-white hover:bg-[var(--danger-deep)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isPending ? (
              <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Check size={14} weight="bold" />
            )}
            {editEntry ? 'Save Changes' : 'Log Task'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
