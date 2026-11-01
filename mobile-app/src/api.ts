export interface LoginResponse {
  access_token: string
  token_type?: string
  user?: any
}

export interface Bill {
  id?: string
  client_name?: string
  quotation_title?: string | null
  grand_total?: number
  paid_amount?: number
  outstanding_amount?: number
  payment_status?: string
  created_at?: string
}

export interface ExpenseCategoryTotal {
  category: string
  total: number
  count: number
}

const TOKEN_KEY = 'll_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const saveSession = (token: string, user: any) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem('ll_user', JSON.stringify(user))
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('ll_user')
}

/** Today's calendar day in Sri Lanka time (UTC+05:30, fixed offset). */
export function getTodayStr(): string {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

const userBase = (): string => import.meta.env.VITE_USER_API_URL ?? 'http://localhost:8002'
const billsBase = (): string => import.meta.env.VITE_BILLS_API_URL ?? 'http://localhost:8001'
const mgmtBase = (): string => import.meta.env.VITE_MGMT_API_URL ?? 'http://localhost:8001'

const authHeaders = (token: string): HeadersInit => ({ Authorization: `Bearer ${token}` })

export async function login(username: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${userBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = (await res.json().catch(() => null)) as LoginResponse | null
  if (!res.ok || !data?.access_token) {
    throw Object.assign(new Error((data as any)?.detail || 'Login failed. Please check your credentials.'), { status: res.status })
  }
  const user = data.user ?? { auth_id: username }
  saveSession(data.access_token, user)
  return { token: data.access_token, user }
}

export async function fetchBillsForToday(token: string): Promise<Bill[]> {
  const today = getTodayStr()
  const res = await fetch(`${billsBase()}/bills?date_from=${today}T00:00:00&date_to=${today}T23:59:59&limit=5000`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw Object.assign(new Error('Failed to load today\'s income.'), { status: res.status })
  const data = (await res.json().catch(() => null)) as { items?: Bill[] } | null
  return Array.isArray(data?.items) ? data.items : []
}

export async function fetchExpensesToday(token: string): Promise<ExpenseCategoryTotal[]> {
  const today = getTodayStr()
  const res = await fetch(`${mgmtBase()}/expenses/summary?start_date=${today}&end_date=${today}`, {
    headers: authHeaders(token),
  })
  if (!res.ok) throw Object.assign(new Error('Failed to load today\'s expenses.'), { status: res.status })
  const data = (await res.json().catch(() => null)) as ExpenseCategoryTotal[] | null
  return Array.isArray(data) ? data : []
}
