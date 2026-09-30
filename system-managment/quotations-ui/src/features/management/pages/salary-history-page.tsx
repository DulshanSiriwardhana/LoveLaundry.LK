import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, salaryApi, salaryPackagesApi, holidaysApi } from '../api/management-api'
import { buildSalaryForecast, buildRemainingForecast } from '../utils/salary-forecast'
import { toast } from 'sonner'
import { Eye, Printer, Trash2, XCircle, CheckCircle, Wallet, PlayCircle, Settings2 } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { SalarySlipPrint } from '../components/salary-slip-print'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { Pagination } from '../../../components/ui/pagination'

const PAGE_SIZE = 20

const CALC_METHOD_LABELS: Record<string, string> = {
  MONTHLY_ATTENDANCE: 'Monthly · attendance',
  FIXED_MONTHLY: 'Monthly · fixed',
  WEEKLY_ATTENDANCE: 'Weekly · attendance',
  WEEKLY_FIXED: 'Weekly · fixed',
  DAILY_WORKED_DAYS: 'Daily · worked days',
  CONTRACT: 'Contract · fixed',
}

const SALARY_TYPE_OPTIONS = ['MONTHLY', 'WEEKLY', 'DAILY', 'CONTRACT']

const PACKAGE_KEYS: (keyof any)[] = ['basic_salary', 'daily_rate', 'weekly_rate', 'contract_amount', 'overtime_rate', 'allowance', 'epf_rate', 'etf_rate']

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  FINALIZED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  PAID: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  DELETED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

