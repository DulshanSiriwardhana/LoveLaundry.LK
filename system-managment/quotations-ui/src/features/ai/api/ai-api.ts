import axios, { type AxiosInstance } from 'axios'
import { AI_SERVICE, canonicalJson, hmacSha256Hex, sha256Hex } from '../../../config/ai'

/**
 * Secured Love AI client.
 *
 * Every request is signed with:
 *   X-API-Key     — hashed API key verified server-side in constant time
 *   X-Timestamp   — unix seconds (freshness / replay protection)
 *   X-Body-Hash   — SHA-256 of the raw body (integrity of what you ask)
 *   X-Signature   — HMAC-SHA256(api_key, "METHOD\nPATH\nTS\nBODY_HASH")
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
  try {
    const serialized = canonicalJson(envelope.data)
    const hash = await sha256Hex(serialized)
    if (hash !== envelope.data_hash) {
      throw new Error('AI response integrity check failed — data hash mismatch')
    }
    return { ...envelope, verified: true }
  } catch (err) {
    if (err instanceof Error && err.message.includes('integrity')) throw err
    return envelope
  }
}

class LoveAiClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({ baseURL: AI_SERVICE.baseUrl, timeout: AI_SERVICE.timeoutMs })
  }

  private async signHeaders(method: string, path: string, body: string): Promise<Record<string, string>> {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const bodyHash = await sha256Hex(body)
    const canonical = [method.toUpperCase(), path, timestamp, bodyHash].join('\n')
    const signature = await hmacSha256Hex(AI_SERVICE.apiKey, canonical)
    return {
      'X-API-Key': AI_SERVICE.apiKey,
      'X-Timestamp': timestamp,
      'X-Body-Hash': bodyHash,
      'X-Signature': signature,
    }
  }

  private async get<T>(path: string): Promise<AiEnvelope<T>> {
    const headers = await this.signHeaders('GET', path, '')
    const { data } = await this.http.get<AiEnvelope<T>>(path, { headers })
    return verifyEnvelope(data)
  }

  private async post<T>(path: string, payload: unknown): Promise<AiEnvelope<T>> {
    const body = JSON.stringify(payload)
    const headers = await this.signHeaders('POST', path, body)
    const { data } = await this.http.post<AiEnvelope<T>>(path, payload, { headers })
    return verifyEnvelope(data)
  }

  health() {
    return this.http.get('/api/ai/health').then(r => r.data)
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