import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, attendanceApi } from '../api/management-api'
import { toast } from 'sonner'
import { Save, CalendarDays, CheckCircle2, UserRound } from 'lucide-react'
import { EmptyState } from '../../../components/ui/empty-state'
import { todayISO } from '../../../lib/time'
import { invalidateResource } from '../../../cache/invalidation'

const STATUSES = ['PRESENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE', 'ABSENT'] as const
const STATUS_COLORS: Record<string, string> = {
  PRESENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  HALF_DAY: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  PAID_LEAVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  UNPAID_LEAVE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  ABSENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

interface Row {
  status: string
  overtime_hours: string
}

export default function AttendanceLogPage() {
  const qc = useQueryClient()
  const today = useMemo(() => todayISO(), [])
  const [logDate, setLogDate] = useState(today)

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-attendance-log-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data as any[]),
  })

  const activeEmployees = useMemo(
    () => employees.filter((e: any) => e.is_active !== false && e.attendance_required !== false),
    [employees],
  )

  const fixedSalaryEmployees = useMemo(
    () => employees.filter((e: any) => e.is_active !== false && e.attendance_required === false),
    [employees],
  )

  const { data: existingRecs = [], refetch: refetchRecs } = useQuery({
    queryKey: ['mgmt-attendance-log-records', logDate],
    queryFn: () => attendanceApi.listForDate(logDate).then(r => r.data as any[]),
  })

  const [rows, setRows] = useState<Record<string, Row>>({})

  useEffect(() => {
    const map: Record<string, Row> = {}
    for (const e of activeEmployees as any[]) {
      const rec = (existingRecs as any[]).find((r: any) => r.employee_id === e.id)
      map[e.id] = {
        status: rec?.status || 'PRESENT',
        overtime_hours: rec?.overtime_hours ? String(rec.overtime_hours) : '0',
      }
    }
    setRows(map)
  }, [activeEmployees, existingRecs])

  const setCell = (empId: string, key: keyof Row, value: string) => {
    setRows(prev => ({ ...prev, [empId]: { ...prev[empId], [key]: value } }))
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const records = (activeEmployees as any[]).map((e: any) => ({
        employee_id: e.id,
        status: rows[e.id]?.status || 'PRESENT',
        overtime_hours: parseFloat(rows[e.id]?.overtime_hours || '0') || 0,
      }))
      return attendanceApi.bulkDay({ date: logDate, records })
    },
    onSuccess: () => {
      toast.success(`Attendance saved for ${logDate}`)
      invalidateResource(qc, 'attendance')
      refetchRecs()
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save attendance'),
  })

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const v of Object.values(rows)) c[v.status] = (c[v.status] || 0) + 1
    return c
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Log Attendance — All Staff</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800">
            <CalendarDays size={16} className="text-gray-400" />
            <input
              type="date"
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
              className="bg-transparent outline-none"
            />
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-60"
          >
            <Save size={16} /> {saveMut.isPending ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => (
          <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[s]}`}>
            {s.replace('_', ' ')} · {counts[s] || 0}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <UserRound size={12} /> {activeEmployees.length} staff
        </span>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">OT Hours</th>
              </tr>
            </thead>
            <tbody>
              {(activeEmployees as any[]).map((e: any) => {
                const row = rows[e.id] || { status: 'PRESENT', overtime_hours: '0' }
                const hasRec = (existingRecs as any[]).some((r: any) => r.employee_id === e.id)
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs font-bold">
                          {(e.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.employee_code ? `#${e.employee_code}` : ''}</p>
                        </div>
                        {hasRec && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{e.department || '—'}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={row.status}
                        onChange={ev => setCell(e.id, 'status', ev.target.value)}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold outline-none ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'} ${STATUS_COLORS[row.status] ? 'border-transparent' : 'border'}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={row.overtime_hours}
                        onChange={ev => setCell(e.id, 'overtime_hours', ev.target.value)}
                        className="w-20 px-2 py-1.5 border rounded-lg text-sm"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {activeEmployees.length === 0 && (
          <EmptyState
            bare
            kind="search"
            title="No employees found"
            description="No active employees match the current search or filters."
          />
        )}
      </div>

      {fixedSalaryEmployees.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {fixedSalaryEmployees.length} employee(s) on a fixed salary arrangement ({fixedSalaryEmployees.map((e: any) => e.name).join(', ')}) are excluded — attendance is not required for their pay.
        </p>
      )}

      <p className="text-xs text-gray-400">
        Select a date, set each employee's status, then Save All. Employees with a fixed salary arrangement (attendance not required) are excluded.
        PAID_LEAVE counts as worked in salary. UNPAID_LEAVE and ABSENT reduce the salary base. Overwrites existing records for {logDate}.
      </p>
    </div>
  )
}
