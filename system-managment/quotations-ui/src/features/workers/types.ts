export const TASK_TYPES = [
    'WASHING',
    'PRESSING',
    'FOLDING',
    'PACKING',
    'DRY_CLEANING',
    'STAIN_TREATMENT',
    'MACHINE_CLEANING',
    'SORTING_TAGGING',
    'DELIVERY_SUPPORT',
    'MAINTENANCE',
    'OTHER',
] as const

export const TASK_UNITS = ['PIECES', 'KG', 'LOADS', 'HOURS'] as const
export const DEPARTMENTS = [
    'WASHING',
    'PRESSING',
    'FINISHING',
    'PACKING',
    'DRY_CLEANING',
    'DELIVERY',
    'GENERAL',
] as const
export const SHIFTS = ['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY'] as const
export const ATTENDANCE_STATUSES = ['PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'] as const

export type TaskType = (typeof TASK_TYPES)[number]
export type TaskUnit = (typeof TASK_UNITS)[number]
export type Department = (typeof DEPARTMENTS)[number]
export type Shift = (typeof SHIFTS)[number]
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export interface TaskEntry {
    task_type: string
    description?: string | null
    quantity: number
    unit: string
    hours_spent?: number | null
    gate_pass_id?: string | null
    gate_pass_number?: string | null
    remark?: string | null
}

export interface Worker {
    id: string | number
    worker_name: string
    department: string
    phone?: string | null
    is_active: boolean
    joined_date?: string | null
    notes?: string | null
    created_at?: string
    updated_at?: string
}

export interface WorkerCreate {
    worker_name: string
    department: string
    phone?: string | null
    is_active: boolean
    joined_date?: string | null
    notes?: string | null
}

export interface DailyLog {
    id: string | number
    work_date: string
    worker_name: string
    department: string
    shift: string
    attendance_status: string
    check_in_time?: string | null
    check_out_time?: string | null
    overtime_hours: number
    washed_count: number
    pressed_count: number
    folded_count: number
    packed_count: number
    other_count: number
    total_weight_kg: number
    tasks: TaskEntry[]
    rewash_count: number
    damaged_items: number
    complaints: number
    quality_notes?: string | null
    machines_used?: string | null
    chemicals_used?: string | null
    notes?: string | null
    performance_rating?: number | null
    is_group_work?: boolean
    team_members?: string[]
    created_by?: string | null
    created_at?: string
    updated_at?: string
}

export interface DailyLogCreate {
    work_date: string
    worker_name: string
    is_group_work?: boolean
    team_members?: string[]
    department?: string
    shift?: string
    attendance_status?: string
    check_in_time?: string | null
    check_out_time?: string | null
    overtime_hours?: number
    washed_count?: number
    pressed_count?: number
    folded_count?: number
    packed_count?: number
    other_count?: number
    total_weight_kg?: number
    tasks: TaskEntry[]
    rewash_count?: number
    damaged_items?: number
    complaints?: number
    quality_notes?: string | null
    machines_used?: string | null
    chemicals_used?: string | null
    notes?: string | null
    performance_rating?: number | null
}

export interface DailySummary {
    date: string
    workers_logged: number
    present: number
    absent: number
    on_leave: number
    half_day: number
    total_washed: number
    total_pressed: number
    total_folded: number
    total_packed: number
    total_other: number
    total_weight_kg: number
    total_overtime_hours: number
    total_rewash: number
    total_damaged: number
    total_complaints: number
}

export function todayISO(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
