import { useState } from 'react'
import { login } from '../api'
import { ThemeSwitcher } from '../ll-theme'

interface LoginPageProps {
  onSuccess: (token: string, user: any) => void
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { token, user } = await login(username.trim(), password)
      onSuccess(token, user)
    } catch (err: any) {
      setError(err?.message || 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-3 flex justify-end">
          <ThemeSwitcher compact />
        </div>
        <div className="mb-5 text-center">
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">LoveLaundry</h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-1">Hotel laundry analytics</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-[var(--border)] px-3 text-[14px] text-[var(--text-primary)] outline-none focus:border-[var(--brand)]"
            />
          </div>
          {error ? <p className="text-[12px] text-[var(--danger-text)]">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-[var(--brand-dark)] text-[var(--ll-white)] text-[14px] font-semibold disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-[var(--text-muted)]">Read-only daily income / expense analytics</p>
      </div>
    </div>
  )
}
