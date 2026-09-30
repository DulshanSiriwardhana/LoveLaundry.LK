import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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

export function formatDate(value?: string) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDateOnly(value?: string) {
  if (!value) {
    return '—'
  }

  const hasTime = value.includes('T') || value.includes(' ')
  const d = hasTime ? new Date(value) : new Date(`${value}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)
}
