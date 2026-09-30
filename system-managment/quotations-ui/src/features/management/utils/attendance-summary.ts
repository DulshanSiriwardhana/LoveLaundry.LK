export interface AttendanceRecord {
  id?: string
  employee_id: string
  date?: string
  day?: string
  status: string
  overtime_hours?: number
}

export interface StaffAttendanceSummary {
  employee_id: string
  worked_days: number
  half_days: number
  paid_leave_days: number
  unpaid_days: number
  overtime_hours: number
  holiday_count: number
  records: AttendanceRecord[]
}

const STATUS = {
  PRESENT: 'worked',
  HALF_DAY: 'half',
  PAID_LEAVE: 'paid',
  ON_LEAVE: 'paid',
  UNPAID_LEAVE: 'unpaid',
  ABSENT: 'unpaid',
} as const

export function buildHolidaySet(holidays: Array<{ date?: string; start_date?: string; end_date?: string }>): Set<string> {
  const set = new Set<string>()
  for (const h of holidays || []) {
    if (h.date) set.add(h.date)
    if (h.start_date && h.start_date !== h.date) set.add(h.start_date)
    if (h.end_date && h.end_date !== h.start_date && h.end_date !== h.date) {
      const from = h.start_date || h.date || ''
      const d = new Date(from)
      const end = new Date(h.end_date)
      while (d <= end) {
        set.add(d.toISOString().slice(0, 10))
        d.setDate(d.getDate() + 1)
      }
    }
  }
  return set
}

export function buildStaffSummary(
  records: AttendanceRecord[],
  holidays?: Array<{ date?: string; start_date?: string; end_date?: string }>,
): Record<string, StaffAttendanceSummary> {
  const holidaySet = buildHolidaySet(holidays || [])
  const map: Record<string, StaffAttendanceSummary> = {}
  for (const rec of records || []) {
    const empId = rec.employee_id
    if (!empId) continue
    const row = (map[empId] ??= {
      employee_id: empId,
      worked_days: 0,
      half_days: 0,
      paid_leave_days: 0,
      unpaid_days: 0,
      overtime_hours: 0,
      holiday_count: 0,
      records: [],
    })
    row.records.push(rec)
    const day = rec.date || rec.day || ''
    if (day && holidaySet.has(day)) row.holiday_count += 1
    const kind = STATUS[rec.status as keyof typeof STATUS]
    if (kind === 'worked') row.worked_days += 1
    if (kind === 'half') row.half_days += 1
    if (kind === 'paid') row.paid_leave_days += 1
    if (kind === 'unpaid') row.unpaid_days += 1
    row.overtime_hours += rec.overtime_hours || 0
  }
  return map
}