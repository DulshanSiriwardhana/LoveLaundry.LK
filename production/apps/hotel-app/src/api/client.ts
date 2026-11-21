import axios from 'axios'
import { clearSession, getToken } from '../session'

/** Sign-in, session status, and hotel client auth. */
export const authApi = axios.create({
  baseURL: import.meta.env.VITE_USER_API_URL ?? '/api/user',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

/** Operational data (bills, gate passes, linens, ...). */
export const dataApi = axios.create({
  baseURL: import.meta.env.VITE_BILL_API_URL ?? '/api/bills',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

for (const instance of [authApi, dataApi]) {
  instance.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      // Only 401 means "this session is gone". A 403 means the account exists
      // but may not do this — dropping the session there would sign out a user
      // for opening a page they were never allowed to see.
      if (status === 401) {
        clearSession()
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login')
        }
      }
      return Promise.reject(error)
    },
  )
}

/** One selectable tenant from an ambiguous client login. */
export interface LaundryChoice {
  id: string
  name: string
  clientType?: string
  clientName?: string
}

/** The structured 409 payload returned when a login matches several laundries. */
export interface LoginChoice {
  code: string
  message: string
  laundries: LaundryChoice[]
}

/** Read the structured 409 without turning it into a generic request error. */
export function laundryChoices(error: unknown): LoginChoice | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
  if (!detail || typeof detail !== 'object') return null
  const value = detail as Partial<LoginChoice>
  if (value.code !== 'laundry_required') return null
  const rawLaundries: unknown[] = Array.isArray(value.laundries) ? value.laundries : []
  const laundries = rawLaundries
    .map((item: unknown) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return {
        id: String(row.laundry_id ?? row.id ?? ''),
        name: String(row.laundry_name ?? row.name ?? ''),
        clientType: row.client_type ? String(row.client_type) : undefined,
        clientName: row.client_name ? String(row.client_name) : undefined,
      }
    })
    .filter((item: LaundryChoice) => item.id)
  return {
    code: 'laundry_required',
    message:
      typeof value.message === 'string' && value.message.trim()
        ? value.message
        : 'This login matches more than one laundry. Choose one to continue.',
    laundries,
  }
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    const choice = laundryChoices(error)
    if (choice) return choice.message
    if (detail && typeof detail === 'object') {
      const message = (detail as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message
    }
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Try again.'
    if (!error.response) return 'Cannot reach the server. Check your connection.'
  }
  return 'Something went wrong. Try again.'
}
