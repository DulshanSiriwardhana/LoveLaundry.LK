import axios, { type AxiosInstance } from 'axios'
import { AI_SERVICE, assertAiConfiguration, canonicalJson, sha256Hex } from '../../../config/ai'
import { extractResponseMessage } from '../../../api/interceptors'
import { getActiveToken } from '../../../lib/auth-token'

/**
 * Love AI scopes insight requests from the authenticated user's JWT claims.
 * The service key must never be embedded in this browser client.
 *
 * Every response carries a `data_hash` (SHA-256 of the payload) which is
 * verified locally before the data is returned to the UI — so tampered or
 * corrupted responses are rejected at the client.
 */

export interface AiEnvelope<T> {
  data: T
  data_hash: string
  source: string
  verified: boolean
}

async function verifyEnvelope<T>(envelope: AiEnvelope<T>): Promise<AiEnvelope<T>> {
  if (!envelope || typeof envelope !== 'object' ||
      typeof envelope.data_hash !== 'string' ||
      !Object.prototype.hasOwnProperty.call(envelope, 'data')) {
    throw new Error('AI response integrity check failed — invalid response envelope')
  }
  const serialized = canonicalJson(envelope.data)
  const hash = await sha256Hex(serialized)
  if (hash !== envelope.data_hash) {
    throw new Error('AI response integrity check failed — data hash mismatch')
  }
  return { ...envelope, verified: true }
}

class LoveAiClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({ baseURL: AI_SERVICE.baseUrl, timeout: AI_SERVICE.timeoutMs })
  }

  private async authHeaders(): Promise<Record<string, string>> {
    assertAiConfiguration()
    const token = getActiveToken()
    if (!token) throw new Error('Sign in to access AI insights.')
    return { Authorization: `Bearer ${token}` }
  }

  private async get<T>(path: string): Promise<AiEnvelope<T>> {
    const headers = await this.authHeaders()
    const { data } = await this.http.get<AiEnvelope<T>>(path, { headers })
    return verifyEnvelope(data)
  }

  private async post<T>(path: string, payload: unknown): Promise<AiEnvelope<T>> {
    const headers = await this.authHeaders()
    const { data } = await this.http.post<AiEnvelope<T>>(path, payload, { headers })
    return verifyEnvelope(data)
  }

  /**
   * The shared response interceptor is deliberately not attached here so an
   * AI service error cannot trigger the main API's session-expiry redirect.
   * Normalize FastAPI detail arrays so the UI never displays "[object Object]".
   */
  private async request<T>(run: () => Promise<{ data: T }>): Promise<T> {
    try {
      return (await run()).data
    } catch (err) {
      throw new Error(extractResponseMessage(err))
    }
  }

  health() {
    return this.request(async () => {
      const path = '/api/ai/health'
      const headers = await this.authHeaders()
      return this.http.get(path, { headers })
    })
  }

  dashboard(months = 12) {
    return this.get<any>(`/api/ai/insights/dashboard?months=${months}`)
  }

  revenue(months = 12) {
    return this.get<any>(`/api/ai/insights/revenue?months=${months}`)
  }

  expenses(months = 12) {
    return this.get<any>(`/api/ai/insights/expenses?months=${months}`)
  }

  salary(months = 12) {
    return this.get<any>(`/api/ai/insights/salary?months=${months}`)
  }

  payrollRisk() {
    return this.get<any>('/api/ai/insights/payroll-risk')
  }

  query(metric: string, months: number) {
    return this.post<any>('/api/ai/insights/query', { metric, months })
  }
}

export const loveAi = new LoveAiClient()
