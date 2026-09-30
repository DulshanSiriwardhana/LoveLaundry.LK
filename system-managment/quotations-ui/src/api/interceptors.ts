import type { AxiosError, AxiosInstance } from 'axios'
import { withNestedItems } from '../lib/api-normalise'

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null
let redirecting = false

/**
 * Register a handler invoked when the API returns 401 on a non-auth request.
 * The handler should perform a clean SPA redirect to the login page.
 * Resetting the handler (passing null) also clears the one-shot redirect guard.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
  if (handler) redirecting = false
}

/**
 * Reduce any thrown value to a human-readable message.
 *
 * FastAPI reports validation problems as a `detail` that is sometimes a string
 * and sometimes an array of objects. Rendering the latter directly produces
 * "[object Object]" in the UI, so it is serialised here instead.
 *
 * Exported for clients that must not run the session-expiry path — the AI
 * service authenticates with a request signature, so a 401 there means a bad
 * signature rather than a logged-out user, and tearing the session down would
 * be wrong.
 */
export function extractResponseMessage(err: unknown): string {
  const detail = (err as AxiosError | undefined)?.response?.data as
    | { detail?: unknown }
    | undefined
  const value = detail?.detail
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    try {
      const serialized = JSON.stringify(value)
      if (serialized && serialized !== '{}') return serialized
    } catch {
      /* ignore */
    }
  }
  if (err instanceof Error && err.message) return err.message
  return 'Request failed'
}

function extractMessage(err: AxiosError): string {
  return extractResponseMessage(err)
}

/**
 * Attaches a response interceptor that:
 *  - Repairs omitted collections before any consumer sees the payload.
 *  - Never force-reloads the page or hijacks login errors.
 *  - On 401 (outside auth endpoints) triggers a single clean SPA logout redirect.
 *  - Normalizes error messages so they are never "[object Object]".
 */
export function attachResponseInterceptor(instance: AxiosInstance) {
  instance.interceptors.response.use(
    (response) => {
      // The API is free to answer `null` instead of `[]`, and a row can come
      // back without its `items` array even though the types say otherwise.
      // Repaired once here, centrally, because a per-page `?? []` at every
      // access is exactly the guard that gets forgotten — and one missed
      // `null.items` throws into the route error boundary and replaces the
      // whole page with "Error 500".
      if (response.data != null && typeof response.data === 'object') {
        response.data = withNestedItems(response.data)
      }
      return response
    },
    (err: AxiosError) => {
      if (err.response?.status === 401) {
        // Classify the endpoint *before* touching storage. A rejected login is
        // itself a 401; tearing down the session there would log the user out
        // for typing the wrong password while signed in on another tab.
        const url = (err.config?.url ?? '').toLowerCase()
        const isAuthCall =
          url.includes('/auth/login') ||
          url.includes('/token') ||
          url.includes('/auth/')
        if (!isAuthCall) {
          localStorage.removeItem('ll_token')
          localStorage.removeItem('ll_user')
          if (!redirecting && unauthorizedHandler) {
            redirecting = true
            unauthorizedHandler()
          }
        }
      }
      // Preserve the original error's shape (including .response) so that
      // React Query's retry policy and other handlers can still read status
      // codes — only normalize the human-readable message.
      const normalized = new Error(extractMessage(err)) as Error & {
        response?: AxiosError['response']
        config?: AxiosError['config']
      }
      normalized.response = err.response
      normalized.config = err.config
      return Promise.reject(normalized)
    }
  )
}
