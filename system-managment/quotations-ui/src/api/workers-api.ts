import axios from 'axios'
import { attachResponseInterceptor } from './interceptors'
import { installOfflineAdapter } from '../cache/offline-adapter'

function normalizeBaseUrl(url: string): string {
  // Vercel redirects http -> https; preflight requests cannot follow
  // redirects, so force https for any non-local host.
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url.replace('http://', 'https://')
  }
  return url
}

const workersApi = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_WORKERS_API_URL ?? 'https://worker-service-zeta.vercel.app'),
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

workersApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

attachResponseInterceptor(workersApi)
installOfflineAdapter(workersApi, 'workers')

export default workersApi
