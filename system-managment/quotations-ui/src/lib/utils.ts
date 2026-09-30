import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatCalendarDate, formatDateTime } from './time'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(value)
}

/** Sri Lanka time (UTC+05:30) — see `./time`. */
export function formatDate(value?: string) {
  return formatDateTime(value)
}

export function formatDateOnly(value?: string) {
  return formatCalendarDate(value)
}
