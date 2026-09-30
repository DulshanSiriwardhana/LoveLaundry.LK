import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { employeesApi, salaryApi } from '../api/management-api'
import { toast } from 'sonner'
import { Calculator, FileText, Printer, CheckCircle, Sparkles } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { SalarySlipPrint } from '../components/salary-slip-print'
import { PageHeader } from '../../../components/ui/page-header'
import { FilterBar } from '../../../components/ui/filter-bar'
import { Badge } from '../../../components/ui/badge'
import { ExportButton } from '../../../components/ui/export-button'
import { useEnterFlow } from '../../../hooks/use-enter-flow'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function SalarySlipPage() {
  const qc = useQueryClient()
  const slipRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  const paramEmp = searchParams.get('emp') || ''
  const paramYear = Number(searchParams.get('year')) || new Date().getFullYear()
  const paramMonth = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const [selectedEmp, setSelectedEmp] = useState(paramEmp)
  const [year, setYear] = useState(paramYear)
  const [month, setMonth] = useState(paramMonth)
  const didAutoCalc = useRef(false)
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'WEEKLY' | 'CUSTOM'>('MONTHLY')
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [calculation, setCalculation] = useState<any>(null)
  const [showSlip, setShowSlip] = useState(false)
  const [generatedSlip, setGeneratedSlip] = useState<any>(null)
  const [allowances, setAllowances] = useState(0)
  const [loanDeduction, setLoanDeduction] = useState(0)
  const [otherDeductions, setOtherDeductions] = useState(0)
  const [notes, setNotes] = useState('')
  const [slipLang, setSlipLang] = useState<'EN' | 'SI'>('EN')
  const flow = useEnterFlow<HTMLDivElement>()

  const { data: employees = [] } = useQuery({
    queryKey: ['mgmt-employees'],
    queryFn: () => employeesApi.list('').then(r => r.data),
  })

  useEffect(() => {
    const emp = searchParams.get('emp') || ''
    const y = Number(searchParams.get('year')) || new Date().getFullYear()
    const m = Number(searchParams.get('month')) || new Date().getMonth() + 1
    const valid = emp && employees.some((e: any) => e.id === emp)
    if (valid) {
      if (emp !== selectedEmp) { setSelectedEmp(emp); didAutoCalc.current = false }
      if (y !== year) setYear(y)
      if (m !== month) setMonth(m)
      if (!didAutoCalc.current) { didAutoCalc.current = true; calcMut.mutate() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, employees])

  const calcMut = useMutation({
    mutationFn: () => {
      if (periodType === 'WEEKLY' && weekStart && weekEnd)
        return salaryApi.calculatePeriod(selectedEmp, weekStart, weekEnd, 'WEEKLY').then(r => r.data)
      if (periodType === 'CUSTOM' && rangeStart && rangeEnd)
        return salaryApi.calculatePeriod(selectedEmp, rangeStart, rangeEnd, 'CUSTOM').then(r => r.data)
      return salaryApi.calculate(selectedEmp, year, month).then(r => r.data)
    },
    onSuccess: (res) => {
      setCalculation(res.data || res)
      setAllowances((res.data || res).allowance_for_period > 0 ? (res.data || res).allowance_for_period : 0)
      setLoanDeduction(0)
      setOtherDeductions(0)
      setNotes('')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Calculation failed'),
  })

  const generateMut = useMutation({
    mutationFn: (data: any) => salaryApi.createSlip(data),
    onSuccess: (res) => {
      toast.success('Salary slip generated')
      setGeneratedSlip(res.data)
      setShowSlip(true)
      qc.invalidateQueries({ queryKey: ['salary-slips'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Generation failed'),
  })

  const handlePrint = useReactToPrint({
    contentRef: slipRef,
    documentTitle: generatedSlip ? `SalarySlip-${generatedSlip.slip_number}` : 'SalarySlip',
  })

  const handleGenerate = () => {
    if (!calculation) return
    if (calculation.existing_slip_id) {
      toast.error('These dates are already covered by a previous salary slip')
      return
    }

    generateMut.mutate({
      employee_id: selectedEmp,
      period_type: calculation.period_type || periodType,
      period_start: calculation.period_start,
      period_end: calculation.period_end,
      basic_salary: calculation.basic_salary,
      adjusted_base_salary: calculation.adjusted_base_salary,
      base_salary_for_period: calculation.base_salary_for_period,
      calendar_days: calculation.calendar_days,
      working_days: calculation.total_working_days,
      worked_days: calculation.worked_days,
      absent_days: calculation.absent_days,
      leave_days: calculation.leave_days,
      holiday_count: calculation.holiday_count || 0,
      weekend_count: calculation.weekend_count || 0,
      overtime_hours: calculation.overtime_hours,
      overtime_rate: calculation.overtime_rate,
      overtime_pay: calculation.overtime_pay,
      allowances,
      allowance_details: [],
      bonus: calculation.bonus || 0,
      other_payments: calculation.other_payments || 0,
      components: calculation.components || [],
      attendance_required: calculation.attendance_required ?? true,
      calculation_method: calculation.calculation_method || 'MONTHLY_ATTENDANCE',
      extra_work_total: calculation.extra_work_total,
      extra_work_details: calculation.extra_work_details || [],
      epf_employee: calculation.epf_employee,
      epf_employer: calculation.epf_employer,
      etf_employer: calculation.etf_employer,
      epf_base: calculation.epf_base || 'ADJUSTED',
      advance_deductions: calculation.advance_deductions,
      advance_details: calculation.advance_details || [],
      loan_deduction: loanDeduction,
      other_deductions: (otherDeductions || 0) + (calculation.other_deductions || 0),
      status: 'DRAFT',
      notes,
    })
  }

  const attendanceRequired = calculation ? calculation.attendance_required !== false : true

  const rangeMissing = periodType === 'WEEKLY' ? !weekStart || !weekEnd
    : periodType === 'CUSTOM' ? !rangeStart || !rangeEnd
    : false

  const totalEarnings = calculation
    ? calculation.base_salary_for_period + calculation.overtime_pay + calculation.extra_work_total + allowances
      + (calculation.bonus || 0) + (calculation.other_payments || 0)
    : 0
  const totalDeductions = calculation
    ? calculation.epf_employee + calculation.advance_deductions + loanDeduction + otherDeductions + (calculation.other_deductions || 0)
    : 0
  const netSalary = totalEarnings - totalDeductions

  const calMethodLabel = (m: string) => ({
    MONTHLY_ATTENDANCE: 'Monthly · attendance-based',
    FIXED_MONTHLY: 'Monthly · fixed amount',
    WEEKLY_ATTENDANCE: 'Weekly · attendance-based',
    WEEKLY_FIXED: 'Weekly · fixed amount',
    DAILY_WORKED_DAYS: 'Daily · days worked',
    CONTRACT: 'Contract · fixed amount',
  }[m] || m || '')

  return (
    <div ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-6">
      <PageHeader
        title="Generate Salary Slip"
        subtitle="Calculate earnings & deductions for an employee period"
        actions={
          paramEmp ? (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 font-medium">
              <Sparkles size={15} /> Quick-launch from employee card — auto-calculated
            </span>
          ) : undefined
        }
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calculator size={20} /> Salary Calculation
        </h2>

        <FilterBar>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Employee</label>
            <select
              value={selectedEmp}
              onChange={e => { setSelectedEmp(e.target.value); setCalculation(null); setShowSlip(false) }}
              className="w-full min-w-[200px] mt-1 px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select Employee</option>
              {employees.filter((e: any) => e.is_active !== false || e.id === paramEmp).map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.salary_type || 'MONTHLY'}{e.attendance_required === false ? ' · fixed' : ''})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Period Type</label>
            <select
              value={periodType}
              onChange={e => { setPeriodType(e.target.value as any); setCalculation(null); setShowSlip(false) }}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="CUSTOM">Any Days Range</option>
            </select>
          </div>
          {periodType === 'MONTHLY' ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => { setYear(Number(e.target.value)); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Month</label>
                <select
                  value={month}
                  onChange={e => { setMonth(Number(e.target.value)); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </>
          ) : periodType === 'WEEKLY' ? (
            <>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Week Start</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={e => { setWeekStart(e.target.value); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Week End</label>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={e => { setWeekEnd(e.target.value); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Start Date</label>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={e => { setRangeStart(e.target.value); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">End Date</label>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={e => { setRangeEnd(e.target.value); setCalculation(null) }}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </>
          )}
          <div className="flex items-end">
            <button
              onClick={() => calcMut.mutate()}
              disabled={!selectedEmp || calcMut.isPending || rangeMissing}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              {calcMut.isPending ? 'Calculating...' : 'Calculate'}
            </button>
          </div>
        </FilterBar>
      </div>

      {calculation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            {attendanceRequired ? (
            <>
              <h3 className="font-semibold text-lg">Attendance & Base Salary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Salary Type</span><span className="font-medium">{calculation.salary_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Calendar Days</span><span className="font-medium">{calculation.calendar_days}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Working Days</span><span className="font-medium">{calculation.total_working_days}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Worked Days</span><span className="font-medium text-green-600">{calculation.worked_days}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Leave Days</span><span className="font-medium text-blue-600">{calculation.leave_days}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Absent Days</span><span className="font-medium text-red-600">{calculation.absent_days}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Holidays</span><span className="font-medium text-purple-600">{calculation.holiday_count || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Weekends</span><span className="font-medium text-purple-600">{calculation.weekend_count || 0}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Basic Salary</span><span className="font-medium">LKR {calculation.basic_salary.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Adjusted Base</span><span className="font-medium">LKR {calculation.adjusted_base_salary.toLocaleString()}</span></div>
              <div className="col-span-2 flex justify-between border-t pt-2">
                <span className="font-semibold">Base for Period</span>
                <span className="font-bold">LKR {calculation.base_salary_for_period.toLocaleString()}</span>
              </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-lg">Salary Arrangement</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Salary Type</span><span className="font-medium">{calculation.salary_type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-medium">{calMethodLabel(calculation.calculation_method)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Configured Amount</span><span className="font-medium">LKR {calculation.basic_salary.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Base for Period</span><span className="font-medium">LKR {calculation.base_salary_for_period.toLocaleString()}</span></div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                  Fixed salary arrangement — attendance is not required and does not affect this employee's pay. Prorated only for mid-period joins/leaves.
                </div>
              </>
            )}

            {calculation.existing_slip_id && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2 flex-wrap">
                These dates are already covered by a salary slip
                {calculation.existing_slip_period ? ` (${calculation.existing_slip_period})` : ' for this employee'}
                {' '}· Status:{' '}
                <Badge variant={calculation.existing_slip_status === 'PAID' ? 'success' : 'warning'}>
                  {calculation.existing_slip_status}
                </Badge>
                <span className="w-full">
                  A new slip may only cover dates that are not included in any previous slip. Cancel the existing slip first or choose different dates.
                </span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
            <h3 className="font-semibold text-lg">Earnings & Deductions</h3>

            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Earnings</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Base Salary (Period)</span><span>LKR {calculation.base_salary_for_period.toLocaleString()}</span></div>
                {calculation.overtime_pay > 0 && (
                  <div className="flex justify-between"><span>Overtime ({calculation.overtime_hours} hrs)</span><span>LKR {calculation.overtime_pay.toLocaleString()}</span></div>
                )}
                {calculation.extra_work_total > 0 && (
                  <div className="flex justify-between"><span>Extra Work</span><span>LKR {calculation.extra_work_total.toLocaleString()}</span></div>
                )}
                {calculation.bonus > 0 && (
                  <div className="flex justify-between text-green-700"><span>Bonus</span><span>LKR {calculation.bonus.toLocaleString()}</span></div>
                )}
                {calculation.other_payments > 0 && (
                  <div className="flex justify-between text-green-700"><span>Other Payments</span><span>LKR {calculation.other_payments.toLocaleString()}</span></div>
                )}
                {calculation.allowance > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Allowance ({calculation.allowance_type === 'ADJUSTED' || calculation.allowance_type === 'DAYS' ? 'adjusted' : calculation.allowance_type === 'ATTENDANCE' ? 'attendance base' : 'fixed'} {calculation.allowance_for_period > 0 && <>{calculation.allowance_for_period !== calculation.allowance ? `— LKR ${calculation.allowance} × ${((calculation.allowance_for_period / calculation.allowance) * 100).toFixed(1)}%` : ''}</>})</span>
                    <span>LKR {(calculation.allowance_for_period || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Allowances</span>
                  <input
                    type="number"
                    value={allowances}
                    onChange={e => setAllowances(Number(e.target.value) || 0)}
                    className="ml-auto w-32 px-2 py-1 border rounded text-sm text-right"
                  />
                </div>
              </div>

              <div className="border-t pt-3 text-sm font-medium text-gray-600 dark:text-gray-400">Deductions</div>
              <div className="space-y-2 text-sm">
                {calculation.epf_employee > 0 && (
                  <div className="flex justify-between"><span>EPF (Employee, {calculation.epf_base === 'FULL' ? 'full base' : calculation.epf_base === 'ATTENDANCE' ? 'attendance base' : 'adjusted base'})</span><span className="text-red-600">- LKR {calculation.epf_employee.toLocaleString()}</span></div>
                )}
                {calculation.advance_deductions > 0 && (
                  <div className="flex justify-between"><span>Advances</span><span className="text-red-600">- LKR {calculation.advance_deductions.toLocaleString()}</span></div>
                )}
                {calculation.other_deductions > 0 && (
                  <div className="flex justify-between"><span>Configured Deductions (components)</span><span className="text-red-600">- LKR {calculation.other_deductions.toLocaleString()}</span></div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Loan Deduction</span>
                  <input
                    type="number"
                    value={loanDeduction}
                    onChange={e => setLoanDeduction(Number(e.target.value) || 0)}
                    className="ml-auto w-32 px-2 py-1 border rounded text-sm text-right"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Other Deductions</span>
                  <input
                    type="number"
                    value={otherDeductions}
                    onChange={e => setOtherDeductions(Number(e.target.value) || 0)}
                    className="ml-auto w-32 px-2 py-1 border rounded text-sm text-right"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-lg"><span className="font-semibold">Total Earnings</span><span className="font-bold">LKR {totalEarnings.toLocaleString()}</span></div>
              <div className="flex justify-between text-lg"><span className="font-semibold">Total Deductions</span><span className="font-bold text-red-600">LKR {totalDeductions.toLocaleString()}</span></div>
              <div className="flex justify-between text-xl border-t pt-2"><span className="font-bold">Net Salary</span><span className="font-bold text-green-600">LKR {netSalary.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}

      {calculation && !showSlip && (
        <div className="flex gap-3 flex-wrap items-end">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <ExportButton data={[calculation]} filename={`salary-calc-${selectedEmp}-${year}-${month}`} label="Export Calc" />
          <button
            onClick={handleGenerate}
            disabled={generateMut.isPending || !!calculation?.existing_slip_id}
            title={calculation?.existing_slip_id ? 'These dates are already covered by a previous salary slip' : undefined}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2 self-end"
          >
            <FileText size={16} />
            {generateMut.isPending ? 'Generating...' : calculation?.existing_slip_id ? 'Dates Already Covered' : 'Generate Slip'}
          </button>
        </div>
      )}

      {showSlip && generatedSlip && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle size={20} className="text-green-600" /> Slip Generated: {generatedSlip.slip_number}
            </h2>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <button
                  onClick={() => setSlipLang('EN')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${slipLang === 'EN' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  English
                </button>
                <button
                  onClick={() => setSlipLang('SI')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${slipLang === 'SI' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  සිංහල
                </button>
              </div>
              <button
                onClick={() => handlePrint()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
              >
                <Printer size={16} /> Print
              </button>
              <button
                onClick={() => { setShowSlip(false); setGeneratedSlip(null); setCalculation(null) }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
              >
                New Calculation
              </button>
            </div>
          </div>
          <div ref={slipRef}>
            <SalarySlipPrint slip={generatedSlip} lang={slipLang} />
          </div>
        </div>
      )}
    </div>
  )
}
