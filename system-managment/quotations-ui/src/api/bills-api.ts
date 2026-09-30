import axios from 'axios'
import { attachResponseInterceptor } from './interceptors'
import { installOfflineAdapter } from '../cache/offline-adapter'

const billsApi = axios.create({
  baseURL: import.meta.env.VITE_BILLS_API_URL ?? 'http://localhost:8001',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

billsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

attachResponseInterceptor(billsApi)
installOfflineAdapter(billsApi, 'bills')

export default billsApi