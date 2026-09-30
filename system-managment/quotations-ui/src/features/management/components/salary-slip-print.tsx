import { COMPANY } from '../../../config/company'
import { monthName as monthNameOf } from '../../../lib/time'

interface SalarySlipProps {
  slip: any
  lang?: 'EN' | 'SI'
}

const T = {
  EN: {
    title: 'Salary Slip',
    employee: 'Employee',
    status: 'Status',
    salaryType: 'Salary Type',
    period: 'Period',
    department: 'Department',
    paidDate: 'Paid Date',
    attendance: 'Attendance',
    calendarDays: 'Calendar Days',
    workingDays: 'Working Days',
    workedDays: 'Worked Days',
    leaveDays: 'Leave Days',
    absentDays: 'Absent Days',
    holidays: 'Holidays',
    weekends: 'Weekends',
    epfEtf: 'EPF / ETF',
    epfEtfBase: 'EPF / ETF · {base}',
    epfEmployee: 'EPF (Employee)',
    epfEmployer: 'EPF (Employer)',
    etfEmployer: 'ETF (Employer)',
    fullBase: 'Full Base',
    adjustedBase: 'Adjusted Base',
    attendanceBase: 'Attendance Base',
    earnings: 'Earnings',
    basicSalary: 'Basic Salary',
    adjustedBaseLabel: 'Adjusted Base',
    baseForPeriod: 'Base for Period',
    overtime: 'Overtime',
    extraWork: 'Extra Work',
    bonus: 'Bonus',
    otherPayments: 'Other Payments',
    allowances: 'Allowances',
    totalEarnings: 'Total Earnings',
    attendanceNotRequired: 'Attendance not required — fixed salary arrangement',
    arrangement: 'Arrangement',
    deductions: 'Deductions',
    epfDeduction: 'EPF Deduction',
    advanceDeductions: 'Advance Deductions',
    loanDeduction: 'Loan Deduction',
    otherDeductions: 'Other Deductions',
    totalDeductions: 'Total Deductions',
    advanceDetails: 'Advance Details',
    date: 'Date',
    original: 'Original',
    deducted: 'Deducted',
    reason: 'Reason',
    netSalary: 'Net Salary',
    netSalaryPaid: 'Net Salary · Paid',
    notes: 'Notes',
    employeeSig: 'Employee Signature',
    authorizedSig: 'Authorized Signature',
    days: (n: number) => `${n} days`,
    daysWorked: (n: number) => `${n} days worked`,
    hrs: 'hrs',
    statusLabel: (s: string) => ({ DRAFT: 'DRAFT', FINALIZED: 'FINALIZED', CANCELLED: 'CANCELLED', DELETED: 'DELETED' }[s] || s),
  },
  SI: {
    title: 'වැටුප් ස්ලිපය',
    employee: 'සේවකයා',
    status: 'තත්ත්වය',
    salaryType: 'වැටුප් වර්ගය',
    period: 'කාල සීමාව',
    department: 'අංශය',
    paidDate: 'ගෙවූ දිනය',
    attendance: 'පැමිණීම',
    calendarDays: 'කැලැන්ඩර් දින',
    workingDays: 'වැඩකිරීමේ දින',
    workedDays: 'වැඩ කළ දින',
    leaveDays: 'නිවාඩු දින',
    absentDays: 'නොපැමිණි දින',
    holidays: 'පොදු නිවාඩු',
    weekends: 'සති අන්ත දින',
    epfEtf: 'EPF / ETF',
    epfEtfBase: 'EPF / ETF · {base}',
    epfEmployee: 'සේවක EPF',
    epfEmployer: 'සේවා යෝජක EPF',
    etfEmployer: 'සේවා යෝජක ETF',
    fullBase: 'සම්පූර්ණ පදනම',
    adjustedBase: 'සකස් කළ පදනම',
    attendanceBase: 'පැමිණීම් පදනම',
    earnings: 'ඉපැයීම්',
    basicSalary: 'මූලික වැටුප',
    adjustedBaseLabel: 'සකස් කළ මූලික',
    baseForPeriod: 'කාලය සඳහා මූලික',
    overtime: 'අධිකාල වැඩ',
    extraWork: 'අතිරේක වැඩ',
    bonus: 'උපදේශන/ප්රසාද',
    otherPayments: 'වෙනත් ගෙවීම්',
    allowances: 'දීමනා',
    totalEarnings: 'මුළු ඉපැයීම්',
    attendanceNotRequired: 'පැමිණීම අවශ්ය නොවේ — ස්ථිර වැටුප් සකස් කිරීම',
    arrangement: 'සකස් කිරීම',
    deductions: 'අඩුකිරීම්',
    epfDeduction: 'EPF අඩුකිරීම',
    advanceDeductions: 'අත්තිකාරම් අඩුකිරීම්',
    loanDeduction: 'ණය අඩුකිරීම',
    otherDeductions: 'වෙනත් අඩුකිරීම්',
    totalDeductions: 'මුළු අඩුකිරීම්',
    advanceDetails: 'අත්තිකාරම් විස්තර',
    date: 'දිනය',
    original: 'මුල් මුදල',
    deducted: 'අඩු කළ',
    reason: 'හේතුව',
    netSalary: 'ශුද්ධ වැටුප',
    netSalaryPaid: 'ශුද්ධ වැටුප · ගෙවා ඇත',
    notes: 'සටහන්',
    employeeSig: 'සේවක අත්සන',
    authorizedSig: 'බලයලත් අත්සන',
    days: (n: number) => `දින ${n}`,
    daysWorked: (n: number) => `වැඩකළ දින ${n}`,
    hrs: 'පැය',
    statusLabel: (s: string) => ({ DRAFT: 'කෙටුම්පත', FINALIZED: 'අවසන්', CANCELLED: 'අවලංගු', DELETED: 'මකා දමා ඇත' }[s] || s),
  },
}

