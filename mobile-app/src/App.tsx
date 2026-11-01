import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import { clearSession } from './api'

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ll_token'))
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('ll_user') || 'null') } catch { return null }
  })
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('ll_token')
    if (t) {
      setToken(t)
      try { setUser(JSON.parse(localStorage.getItem('ll_user') || 'null')) } catch { setUser(null) }
    }
    setBooting(false)
  }, [])

  if (booting) {
    return (
      <div className="min-h-screen w-full bg-[#101828] flex items-center justify-center">
        <p className="text-white font-semibold">Loading LoveLaundry…</p>
      </div>
    )
  }

  if (!token || !user) {
    return <LoginPage onSuccess={(t: string, u: any) => { setToken(t); setUser(u) }} />
  }

  return (
    <DashboardPage
      token={token}
      user={user}
      onLogout={() => { clearSession(); setToken(null); setUser(null) }}
    />
  )
}
