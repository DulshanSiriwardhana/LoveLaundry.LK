import axios from 'axios'
import { attachResponseInterceptor } from './interceptors'
import { installOfflineAdapter } from '../cache/offline-adapter'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

attachResponseInterceptor(api)
installOfflineAdapter(api, 'quotation')

export default api
