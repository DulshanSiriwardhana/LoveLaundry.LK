import axios from 'axios'
import { attachResponseInterceptor } from './interceptors'

const authApi = axios.create({
  baseURL: import.meta.env.VITE_USER_API_URL ?? 'http://localhost:8002',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

authApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

attachResponseInterceptor(authApi)

export default authApi
