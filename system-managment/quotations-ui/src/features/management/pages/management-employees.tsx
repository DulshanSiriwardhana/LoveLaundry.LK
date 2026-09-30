import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { employeesApi, attendanceApi, holidaysApi } from '../api/management-api'
import { buildStaffSummary } from '../utils/attendance-summary'
import { buildSalaryForecast } from '../utils/salary-forecast'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Banknote, UserCheck, Filter, FileText, Users } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { todayISO } from '../../../lib/date'

const PAGE_SIZE = 12

const DEPARTMENTS = ['WASHING', 'PRESSING', 'FINISHING', 'PACKING', 'DRY_CLEANING', 'DELIVERY', 'GENERAL']
const SALARY_TYPES = ['MONTHLY', 'WEEKLY', 'DAILY', 'CONTRACT']

const SALARY_TYPE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  DAILY: 'Daily',
  CONTRACT: 'Contract',
  FIXED_MONTHLY: 'Monthly (fixed)',
}

const CALC_METHOD_LABELS: Record<string, string> = {
  MONTHLY_ATTENDANCE: 'Monthly · attendance-based',
  FIXED_MONTHLY: 'Monthly · fixed amount',
  WEEKLY_ATTENDANCE: 'Weekly · attendance-based',
  WEEKLY_FIXED: 'Weekly · fixed amount',
  DAILY_WORKED_DAYS: 'Daily · days worked',
  CONTRACT: 'Contract · fixed amount',
}
const STATUS_FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'INACTIVE', label: 'Inactive' },
] as const