export default function SalaryHistoryPage() {
  const qc = useQueryClient()
  const slipRef = useRef<HTMLDivElement>(null)
  const [selectedEmp, setSelectedEmp] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())
  const [viewSlip, setViewSlip] = useState<any>(null)
  const [slipLang, setSlipLang] = useState<'EN' | 'SI'>('EN')
  const [payYear, setPayYear] = useState(new Date().getFullYear())
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1)
  const [preview, setPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [tab, setTab] = useState<'ACTIVE' | 'DELETED'>('ACTIVE')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE

  useEffect(() => {
    setOffset(0)
  }, [tab, selectedEmp, statusFilter, yearFilter])

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data),
  })

  const { data: holidaysData = [] } = useQuery({
    queryKey: ['mgmt-holidays', payYear],
    queryFn: () => holidaysApi.list(payYear).then(r => r.data),
  })

  const { data: slipsData = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['salary-slips', tab, selectedEmp, statusFilter, yearFilter, offset, limit],
    queryFn: () => salaryApi.listSlips({
      employee_id: selectedEmp || undefined,
      status: tab === 'ACTIVE' ? (statusFilter || undefined) : undefined,
      deleted: tab === 'DELETED',
      year: yearFilter,
      limit,
      offset,
    }).then(r => r.data),
  })

  const slips = slipsData.items

  const finalizeMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.finalizeSlip(slipId),
    onSuccess: () => { toast.success('Salary slip finalized'); qc.invalidateQueries({ queryKey: ['salary-slips'] }) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const cancelMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.cancelSlip(slipId),
    onSuccess: () => { toast.success('Salary slip cancelled'); qc.invalidateQueries({ queryKey: ['salary-slips'] }); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (slipId: string) => salaryApi.deleteSlip(slipId),
    onSuccess: () => { toast.success('Salary slip deleted'); qc.invalidateQueries({ queryKey: ['salary-slips'] }); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const payMut = useMutation({
    mutationFn: ({ slipId, amount }: { slipId: string; amount: number }) => salaryApi.paySlip(slipId, amount),
    onSuccess: () => { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['salary-slips'] }); setViewSlip(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const handleMarkPaid = (slip: any) => {
    const amount = prompt('Payment amount (LKR):', String(slip.net_salary ?? slip.total_earnings ?? 0))
    if (amount === null) return
    const n = Number(amount)
    if (!n || n <= 0) { toast.error('Enter a valid amount'); return }
    payMut.mutate({ slipId: slip.id, amount: n })
  }

  const loadPreview = async () => {
    setPreviewLoading(true)
    try {
      const r = await salaryApi.payrollPreview(payYear, payMonth)
      setPreview(r.data)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const runPayroll = async () => {
    if (!confirm(`Create salary slips for ${payYear}-${payMonth} for all active employees?`)) return
    setPayrollLoading(true)
    try {
      const r = await salaryApi.payrollRun(payYear, payMonth)
      toast.success(`${r.data.created?.length ?? 0} slip(s) created, ${r.data.skipped?.length ?? 0} skipped`)
      setPreview(null)
      qc.invalidateQueries({ queryKey: ['salary-slips'] })
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Payroll run failed')
    } finally {
      setPayrollLoading(false)
    }
  }

  const handlePrint = useReactToPrint({
    contentRef: slipRef,
    documentTitle: viewSlip ? `SalarySlip-${viewSlip.slip_number}` : 'SalarySlip',
  })

  const [overrideEmp, setOverrideEmp] = useState<any>(null)
  const [overrideMonth, setOverrideMonth] = useState('')

  const overrideMut = useMutation({
    mutationFn: (data: any) => salaryPackagesApi.upsert(data),
    onSuccess: () => { toast.success('Month arrangement saved'); setOverrideEmp(null); setPreview(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const openOverride = (row: any) => {
    setOverrideMonth(`${payYear}-${String(payMonth).padStart(2, '0')}`)
    setOverrideEmp({
      employee_id: row.employee_id,
      name: row.employee_name,
      salary_type: row.salary_type || 'MONTHLY',
      attendance_required: row.attendance_required !== false,
      basic_salary: row.basic_salary || 0,
      daily_rate: row.daily_rate || 0,
      weekly_rate: row.weekly_rate || 0,
      contract_amount: row.contract_amount || 0,
      overtime_rate: row.overtime_rate || 0,
      allowance: row.allowance || 0,
      allowance_type: row.allowance_type || 'FIXED',
      epf_rate: row.epf_rate || 0,
      etf_rate: row.etf_rate || 0,
      epf_base: row.epf_base || 'ADJUSTED',
    })
  }

  const projectRow = (row: any) =>
    buildSalaryForecast(row, row.overtime_hours || 0, { year: payYear, month: payMonth, holidays: holidaysData })

  const remainingRow = (row: any) =>
    buildRemainingForecast(row, { year: payYear, month: payMonth, holidays: holidaysData })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salary History</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTab('ACTIVE')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'ACTIVE'
            ? 'border-red-600 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Active Slips
        </button>
        <button
          onClick={() => setTab('DELETED')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === 'DELETED'
            ? 'border-red-600 text-red-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
          Deleted Slips
        </button>
      </div>

      {/* Payroll Run card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <PlayCircle size={18} /> Run Payroll
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input type="number" value={payYear} onChange={e => setPayYear(Number(e.target.value))}
              className="w-28 mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Month</label>
            <select value={payMonth} onChange={e => setPayMonth(Number(e.target.value))}
              className="w-40 mt-1 px-3 py-2 border rounded-lg text-sm">
              {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <button onClick={loadPreview} disabled={previewLoading || payrollLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {previewLoading ? 'Previewing...' : 'Preview Month'}
          </button>
          <button onClick={runPayroll} disabled={payrollLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {payrollLoading ? 'Running...' : 'Run Payroll (DRAFT all missing)'}
          </button>
        </div>

        {preview && (
          <div className="mt-4 border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div><div className="text-2xl font-bold">{preview.count}</div><div className="text-xs text-gray-400">Employees</div></div>
              <div><div className="text-2xl font-bold text-red-600">LKR {(preview.total_gross || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Gross Total</div></div>
              <div><div className="text-2xl font-bold text-red-600">LKR {(preview.total_deductions || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Deductions</div></div>
              <div><div className="text-2xl font-bold text-green-600">LKR {(preview.total_net || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Net Payroll</div></div>
              <div className="text-xs text-gray-400">Missing slips will be created on Run Payroll. Existing slips are skipped.</div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/60 dark:bg-indigo-900/10 p-3">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-2">Projection — if every employee attends all remaining working days</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {(preview.projected_total_gross || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Gross Total</div></div>
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {(preview.projected_total_deductions || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Deductions</div></div>
                <div><div className="text-xl font-bold text-indigo-700 dark:text-indigo-200">LKR {(preview.projected_total_net || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Net Payroll</div></div>
                <div><div className="text-xl font-bold text-green-700 dark:text-green-300">+ LKR {(preview.projected_total_net_variance || 0).toLocaleString()}</div><div className="text-xs text-gray-400">Additional if all attend</div></div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-700/50 text-left">
                    <th className="px-3 py-2 font-medium">Employee</th>
                    <th className="px-3 py-2 font-medium">Salary Type</th>
                    <th className="px-3 py-2 font-medium">Arrangement</th>
                    <th className="px-3 py-2 font-medium">Attendance</th>
                    <th className="px-3 py-2 font-medium text-right">Base (Period)</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                    <th className="px-3 py-2 font-medium text-right">Month if all attend</th>
                    <th className="px-3 py-2 font-medium text-right">Remaining days if attend</th>
                    <th className="px-3 py-2 font-medium">Existing Slip</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.employees || []).map((row: any) => (
                    <tr key={row.employee_id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-2 font-medium">{row.employee_name}</td>
                      <td className="px-3 py-2">{row.salary_type || 'MONTHLY'}</td>
                      <td className="px-3 py-2 text-xs">{CALC_METHOD_LABELS[row.calculation_method] || row.calculation_method || '—'}</td>
                      <td className="px-3 py-2">{row.attendance_required !== false ? 'Required' : <span className="text-amber-600 font-medium">Not required (fixed)</span>}</td>
                      <td className="px-3 py-2 text-right">LKR {(row.base_salary_for_period || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold">LKR {(row.net_salary || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right" title={`Projection if all remaining working days are attended (base + allowance + OT so far − EPF)`}>
                        {(() => {
                          const f = projectRow(row)
                          const extra = f.projected - (row.net_salary || 0)
                          return (
                            <>
                              <span className="font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">LKR {f.projected.toLocaleString()}</span>
                              {extra > 0 && (
                                <span className="block text-[10px] text-green-600 dark:text-green-400">+ LKR {extra.toLocaleString()} if all attend</span>
                              )}
                            </>
                          )
                        })()}
                      </td>
                      <td
                        className="px-3 py-2 text-right"
                        title={`Working days left in the month: ${remainingRow(row).remaining_working_days} — extra the employee can earn if they attend them all (base + allowance pro-rata; OT not assumed)`}>
                        {(() => {
                          const r = remainingRow(row)
                          return (
                            <>
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">+ LKR {r.remaining_amount.toLocaleString()}</span>
                              <span className="block text-[10px] text-gray-400">{r.remaining_working_days} working days left</span>
                            </>
                          )
                        })()}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.existing_slip_status ? <span className="text-green-600">{row.existing_slip_status}</span> : <span className="text-gray-400">—</span>}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => openOverride(row)}
                          disabled={!!row.existing_slip_id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={row.existing_slip_id ? 'A slip already exists for this month — finalize-protected' : 'Override this month\'s arrangement before running payroll'}>
                          <Settings2 size={12} /> Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Employee</label>
            <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
              <option value="">All Employees</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          {tab === 'ACTIVE' && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="FINALIZED">Finalized</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
            <input type="number" value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500 py-2">{slipsData.total} slip{slipsData.total !== 1 ? 's' : ''} found</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 font-medium">Slip #</th>
                <th className="text-left px-4 py-3 font-medium">Employee</th>
                <th className="text-left px-4 py-3 font-medium">Arrangement</th>
                <th className="text-left px-4 py-3 font-medium">Period</th>
                <th className="text-right px-4 py-3 font-medium">Earnings</th>
                <th className="text-right px-4 py-3 font-medium">Deductions</th>
                <th className="text-right px-4 py-3 font-medium">Net Salary</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8"><LoadingSpinner size="sm" /></td></tr>
              ) : slipsData.items.length === 0 ? (
                <TableEmptyRow
                  colSpan={9}
                  title={tab === 'DELETED' ? 'No deleted salary slips' : 'No salary slips found'}
                  description={tab === 'DELETED' ? 'Slips you delete will be listed here.' : 'Generated salary slips will appear here.'}
                />
              ) : (
                slips.map((slip: any) => (
                  <tr key={slip.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-mono text-xs">{slip.slip_number}</td>
                    <td className="px-4 py-3">{slip.employee_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {CALC_METHOD_LABELS[slip.calculation_method] || slip.calculation_method || slip.salary_type || '—'}
                      {slip.attendance_required === false && <span className="ml-1 text-amber-600 font-medium">· fixed</span>}
                    </td>
                    <td className="px-4 py-3">{slip.period_start}</td>
                    <td className="px-4 py-3 text-right">LKR {(slip.total_earnings || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-red-600">LKR {(slip.total_deductions || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold">LKR {(slip.net_salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[slip.status] || ''}`}>
                          {slip.status}
                        </span>
                        {slip.paid && (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" title={`Paid ${slip.paid_date} — LKR ${slip.amount_paid}`}>
                            Paid LKR {(slip.amount_paid || 0).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setViewSlip(slip)} className="p-1.5 hover:bg-gray-100 rounded" title="View">
                          <Eye size={14} />
                        </button>
                        {slip.status === 'DRAFT' && (
                          <button onClick={() => finalizeMut.mutate(slip.id)} className="p-1.5 hover:bg-green-100 text-green-600 rounded" title="Finalize" disabled={finalizeMut.isPending}>
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {slip.status === 'FINALIZED' && !slip.paid && (
                          <button onClick={() => handleMarkPaid(slip)} className="p-1.5 hover:bg-sky-100 text-sky-600 rounded" title="Mark Paid" disabled={payMut.isPending}>
                            <Wallet size={14} />
                          </button>
                        )}
                        {slip.status !== 'PAID' && slip.status !== 'CANCELLED' && slip.status !== 'DELETED' && (
                          <button
                            onClick={() => { if (confirm('Cancel this salary slip? Advances will be restored.')) cancelMut.mutate(slip.id) }}
                            className="p-1.5 hover:bg-red-100 text-red-600 rounded" title="Cancel" disabled={cancelMut.isPending}>
                            <XCircle size={14} />
                          </button>
                        )}
                        {slip.status === 'CANCELLED' && (
                          <button
                            onClick={() => { if (confirm('Delete this cancelled salary slip? It will be moved to the Deleted section and excluded from all calculations.')) deleteMut.mutate(slip.id) }}
                            className="p-1.5 hover:bg-gray-200 text-gray-600 rounded" title="Delete" disabled={deleteMut.isPending}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination total={slipsData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />

      {overrideEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-semibold flex items-center gap-2"><Settings2 size={18} /> Adjust Month Arrangement</h3>
              <button onClick={() => setOverrideEmp(null)}><XCircle size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {overrideEmp.name} · {overrideMonth} — saved as a per-month override for this employee. Past finalized months are never changed.
            </p>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data: any = { ...overrideEmp }
              PACKAGE_KEYS.forEach(k => { data[k] = Number(fd.get(k as string)) || 0 })
              data.salary_type = fd.get('salary_type') as string
              data.allowance_type = (fd.get('allowance_type') as string) || 'FIXED'
              data.epf_base = (fd.get('epf_base') as string) || 'ADJUSTED'
              data.attendance_required = fd.get('attendance_required') === 'on'
              data.month = overrideMonth
              data.salary_components = []
              overrideMut.mutate(data)
            }} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Pay Frequency</label>
                <select name="salary_type" defaultValue={overrideEmp.salary_type || 'MONTHLY'} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {SALARY_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="attendance_required" type="checkbox" defaultChecked={overrideEmp.attendance_required !== false} className="rounded" />
                Attendance required for salary <span className="text-[11px] text-gray-400">(off = fixed amount, attendance not needed)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Basic Salary (month)</label>
                  <input name="basic_salary" type="number" step="0.01" defaultValue={overrideEmp.basic_salary} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Daily Rate</label>
                  <input name="daily_rate" type="number" step="0.01" defaultValue={overrideEmp.daily_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Weekly Rate</label>
                  <input name="weekly_rate" type="number" step="0.01" defaultValue={overrideEmp.weekly_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Contract Amount</label>
                  <input name="contract_amount" type="number" step="0.01" defaultValue={overrideEmp.contract_amount} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Overtime Rate (LKR/hr)</label>
                  <input name="overtime_rate" type="number" step="0.01" defaultValue={overrideEmp.overtime_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Allowance</label>
                  <input name="allowance" type="number" step="0.01" defaultValue={overrideEmp.allowance} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Allowance Type</label>
                  <select name="allowance_type" defaultValue={overrideEmp.allowance_type || 'FIXED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="FIXED">Fixed</option>
                    <option value="ADJUSTED">Adjusted</option>
                    <option value="ATTENDANCE">Attendance</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">EPF Base</label>
                  <select name="epf_base" defaultValue={overrideEmp.epf_base || 'ADJUSTED'} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="ADJUSTED">Adjusted</option>
                    <option value="ATTENDANCE">Attendance</option>
                    <option value="FULL">Full</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">EPF Rate %</label>
                  <input name="epf_rate" type="number" step="0.01" defaultValue={overrideEmp.epf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">ETF Rate %</label>
                  <input name="etf_rate" type="number" step="0.01" defaultValue={overrideEmp.etf_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOverrideEmp(null)} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={overrideMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">{overrideMut.isPending ? 'Saving…' : 'Save Arrangement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b px-6 py-3 flex items-center justify-between z-10">
              <h3 className="font-semibold">{viewSlip.slip_number} — {viewSlip.employee_name}</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border rounded-lg p-1">
                  <button
                    onClick={() => setSlipLang('EN')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${slipLang === 'EN' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    English
                  </button>
                  <button
                    onClick={() => setSlipLang('SI')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${slipLang === 'SI' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    සිංහල
                  </button>
                </div>
                <button onClick={() => handlePrint()} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setViewSlip(null)} className="p-1.5 hover:bg-gray-100 rounded">
                  <XCircle size={18} />
                </button>
              </div>
            </div>
            <div className="p-6" ref={slipRef}>
              <SalarySlipPrint slip={viewSlip} lang={slipLang} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}