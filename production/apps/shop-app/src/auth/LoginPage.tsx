import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { errorMessage, laundryChoices, type LoginChoice } from '../api/client'
import { appConfig } from '../config/app'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [choice, setChoice] = useState<LoginChoice | null>(null)
  const [laundryId, setLaundryId] = useState('')

  if (isAuthenticated) return <Navigate to="/" replace />

  const isClient = appConfig.authKind === 'client'

  async function submit(selectedLaundry?: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await signIn({ username, password, laundryId: selectedLaundry })
      setChoice(null)
    } catch (caught) {
      const options = laundryChoices(caught)
      if (options && options.laundries.length > 0) {
        setChoice(options)
        setLaundryId(options.laundries[0].id)
        setError(null)
        return
      }
      setChoice(null)
      setError(caught instanceof Error && caught.message ? caught.message : errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!choice) void submit()
  }

  return (
    <main className="login-shell">
      <div className="login-shell__glow" aria-hidden="true" />
      <section className="login-card">
        <div className="login-card__header">
          <span className="login-mark" aria-hidden="true">LL</span>
          <p className="eyebrow">Love Laundry · secure access</p>
          <h1>{appConfig.title}</h1>
          <p className="muted">{appConfig.tagline}</p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span className="field__label">{isClient ? 'Hotel login ID' : 'Username'}</span>
            <input
              className="field__input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder={isClient ? 'e.g. hotel-001' : 'Your username'}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="field__input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <p role="alert" className="alert alert--error">{error}</p> : null}

          {choice ? (
            <div className="laundry-choice" role="alert">
              <p className="laundry-choice__message">{choice.message}</p>
              <label className="field">
                <span className="field__label">Laundry</span>
                <select
                  className="field__input"
                  value={laundryId}
                  onChange={(event) => setLaundryId(event.target.value)}
                >
                  {choice.laundries.map((item) => (
                    <option key={item.id} value={item.id}>{item.name || item.id}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn--primary btn--block"
                disabled={pending || !laundryId}
                onClick={() => void submit(laundryId)}
              >
                {pending ? 'Signing in…' : 'Continue with selected laundry'}
              </button>
            </div>
          ) : (
            <button type="submit" className="btn btn--primary btn--block" disabled={pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          )}
        </form>

        <p className="login-card__footer">
          Access is limited to accounts registered for this workspace.
        </p>
      </section>
    </main>
  )
}
