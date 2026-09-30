import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, attendanceApi, holidaysApi } from '../api/management-api'
import { toast } from 'sonner'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Trash2, X, Pencil, Plus, Table2 } from 'lucide-react'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { buildStaffSummary, type AttendanceRecord } from '../utils/attendance-summary'
import { buildSalaryForecast } from '../utils/salary-forecast'

const STATUSES = ['PRESENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'ABSENT'] as const
const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present', HALF_DAY: 'Half Day', PAID_LEAVE: 'Paid Leave',
  ON_LEAVE: 'Paid Leave', UNPAID_LEAVE: 'Unpaid Leave', ABSENT: 'Absent',
}
const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  HALF_DAY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  PAID_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  UNPAID_LEAVE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const CELL_STYLE: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  HALF_DAY: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PAID_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ON_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  UNPAID_LEAVE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}
const CELL_CODE: Record<string, string> = {
  PRESENT: 'P', HALF_DAY: 'H', PAID_LEAVE: 'L', ON_LEAVE: 'L', UNPAID_LEAVE: 'U', ABSENT: 'A',
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function monthRange(year: number, month: number) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const numDays = new Date(year, month, 0).getDate()
  const days: string[] = []
  for (let day = 1; day <= numDays; day++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return { days, firstDow, numDays }
}

export default function AttendancePage() {
  const qc = useQueryClient()
  const now = new Date()
  const [selectedEmp, setSelectedEmp] = useState('')
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pickedDates, setPickedDates] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<string>('PRESENT')
  const [bulkOt, setBulkOt] = useState(0)
  const [editDate, setEditDate] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>(null)
  const [quickDate, setQuickDate] = useState<string | null>(null)
  const [quickOt, setQuickOt] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  useEscape(!!editDate, () => setEditDate(null))
  useEscape(!!quickDate, () => setQuickDate(null))
  const todayStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }, [])

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(monthRange(year, month).numDays).padStart(2, '0')}`

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data),
  })

  const { data: attendance = [], isLoading: attLoading } = useQuery({
    queryKey: ['attendance', selectedEmp, year, month],
    queryFn: () => attendanceApi.list(selectedEmp, { start_date: startDate, end_date: endDate }).then(r => r.data),
    enabled: !!selectedEmp,
  })

  const { data: summary } = useQuery({
    queryKey: ['attendance-summary', selectedEmp, year, month],
    queryFn: () => attendanceApi.summary(selectedEmp, startDate, endDate).then(r => r.data),
    enabled: !!selectedEmp,
  })

  const { data: holidaysData } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list(year).then(r => r.data),
  })

  const holidaySet = useMemo(() => {
    const set = new Set<string>()
    for (const h of holidaysData || []) {
      if (h.date) set.add(h.date)
      if (h.start_date && h.start_date !== h.date) set.add(h.start_date)
      if (h.end_date && h.end_date !== h.start_date && h.end_date !== h.date) {
        const d = new Date(h.start_date || h.date)
        const end = new Date(h.end_date)
        while (d <= end) { set.add(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1) }
      }
    }
    return set
  }, [holidaysData])

  const { days, firstDow } = useMemo(() => monthRange(year, month), [year, month])

  const grid = useDataGrid({ columns: 7, rows: Math.max(1, Math.ceil(days.length / 7)) })
  const editFlow = useEnterFlow<HTMLDivElement>()

  const byDate = useMemo(() => {
    const map: Record<string, any> = {}
    for (const rec of attendance) map[rec.date || rec.day] = rec
    return map
  }, [attendance])

  const { data: allRecords = [] } = useQuery({
    queryKey: ['attendance-all', year, month],
    queryFn: () => attendanceApi.listRange(startDate, endDate).then(r => r.data as AttendanceRecord[]),
    enabled: viewMode === 'all',
  })

  const allByEmp = useMemo(
    () => buildStaffSummary(allRecords, holidaysData),
    [allRecords, holidaysData],
  )

  const activeStaff = useMemo(
    () => (employees as any[]).filter(e => e.is_active !== false && e.attendance_required !== false),
    [employees],
  )

  const empDayMap = useMemo(() => {
    const map: Record<string, Record<string, any>> = {}
    for (const rec of allRecords) {
      const empId = rec.employee_id
      const day = rec.date || rec.day
      if (!empId || !day) continue
      map[empId] ??= {}
      map[empId][day] = rec
    }
    return map
  }, [allRecords])

  const createMut = useMutation({
    mutationFn: (data: any) => attendanceApi.create(selectedEmp, data),
    onSuccess: () => {
      toast.success('Attendance saved')
      qc.invalidateQueries({ queryKey: ['attendance', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-summary', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-all'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save attendance'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attendanceApi.update(id, data),
    onSuccess: () => {
      toast.success('Attendance updated')
      setEditDate(null)
      qc.invalidateQueries({ queryKey: ['attendance', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-summary', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-all'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update attendance'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: () => {
      toast.success('Record deleted')
      setEditDate(null)
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['attendance', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-summary', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-all'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete record'),
  })

  const bulkMut = useMutation({
    mutationFn: () => attendanceApi.bulkSet(selectedEmp, Array.from(pickedDates), bulkStatus, bulkOt || undefined),
    onSuccess: () => {
      toast.success(`${pickedDates.size} record(s) saved as ${STATUS_LABEL[bulkStatus] || bulkStatus}`)
      setPickedDates(new Set())
      qc.invalidateQueries({ queryKey: ['attendance', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-summary', selectedEmp] })
      qc.invalidateQueries({ queryKey: ['attendance-all'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Bulk save failed'),
  })

  const togglePick = (d: string) => {
    setPickedDates(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })
  }

  const goPrev = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) } else setMonth(month - 1)
    setPickedDates(new Set()); setEditDate(null); setQuickDate(null)
  }

  const goNext = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) } else setMonth(month + 1)
    setPickedDates(new Set()); setEditDate(null); setQuickDate(null)
  }

  const goToday = () => {
    setYear(now.getFullYear()); setMonth(now.getMonth() + 1)
    setPickedDates(new Set()); setEditDate(null); setQuickDate(null)
  }

  const openEdit = (day: string, rec: any) => {
    setEditDate(day)
    setEditForm({
      status: rec?.status || 'ABSENT',
      overtime_hours: rec?.overtime_hours || 0,
      check_in_time: rec?.check_in_time || '',
      check_out_time: rec?.check_out_time || '',
      notes: rec?.notes || '',
    })
  }

  const saveEdit = () => {
    if (!editDate) return
    const rec = byDate[editDate]
    if (rec?.id) {
      updateMut.mutate({ id: rec.id, data: editForm })
    } else {
      createMut.mutate({ employee_id: selectedEmp, date: editDate, ...editForm })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Entry</h1>
      </div>

      {/* Summary card */}
      {summary && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {summary.start_date} → {summary.end_date}
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
            {[
              { label: 'Worked', value: summary.worked_days, color: 'text-green-600' },
              { label: 'Half Days', value: summary.half_days, color: 'text-amber-600' },
              { label: 'Paid Leave', value: summary.paid_leave_days, color: 'text-blue-600' },
              { label: 'Unpaid', value: summary.unpaid_leave_days + summary.absent_days, color: 'text-red-600' },
              { label: 'OT (hrs)', value: summary.overtime_hours, color: 'text-indigo-600' },
              { label: 'Holidays', value: summary.holiday_count, color: 'text-purple-600' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays size={20} /> Monthly Attendance
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'single' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                Single
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                <Table2 size={14} /> All Staff
              </button>
            </div>
            <button onClick={goPrev} className="p-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700" title="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goToday} className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700" title="Jump to today">
              Today
            </button>
            <button onClick={goNext} className="p-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700" title="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {viewMode === 'single' && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Employee</label>
              <select value={selectedEmp} onChange={e => { setSelectedEmp(e.target.value); setPickedDates(new Set()) }}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Select Employee</option>
                {employees.filter((e: any) => e.is_active && e.attendance_required !== false).map((e: any) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.salary_type || 'MONTHLY'})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input type="number" value={year}
              onChange={e => { setYear(Number(e.target.value)); setPickedDates(new Set()) }}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Month</label>
            <select value={month}
              onChange={e => { setMonth(Number(e.target.value)); setPickedDates(new Set()) }}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'single' ? (<>
        <div className="overflow-x-auto rounded-xl border">
          <div onKeyDown={grid.handleKeyDown} className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 min-w-[560px]">
            {DAY_NAMES.map(dn => (
              <div key={dn} className="bg-gray-50 dark:bg-gray-800 px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase">{dn}</div>
            ))}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`blank-${i}`} className="bg-white dark:bg-gray-800 min-h-20" />
            ))}
            {days.map((d: string, i: number) => {
              const rec = byDate[d]
              const dow = new Date(d + 'T00:00:00').getDay()
              const picked = pickedDates.has(d)
              const isHoliday = holidaySet.has(d)
              const isWeekend = dow === 0 || dow === 6
              const isToday = d === todayStr
              const cellBg = isHoliday
                ? 'bg-purple-50 dark:bg-purple-900/20' : isWeekend
                ? 'bg-slate-50 dark:bg-slate-800/50' : 'bg-white dark:bg-gray-800'
              return (
                <div key={d} onClick={() => togglePick(d)}
                  ref={grid.registerCell(Math.floor(i / 7), i % 7)} tabIndex={0}
                  className={`${cellBg} min-h-20 p-1.5 cursor-pointer flex flex-col gap-1 ${picked ? 'ring-2 ring-indigo-500' : ''} ${isToday ? 'ring-2 ring-red-400' : ''}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${isToday ? 'bg-red-600 text-white rounded-full px-1.5 py-px' : ''}`}>{Number(d.slice(8))}</span>
                    <div className="flex items-center gap-1">
                      {isHoliday && <span className="text-[9px] text-purple-500 font-medium">H</span>}
                      {rec ? (
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(d, rec) }}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[rec.status] || STATUS_STYLE.ABSENT}`}>
                          {STATUS_LABEL[rec.status] || rec.status}
                        </button>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setQuickDate(d); setQuickOt(0) }}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-300 font-medium"
                          title="Quick save status">
                          <Plus size={10} className="inline mr-0.5 -mt-px" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                  {rec?.overtime_hours > 0 && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400">OT {rec.overtime_hours}h</span>
                  )}
                  {picked && <span className="text-[10px] text-indigo-600 flex items-center gap-1"><Check size={10} /> Selected</span>}
                </div>
              )
            })}
          </div>
        </div>

        {attLoading && <p className="text-sm text-gray-500">Loading attendance...</p>}

        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Bulk status</label>
            <div className="relative">
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="w-40 mt-1 px-3 py-2 border rounded-lg text-sm appearance-none pr-8">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Overtime hrs</label>
            <input type="number" value={bulkOt}
              onChange={e => setBulkOt(Number(e.target.value) || 0)}
              className="w-24 mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <button onClick={() => bulkMut.mutate()}
            disabled={!selectedEmp || pickedDates.size === 0 || bulkMut.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            Apply to {pickedDates.size} selected day(s)
          </button>
          {pickedDates.size > 0 && (
            <button onClick={() => setPickedDates(new Set())}
              className="px-3 py-2 border rounded-lg text-sm text-gray-500"><X size={16} /></button>
          )}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-400 pt-2 border-t">
          <span className="text-purple-600 font-medium">H</span> = Holiday
          <span className="text-slate-500">■</span> = Weekend
          {STATUSES.map((s, i) => (
            <span key={i} className={`px-1.5 py-0.5 rounded ${STATUS_STYLE[s]}`}>{STATUS_LABEL[s]}</span>
          ))}
        </div>
        </>) : (
        <div className="space-y-5">
          {activeStaff.length === 0 ? (
            <EmptyState
              bare
              kind="search"
              title="No employees found"
              description="No active employees match the current search or filters."
            />
          ) : (
            <>
              {/* Month summary per employee */}
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="px-4 py-2.5 font-medium">Employee</th>
                      <th className="px-3 py-2.5 font-medium text-center">Worked</th>
                      <th className="px-3 py-2.5 font-medium text-center">Half Days</th>
                      <th className="px-3 py-2.5 font-medium text-center">Paid Leave</th>
                      <th className="px-3 py-2.5 font-medium text-center">Unpaid/Absent</th>
                      <th className="px-3 py-2.5 font-medium text-center">OT hrs</th>
                      <th className="px-3 py-2.5 font-medium text-center">Forecast (month)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStaff.map((e: any) => {
                      const s = allByEmp[e.id] || { worked_days: 0, half_days: 0, paid_leave_days: 0, unpaid_days: 0, overtime_hours: 0, holiday_count: 0 }
                      const forecast = buildSalaryForecast(e, s.overtime_hours, { year, month, holidays: holidaysData })
                      return (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                          <td className="px-4 py-2">
                            <p className="font-medium leading-tight">{e.name}</p>
                            <p className="text-xs text-gray-400">{e.employee_code ? `#${e.employee_code}` : ''} {e.department || ''}</p>
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-green-700 dark:text-green-400">{s.worked_days}</td>
                          <td className="px-3 py-2 text-center text-amber-700 dark:text-amber-400">{s.half_days}</td>
                          <td className="px-3 py-2 text-center text-blue-700 dark:text-blue-400">{s.paid_leave_days}</td>
                          <td className="px-3 py-2 text-center text-red-700 dark:text-red-400">{s.unpaid_days}</td>
                          <td className="px-3 py-2 text-center text-indigo-700 dark:text-indigo-400">{s.overtime_hours || 0}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="font-bold tabular-nums">LKR {forecast.projected.toLocaleString()}</span>
                            <span className="block text-[10px] text-gray-400" title={`Base ${forecast.base.toLocaleString()} + allowance ${forecast.allowance.toLocaleString()} + OT ${forecast.overtime.toLocaleString()} − EPF ${forecast.epf.toLocaleString()} (${forecast.method})`}>
                              if all remaining days attended
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Monthly matrix: each employee × each day */}
              <div className="overflow-x-auto rounded-xl border">
                <div className="min-w-fit">
                  <div className="grid" style={{ gridTemplateColumns: `150px repeat(${days.length}, 34px)` }}>
                    <div className="sticky left-0 top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase border-b border-r">Employee</div>
                    {days.map((d: string) => {
                      const dow = new Date(d + 'T00:00:00').getDay()
                      const isHoliday = holidaySet.has(d)
                      const isWeekend = dow === 0 || dow === 6
                      const isToday = d === todayStr
                      return (
                        <div key={d} className={`border-b border-r text-center text-[11px] font-medium py-1.5 ${isToday ? 'bg-red-50 text-red-600 font-bold dark:bg-red-900/20' : isHoliday ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' : isWeekend ? 'bg-slate-50 text-slate-400 dark:bg-slate-800/50' : 'bg-gray-50 text-gray-500 dark:bg-gray-800'}`}>
                          {Number(d.slice(8))}{isHoliday ? '·H' : ''}
                        </div>
                      )
                    })}
                  </div>
                  {activeStaff.map((e: any) => {
                    const dayMap = empDayMap[e.id] || {}
                    return (
                      <div key={e.id} className="grid" style={{ gridTemplateColumns: `150px repeat(${days.length}, 34px)` }}>
                        <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r px-3 py-1.5 bg-white dark:bg-gray-800">
                          <span className="truncate text-[12px] font-medium">{e.name}</span>
                        </div>
                        {days.map((d: string) => {
                          const rec = dayMap[d]
                          const dow = new Date(d + 'T00:00:00').getDay()
                          const isHoliday = holidaySet.has(d)
                          const isWeekend = dow === 0 || dow === 6
                          const bg = isHoliday ? 'bg-purple-50 dark:bg-purple-900/10' : isWeekend ? 'bg-slate-50 dark:bg-slate-800/40' : ''
                          return (
                            <div key={d} title={rec ? `${e.name} · ${d} · ${STATUS_LABEL[rec.status] || rec.status}${rec.overtime_hours > 0 ? ` · OT ${rec.overtime_hours}h` : ''}` : `${e.name} · ${d}`}
                              className={`relative border-b border-r flex items-center justify-center text-[11px] font-bold py-1 ${rec ? (CELL_STYLE[rec.status] || '') : bg}`}>
                              {rec ? (<>
                                {CELL_CODE[rec.status] || rec.status}
                                {rec.overtime_hours > 0 && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-indigo-500" />}
                              </>) : <span className="text-gray-300 dark:text-gray-600">·</span>}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-2 border-t text-[11px] text-gray-400">
                  {STATUSES.map(s => (
                    <span key={s} className="inline-flex items-center gap-1">
                      <span className={`inline-block h-3.5 w-3.5 rounded text-center text-[9px] font-bold leading-[14px] ${CELL_STYLE[s]}`}>{CELL_CODE[s]}</span>
                      {STATUS_LABEL[s]}
                    </span>
                  ))}
                  <span className="text-purple-500">H</span> = Holiday
                  <span className="text-slate-400">■</span> = Weekend
                  <span className="text-indigo-500">●</span> = OT
                </div>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* Edit modal */}
      {editDate && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditDate(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 w-[380px] space-y-4 shadow-xl" onClick={e => e.stopPropagation()} ref={editFlow.ref} onKeyDown={editFlow.handleKeyDown}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Pencil size={16} /> {editDate}
              </h3>
              <button onClick={() => setEditDate(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Overtime (hrs)</label>
                <input type="number" step="0.5" value={editForm.overtime_hours}
                  onChange={e => setEditForm({ ...editForm, overtime_hours: Number(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Check-in</label>
                <input type="time" value={editForm.check_in_time}
                  onChange={e => setEditForm({ ...editForm, check_in_time: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Check-out</label>
                <input type="time" value={editForm.check_out_time}
                  onChange={e => setEditForm({ ...editForm, check_out_time: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</label>
              <input value={editForm.notes}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="Optional notes" />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button onClick={saveEdit}
                disabled={updateMut.isPending || createMut.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                Save
              </button>
              {byDate[editDate]?.id && (
                <button onClick={() => setDeleteTarget(byDate[editDate].id)}
                  disabled={deleteMut.isPending}
                  className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 flex items-center gap-1">
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    {/* Quick save card */}
      {quickDate && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40" onClick={() => setQuickDate(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-5 w-[300px] space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Check size={15} className="text-green-600" /> Quick save — {quickDate}
              </h3>
              <button onClick={() => setQuickDate(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    createMut.mutate({
                      employee_id: selectedEmp,
                      date: quickDate,
                      status: s,
                      overtime_hours: quickOt || 0,
                      check_in_time: '',
                      check_out_time: '',
                      notes: '',
                    })
                    setQuickDate(null)
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left hover:-translate-y-0.5 transition border border-transparent ${STATUS_STYLE[s]}`}>
                  {STATUS_LABEL[s]}
                  <span className="ml-auto text-[11px] opacity-60">{s.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t">
              <label className="text-xs text-gray-500">OT hrs</label>
              <input type="number" step="0.5" min="0" value={quickOt}
                onChange={e => setQuickOt(Number(e.target.value) || 0)}
                className="w-20 px-2 py-1 border rounded-lg text-sm" />
              <button
                onClick={() => { setEditDate(quickDate); setEditForm({ status: 'PRESENT', overtime_hours: quickOt || 0, check_in_time: '', check_out_time: '', notes: '' }); setQuickDate(null) }}
                className="ml-auto text-xs text-indigo-600 hover:underline">
                Detailed…
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this attendance record?"
        message="This attendance record will be permanently removed."
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}