export default function ManagementEmployees() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const now = new Date()
  const slipLabel = now.toLocaleString('default', { month: 'long' })
  const [showForm, setShowForm] = useState(false)
  const [showSalary, setShowSalary] = useState<any>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const flow = useEnterFlow()
  const salaryFlow = useEnterFlow()

  useEffect(() => {
    setOffset(0)
  }, [search, statusFilter])

  useEscape(showForm, useCallback(() => { setShowForm(false); setEditing(null) }, []))
  useEscape(!!showSalary, useCallback(() => setShowSalary(null), []))

  const { data: employees = [], isLoading: _isLoading } = useQuery({
    queryKey: ['mgmt-employees', search],
    queryFn: () => employeesApi.list(search).then(r => r.data),
  })

  const filtered = statusFilter === 'ALL'
    ? employees
    : employees.filter((e: any) => (statusFilter === 'ACTIVE' ? e.is_active !== false : e.is_active === false))

  const pageEmployees = filtered.slice(offset, offset + limit)

  const createMut = useMutation({
    mutationFn: (data: any) => employeesApi.create(data),
    onSuccess: () => { toast.success('Employee added'); qc.invalidateQueries({ queryKey: ['mgmt-employees'] }); setShowForm(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => employeesApi.update(id, data),
    onSuccess: () => { toast.success('Employee updated'); qc.invalidateQueries({ queryKey: ['mgmt-employees'] }); setEditing(null); setShowForm(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => employeesApi.remove(id),
    onSuccess: () => { toast.success('Employee deactivated'); qc.invalidateQueries({ queryKey: ['mgmt-employees'] }); setDeactivateTarget(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const activateMut = useMutation({
    mutationFn: (id: string) => employeesApi.activate(id),
    onSuccess: () => { toast.success('Employee activated'); qc.invalidateQueries({ queryKey: ['mgmt-employees'] }) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const createSalaryMut = useMutation({
    mutationFn: ({ empId, data }: any) => employeesApi.createSalary(empId, data),
    onSuccess: () => { toast.success('Salary recorded'); setShowSalary(null); qc.invalidateQueries({ queryKey: ['mgmt-employees'] }) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const totalSalary = employees.reduce((s: number, e: any) => s + (e.basic_salary || 0), 0)

  const attYear = now.getFullYear()
  const attMonth = now.getMonth() + 1
  const monthStart = `${attYear}-${String(attMonth).padStart(2, '0')}-01`
  const monthEnd = `${attYear}-${String(attMonth).padStart(2, '0')}-${String(new Date(attYear, attMonth, 0).getDate()).padStart(2, '0')}`

  const { data: monthAtt = [] } = useQuery({
    queryKey: ['mgmt-attendance-month', monthStart],
    queryFn: () => attendanceApi.listRange(monthStart, monthEnd).then(r => r.data),
  })

  const attSummary = useMemo(() => buildStaffSummary(monthAtt), [monthAtt])

  const { data: holidaysData = [] } = useQuery({
    queryKey: ['mgmt-holidays', attYear],
    queryFn: () => holidaysApi.list(attYear).then(r => r.data),
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees & Salaries"
        subtitle={`${employees.length} employees`}
        actions={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
            <Plus size={16} /> Add Employee
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Employees" value={employees.length} icon={<Users size={20} />} color="blue" />
        <StatCard label="Active" value={employees.filter((e: any) => e.is_active !== false).length} icon={<UserCheck size={20} />} color="green" />
        <StatCard label="Inactive" value={employees.filter((e: any) => e.is_active === false).length} icon={<Users size={20} />} color="gray" />
        <StatCard label="Total Salary" value={`LKR ${totalSalary.toLocaleString()}`} icon={<Banknote size={20} />} color="amber" />
      </div>

      <FilterBar>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
          className="flex-1 md:w-80 px-3 py-2 border rounded-lg text-sm" />
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Filter size={14} className="ml-1 text-gray-400" />
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${statusFilter === f.key ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </FilterBar>

      {_isLoading ? (
        <LoadingSpinner label="Loading employees..." className="py-12" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No employees found"
          description={search ? 'Try a different search term.' : 'Add your first employee to get started.'}
          action={
            !search && (
              <button onClick={() => { setEditing(null); setShowForm(true) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                <Plus size={16} /> Add Employee
              </button>
            )
          }
        />
      ) : (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageEmployees.map((emp: any) => {
          const isActive = emp.is_active !== false
          const hasLeft = !!emp.leaving_date
          const attendanceReq = emp.attendance_required !== false
          const calcMethod = emp.salary_type === 'MONTHLY' ? (attendanceReq ? 'MONTHLY_ATTENDANCE' : 'FIXED_MONTHLY')
            : emp.salary_type === 'WEEKLY' ? (attendanceReq ? 'WEEKLY_ATTENDANCE' : 'WEEKLY_FIXED')
            : emp.salary_type === 'DAILY' ? 'DAILY_WORKED_DAYS'
            : emp.salary_type === 'CONTRACT' ? 'CONTRACT'
            : emp.salary_type || 'MONTHLY'
          const payAmount = emp.salary_type === 'DAILY' ? emp.daily_rate
            : emp.salary_type === 'WEEKLY' ? (emp.weekly_rate || emp.daily_rate * 6)
            : emp.salary_type === 'CONTRACT' ? emp.contract_amount
            : emp.basic_salary
          return (
            <div key={emp.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3 ${!isActive ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{emp.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    {!attendanceReq && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title="Fixed salary arrangement — attendance not required for payroll">FIXED</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{emp.employee_code ? `#${emp.employee_code}` : ''} {emp.position || emp.department}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(emp); setShowForm(true) }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Edit"><Pencil size={14} /></button>
                  {isActive ? (
                    <button
                      onClick={() => setDeactivateTarget(emp)}
                      className="p-1.5 hover:bg-red-100 text-red-500 rounded" title="Deactivate"><Trash2 size={14} /></button>
                  ) : (
                    <button
                      onClick={() => activateMut.mutate(emp.id)}
                      className="p-1.5 hover:bg-green-100 text-green-600 rounded" title="Activate"><UserCheck size={14} /></button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-400">Basic Salary</p>
                  <p className="font-medium">LKR {emp.basic_salary.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Configured Pay</p>
                  <p className="font-medium">LKR {(payAmount || 0).toLocaleString()}{emp.salary_type === 'WEEKLY' ? ' / week' : emp.salary_type === 'DAILY' ? ' / day' : ''}</p>
                </div>
                <div>
                  <p className="text-gray-400">Department</p>
                  <p className="font-medium">{emp.department}</p>
                </div>
                <div>
                  <p className="text-gray-400">Salary Arrangement</p>
                  <p className="font-medium">{CALC_METHOD_LABELS[calcMethod] || calcMethod}</p>
                </div>
                <div>
                  <p className="text-gray-400">Phone</p>
                  <p className="font-medium">{emp.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Joined</p>
                  <p className="font-medium">{emp.joined_date || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400">EPF Rate</p>
                  <p className="font-medium">{emp.epf_rate || 0}%</p>
                </div>
                <div>
                  <p className="text-gray-400">EPF Base</p>
                  <p className="font-medium">{emp.epf_base === 'FULL' ? 'Full' : emp.epf_base === 'ATTENDANCE' ? 'Attendance' : 'Adjusted'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Allowance</p>
                  <p className="font-medium">LKR {(emp.allowance || 0).toLocaleString()}{emp.allowance_type === 'ATTENDANCE' ? ' · Attd.' : emp.allowance_type === 'ADJUSTED' || emp.allowance_type === 'DAYS' ? ' · Adj.' : ''}</p>
                </div>
                {hasLeft && (
                  <div className="col-span-2">
                    <p className="text-gray-400">Leaving Date</p>
                    <p className="font-medium text-red-500">{emp.leaving_date}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                {attendanceReq ? (
                  <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5" title={`Attendance for ${now.toLocaleString('default', { month: 'long' })} ${attYear}`}>
                    <span className="w-full text-gray-400 text-[10px] uppercase tracking-wide">Attendance · {now.toLocaleString('default', { month: 'long' })}</span>
                    <span className="text-green-600 font-bold">{attSummary[emp.id]?.worked_days ?? 0} P</span>
                    <span className="text-amber-600 font-bold">{attSummary[emp.id]?.half_days ?? 0} H</span>
                    <span className="text-blue-600 font-bold">{attSummary[emp.id]?.paid_leave_days ?? 0} L</span>
                    <span className="text-red-600 font-bold">{attSummary[emp.id]?.unpaid_days ?? 0} A</span>
                    <span className="text-indigo-600 font-bold">{attSummary[emp.id]?.overtime_hours ?? 0} OT</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400">Attendance not tracked (fixed arrangement)</p>
                )}
                {(() => {
                  const s = attSummary[emp.id]
                  const f = buildSalaryForecast(emp, s?.overtime_hours ?? 0, { year: attYear, month: attMonth, holidays: holidaysData })
                  return (
                    <p className="mt-1.5 border-t border-gray-100 dark:border-gray-800 pt-1.5 text-[11px] text-gray-500 flex items-center justify-between gap-2">
                      <span title={`Base LKR ${f.base.toLocaleString()} + allowance LKR ${f.allowance.toLocaleString()} + OT LKR ${f.overtime.toLocaleString()} − EPF LKR ${f.epf.toLocaleString()} (${f.method})`}>
                        Month earning if all days attend
                      </span>
                      <span className="font-bold tabular-nums text-red-700 dark:text-red-400">LKR {f.projected.toLocaleString()}</span>
                    </p>
                  )
                })()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/management/salary-slip?emp=${emp.id}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  <FileText size={14} /> Slip ({slipLabel})
                </button>
                <button onClick={() => setShowSalary(emp)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40">
                  <Banknote size={14} /> Salary
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <Pagination total={filtered.length} limit={limit} offset={offset} onChange={setOffset} className="px-1" />
      </>
      )}

      {/* Add/Edit Employee */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Add'} Employee</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data: any = Object.fromEntries(fd)
              data.basic_salary = String(parseFloat(data.basic_salary as string) || 0)
              data.daily_rate = String(parseFloat(data.daily_rate as string) || 0)
              data.weekly_rate = String(parseFloat(data.weekly_rate as string) || 0)
              data.contract_amount = String(parseFloat(data.contract_amount as string) || 0)
              data.overtime_rate = String(parseFloat(data.overtime_rate as string) || 0)
              data.allowance = String(parseFloat(data.allowance as string) || 0)
              data.epf_rate = String(parseFloat(data.epf_rate as string) || 0)
              data.etf_rate = String(parseFloat(data.etf_rate as string) || 0)
              data.attendance_required = fd.get('attendance_required') === 'on'
              data.salary_components = []
              ;['position', 'phone', 'nic', 'joined_date', 'leaving_date', 'notes'].forEach(k => {
                if (!data[k]) delete data[k]
              })
              if (!data.salary_type) data.salary_type = 'MONTHLY'
              if (!data.allowance_type) data.allowance_type = 'FIXED'
              if (!data.epf_base) data.epf_base = 'ADJUSTED'
              if (editing) {
                const fd2 = new FormData(e.currentTarget)
                data.is_active = fd2.get('is_active') === 'on'
                updateMut.mutate({ id: editing.id, data })
              }
              else createMut.mutate(data)
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <input name="name" defaultValue={editing?.name} placeholder="Full Name *" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input name="position" defaultValue={editing?.position} placeholder="Position" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <select name="department" defaultValue={editing?.department || 'GENERAL'} className="px-3 py-2 border rounded-lg text-sm">
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Pay Frequency</label>
                <select name="salary_type" defaultValue={editing?.salary_type || 'MONTHLY'} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {SALARY_TYPES.map(t => <option key={t} value={t}>{SALARY_TYPE_LABELS[t] || t}</option>)}
                </select>
                {editing?.salary_type === 'MONTHLY' && editing?.attendance_required === false && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Current arrangement: Monthly fixed amount (attendance not required) — a full fixed salary every month.</p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="attendance_required" type="checkbox" defaultChecked={editing?.attendance_required !== false} className="rounded" />
                Attendance required for salary
                <span className="text-[11px] text-gray-400">(off = fixed salary, no attendance needed, e.g. contract/water-disposal worker)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input name="phone" defaultValue={editing?.phone} placeholder="Phone" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input name="nic" defaultValue={editing?.nic} placeholder="NIC" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Basic Salary (LKR / month)</label>
                  <input name="basic_salary" type="number" step="0.01" defaultValue={editing?.basic_salary} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Daily Rate (LKR / day)</label>
                  <input name="daily_rate" type="number" step="0.01" defaultValue={editing?.daily_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Weekly Rate (LKR / week)</label>
                  <input name="weekly_rate" type="number" step="0.01" defaultValue={editing?.weekly_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Contract Amount (LKR / period)</label>
                  <input name="contract_amount" type="number" step="0.01" defaultValue={editing?.contract_amount} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Overtime Rate (LKR / hr)</label>
                  <input name="overtime_rate" type="number" step="0.01" defaultValue={editing?.overtime_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Allowance (LKR)</label>
                  <input name="allowance" type="number" step="0.01" defaultValue={editing?.allowance} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Allowance Type</label>
                  <select name="allowance_type" defaultValue={editing?.allowance_type === 'DAYS' ? 'ADJUSTED' : editing?.allowance_type || 'FIXED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="FIXED">Fixed (full amount every period)</option>
                    <option value="ADJUSTED">Adjusted (absences reduce it, paid leave counts)</option>
                    <option value="ATTENDANCE">Attendance (only days actually worked, paid leave excluded)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">EPF Rate %</label>
                  <input name="epf_rate" type="number" step="0.01" defaultValue={editing?.epf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">ETF Rate %</label>
                  <input name="etf_rate" type="number" step="0.01" defaultValue={editing?.etf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">EPF Base</label>
                <select name="epf_base" defaultValue={editing?.epf_base || 'ADJUSTED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="ADJUSTED">Adjusted base (period, after absences, paid leaves count)</option>
                  <option value="ATTENDANCE">Attendance base (only days actually worked, leaves excluded)</option>
                  <option value="FULL">Full base (basic salary, always / 30-day)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Joined Date</label>
                  <input name="joined_date" type="date" defaultValue={editing?.joined_date} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Leaving Date (set when employee leaves)</label>
                  <input name="leaving_date" type="date" defaultValue={editing?.leaving_date} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm">
                  <input name="is_active" type="checkbox" defaultChecked={editing.is_active !== false} className="rounded" />
                  Employee is active
                </label>
              )}
              <textarea name="notes" defaultValue={editing?.notes} placeholder="Notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">{createMut.isPending || updateMut.isPending ? 'Saving…' : (editing ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Salary Modal */}
      {showSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Record Salary - {showSalary.name}</h2>
              <button onClick={() => setShowSalary(null)}><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data = Object.fromEntries(fd)
              data.basic_salary = String(parseFloat(data.basic_salary as string) || 0)
              data.overtime_hours = String(parseFloat(data.overtime_hours as string) || 0)
              data.overtime_rate = String(parseFloat(data.overtime_rate as string) || 0)
              data.allowances = String(parseFloat(data.allowances as string) || 0)
              data.epf_deduction = String(parseFloat(data.epf_deduction as string) || 0)
              data.etf_deduction = String(parseFloat(data.etf_deduction as string) || 0)
              data.loan_deduction = String(parseFloat(data.loan_deduction as string) || 0)
              data.advance_deduction = String(parseFloat(data.advance_deduction as string) || 0)
              data.amount_paid = String(parseFloat(data.amount_paid as string) || 0)
              createSalaryMut.mutate({ empId: showSalary.id, data })
            }} ref={salaryFlow.ref} onKeyDown={salaryFlow.handleKeyDown} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Month</label>
                  <select name="month" defaultValue={now.getMonth() + 1} className="w-full px-3 py-2 border rounded-lg text-sm" autoFocus>
                    {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', {month:'long'})}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Year</label>
                  <input name="year" type="number" defaultValue={new Date().getFullYear()} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Basic Salary</label>
                <input name="basic_salary" type="number" step="0.01" defaultValue={showSalary.basic_salary} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">OT Hours</label>
                  <input name="overtime_hours" type="number" step="0.5" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">OT Rate (LKR/hr)</label>
                  <input name="overtime_rate" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">Allowances (LKR)</label>
                <input name="allowances" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">EPF Deduction</label>
                  <input name="epf_deduction" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">ETF Deduction</label>
                  <input name="etf_deduction" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Loan Deduction</label>
                  <input name="loan_deduction" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Advance Deduction</label>
                  <input name="advance_deduction" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Amount Paid</label>
                  <input name="amount_paid" type="number" step="0.01" defaultValue={0} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Payment Date</label>
                  <input name="payment_date" type="date" defaultValue={todayISO()} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <textarea name="notes" placeholder="Notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSalary(null)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createSalaryMut.isPending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed">{createSalaryMut.isPending ? 'Saving…' : 'Save Salary'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate Employee"
        message={`Deactivate ${deactivateTarget?.name}?`}
        confirmLabel="Deactivate"
        loading={deactivateMut.isPending}
        onConfirm={() => deactivateTarget && deactivateMut.mutate(deactivateTarget.id)}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}