const SI_MONTHS = ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්රේල්', 'මැයි', 'ජූනි', 'ජුලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්']

export function SalarySlipPrint({ slip, lang = 'EN' }: SalarySlipProps) {
  if (!slip) return null

  const isSi = lang === 'SI'
  const t = T[isSi ? 'SI' : 'EN']
  const fontFamily = isSi
    ? '"Noto Sans Sinhala", "Iskoola Pota", "FMAbhaya", "Bhashitha", "Nirmala UI", sans-serif'
    : '"Spectral", Georgia, serif'
  const prefix = isSi ? 'රු. ' : 'LKR '
  const formatRs = (val: number) => `${prefix}${Number(val || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const [periodYear, periodMonthIndex] = slip.period_start ? slip.period_start.split('-').map(Number) : [0, 0]
  const periodMonth = slip.period_start
    ? isSi
      ? `${SI_MONTHS[(periodMonthIndex || 1) - 1]} ${periodYear}`
      : monthNameOf(slip.period_start)
    : ''

  const baseLabel = isSi
    ? slip.epf_base === 'FULL' ? t.fullBase : slip.epf_base === 'ATTENDANCE' ? t.attendanceBase : t.adjustedBase
    : slip.epf_base === 'FULL' ? t.fullBase : slip.epf_base === 'ATTENDANCE' ? t.attendanceBase : t.adjustedBase

  return (
    <div className="w-full max-w-[800px] mx-auto bg-white text-black" style={{ fontFamily }}>
      <style>{`
        ${isSi ? `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700;800&display=swap');` : ''}
        @media print {
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
        }
        .slip-container { border: 1.5px solid #E01E31; padding: 0; }
        .slip-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 20px; border-bottom: 1.5px solid #E01E31; }
        .brand-logo { width: 44px; height: 44px; object-fit: contain; background: #fff; border: 1.5px solid #E01E31; border-radius: 50%; padding: 5px; box-sizing: border-box; flex-shrink: 0; }
        .brand-name { font-weight: 700; letter-spacing: -0.25px; font-size: 20px; color: #E01E31; line-height: 1.15; }
        .brand-tagline { font-size: 11px; color: #6B7280; margin-top: 1px; }
        .brand-contact { font-size: 10px; color: #9CA3AF; margin-top: 4px; line-height: 1.45; }
        .doc-meta { text-align: right; }
        .doc-title { font-size: 17px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #E01E31; line-height: 1.1; }
        .doc-period { font-size: 12px; color: #374151; margin-top: 3px; font-weight: 600; }
        .slip-body { padding: 10px 20px 14px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; background: #FDF6F7; border: 1px solid #F3C9CE; border-radius: 6px; padding: 7px 12px; }
        .info-row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; font-size: 12px; }
        .info-label { color: #6B7280; font-weight: 500; }
        .info-value { font-weight: 700; text-align: right; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; margin-top: 8px; }
        .section-title { color: #E01E31; border-left: 3px solid #E01E31; padding: 1px 0 1px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .calc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .calc-table td { padding: 2.5px 6px; border-bottom: 1px solid #F7E5E7; }
        .calc-table tr:last-child td { border-bottom: none; }
        .calc-table td:last-child { text-align: right; font-weight: 600; }
        .calc-table tr.total-row td { border-top: 1.5px solid #E01E31; border-bottom: none; font-weight: 800; color: #B71C1C; }
        .calc-table td .sub { display: block; font-size: 10px; color: #9CA3AF; font-weight: 400; }
        .advance-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .advance-table th { text-align: left; padding: 3px 6px; color: #B71C1C; font-weight: 700; border-bottom: 1.5px solid #E01E31; }
        .advance-table th:last-child { text-align: right; }
        .advance-table td { padding: 2.5px 6px; border-bottom: 1px solid #F7E5E7; }
        .advance-table td:last-child { text-align: right; }
        .net-salary { display: flex; align-items: center; justify-content: space-between; border: 1.5px solid #E01E31; border-radius: 6px; padding: 9px 16px; margin-top: 10px; background: #fff; }
        .net-salary .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #B71C1C; }
        .net-salary .amount { font-size: 24px; font-weight: 800; color: #E01E31; }
        .slip-footer { display: flex; justify-content: space-between; align-items: flex-end; padding: 6px 20px 0; margin-top: 2px; font-size: 11px; }
        .sig-line { border-top: 1px solid #1F2937; width: 30%; text-align: center; padding-top: 4px; }
        .slip-number { font-size: 10px; color: #9CA3AF; }
        .status-badge { display: inline-block; padding: 1px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .status-DRAFT { background: #fef3c7; color: #92400e; }
        .status-FINALIZED { background: #d1fae5; color: #065f46; }
        .status-CANCELLED { background: #fee2e2; color: #991b1b; }
        .status-DELETED { background: #e5e7eb; color: #4b5563; }
      `}</style>

      <div className="slip-container">
        <div className="slip-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img className="brand-logo" src="/icon.png" alt="Love Laundry" />
            <div>
              <div className="brand-name">{COMPANY.name}</div>
              <div className="brand-tagline">{COMPANY.tagline}</div>
              <div className="brand-contact">
                {COMPANY.address.line1}, {COMPANY.address.line2}<br />
                Tel: {COMPANY.phone.primary} | {COMPANY.phone.secondary}
              </div>
            </div>
          </div>
          <div className="doc-meta">
            <div className="doc-title">{t.title}</div>
            <div className="doc-period">{periodMonth}</div>
            <div className="slip-number" style={{ marginTop: 3 }}>{slip.slip_number || slip.id || ''}</div>
          </div>
        </div>

        <div className="slip-body">
          <div className="info-grid">
            <div className="info-row"><span className="info-label">{t.employee}</span><span className="info-value">{slip.employee_name}</span></div>
            <div className="info-row"><span className="info-label">{t.status}</span><span className="info-value"><span className={`status-badge status-${slip.status}`}>{t.statusLabel(slip.status)}</span></span></div>
            <div className="info-row"><span className="info-label">{t.salaryType}</span><span className="info-value">{slip.salary_type}{slip.attendance_required === false ? ' · Fixed' : ''}</span></div>
            <div className="info-row"><span className="info-label">{t.period}</span><span className="info-value">{slip.period_start} → {slip.period_end}</span></div>
            <div className="info-row"><span className="info-label">{t.department}</span><span className="info-value">{slip.department || '—'}</span></div>
            <div className="info-row"><span className="info-label">{t.paidDate}</span><span className="info-value">{slip.paid_date || '—'}</span></div>
          </div>

          <div className="two-col">
            <div>
              <div className="section-title">{slip.attendance_required === false ? t.attendanceNotRequired : t.attendance}</div>
              {slip.attendance_required !== false ? (
              <table className="calc-table">
                <tbody>
                  <tr><td>{t.calendarDays}</td><td>{slip.calendar_days}</td></tr>
                  <tr><td>{t.workingDays}</td><td>{slip.working_days}</td></tr>
                  <tr><td>{t.workedDays}</td><td style={{ color: '#16a34a' }}>{slip.worked_days}</td></tr>
                  {slip.leave_days > 0 && <tr><td>{t.leaveDays}</td><td style={{ color: '#2563eb' }}>{slip.leave_days}</td></tr>}
                  {slip.absent_days > 0 && <tr><td>{t.absentDays}</td><td style={{ color: '#dc2626' }}>{slip.absent_days}</td></tr>}
                  {slip.holiday_count > 0 && <tr><td>{t.holidays}</td><td style={{ color: '#9333ea' }}>{slip.holiday_count}</td></tr>}
                  {slip.weekend_count > 0 && <tr><td>{t.weekends}</td><td style={{ color: '#9333ea' }}>{slip.weekend_count}</td></tr>}
                </tbody>
              </table>
              ) : (
                <div style={{ fontSize: 12, color: '#92400e', background: '#FDF6F7', border: '1px solid #F3C9CE', padding: '8px 10px', borderRadius: 4, fontWeight: 600 }}>
                  {t.attendanceNotRequired}
                </div>
              )}
            </div>
            <div>
              <div className="section-title">{slip.epf_base ? `${t.epfEtf} · ${baseLabel}` : t.epfEtf}</div>
              <table className="calc-table">
                <tbody>
                  <tr><td>{t.epfEmployee}</td><td>{formatRs(slip.epf_employee)}</td></tr>
                  <tr><td>{t.epfEmployer}</td><td>{formatRs(slip.epf_employer)}</td></tr>
                  <tr><td>{t.etfEmployer}</td><td>{formatRs(slip.etf_employer)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 6 }}>
            <div>
              <div className="section-title">{t.earnings}</div>
              <table className="calc-table">
                <tbody>
                  <tr><td>{t.basicSalary}</td><td>{formatRs(slip.basic_salary)}</td></tr>
                  <tr><td>{t.adjustedBaseLabel}<div className="sub">{t.days(slip.calendar_days)}</div></td><td>{formatRs(slip.adjusted_base_salary)}</td></tr>
                  <tr><td>{t.baseForPeriod}<div className="sub">{t.daysWorked(slip.worked_days)}</div></td><td style={{ fontWeight: 700 }}>{formatRs(slip.base_salary_for_period ?? (slip.adjusted_base_salary * slip.worked_days / Math.max(slip.calendar_days, 1)))}</td></tr>
                  {slip.overtime_pay > 0 && <tr><td>{t.overtime}<div className="sub">{slip.overtime_hours} {t.hrs} × {Number(slip.overtime_rate || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></td><td>{formatRs(slip.overtime_pay)}</td></tr>}
                  {slip.extra_work_total > 0 && <tr><td>{t.extraWork}</td><td>{formatRs(slip.extra_work_total)}</td></tr>}
                  {slip.bonus > 0 && <tr><td>{t.bonus}</td><td>{formatRs(slip.bonus)}</td></tr>}
                  {slip.other_payments > 0 && <tr><td>{t.otherPayments}</td><td>{formatRs(slip.other_payments)}</td></tr>}
                  {slip.allowances > 0 && <tr><td>{t.allowances}</td><td>{formatRs(slip.allowances)}</td></tr>}
                  <tr className="total-row"><td>{t.totalEarnings}</td><td>{formatRs(slip.total_earnings)}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="section-title">{t.deductions}</div>
              <table className="calc-table">
                <tbody>
                  {slip.epf_employee > 0 && <tr><td>{t.epfDeduction}</td><td>{formatRs(slip.epf_employee)}</td></tr>}
                  {slip.advance_deductions > 0 && <tr><td>{t.advanceDeductions}</td><td>{formatRs(slip.advance_deductions)}</td></tr>}
                  {slip.loan_deduction > 0 && <tr><td>{t.loanDeduction}</td><td>{formatRs(slip.loan_deduction)}</td></tr>}
                  {slip.other_deductions > 0 && <tr><td>{t.otherDeductions}</td><td>{formatRs(slip.other_deductions)}</td></tr>}
                  <tr className="total-row"><td>{t.totalDeductions}</td><td>{formatRs(slip.total_deductions)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {(slip.advance_details || []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="section-title">{t.advanceDetails}</div>
              <table className="advance-table">
                <thead>
                  <tr><th>{t.date}</th><th>{t.original}</th><th>{t.deducted}</th><th style={{ textAlign: 'right' }}>{t.reason}</th></tr>
                </thead>
                <tbody>
                  {slip.advance_details.map((adv: any, i: number) => (
                    <tr key={i}>
                      <td>{adv.date}</td>
                      <td>{formatRs(adv.original_amount)}</td>
                      <td>{formatRs(adv.amount_deducted)}</td>
                      <td style={{ textAlign: 'right' }}>{adv.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="net-salary">
            <span className="label">{slip.paid ? t.netSalaryPaid : t.netSalary}</span>
            <span className="amount">{formatRs(slip.net_salary)}</span>
          </div>

          {slip.notes && (
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 8, padding: '6px 10px', background: '#ffffff', border: '1px solid #F3C9CE', borderLeft: '3px solid #E01E31', borderRadius: 4 }}>
              <strong>{t.notes}:</strong> {slip.notes}
            </div>
          )}
        </div>

        <div className="slip-footer">
          <div className="sig-line">{t.employeeSig}</div>
          <div className="sig-line">{t.authorizedSig}</div>
          <div className="sig-line">{t.date}</div>
        </div>
      </div>
    </div>
  )
}