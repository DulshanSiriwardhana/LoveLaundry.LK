import { useState, useRef, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeSlash, ArrowRight, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../../../context/AuthContext'
import { authService } from '../services/auth.service'
import { Logo } from '../../../components/brand/logo'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Field } from '../../../components/ui/field'

/**
 * Login — a single column form on a neutral surface.
 *
 * The error is a live region tied to the submit, so a screen reader announces a
 * failed sign-in rather than the user discovering a silent no-op. The submit
 * stays disabled until both fields have content, but `required` on the inputs
 * still guards a paste-and-submit, and the reason is stated rather than implied
 * by a greyed button.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const errorRef = useRef<HTMLDivElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authService.login({ username: username.trim(), password })
      login(res.access_token, res.user)
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Invalid username or password')
      // Put focus back where the correction happens.
      usernameRef.current?.select()
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = Boolean(username.trim() && password) && !loading

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 flex justify-center">
            <Logo size="lg" />
          </div>

          <div className="rounded-[10px] border border-[var(--border-2)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="mb-5">
              <h1 className="text-[17px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">
                Sign in
              </h1>
              <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">
                Use the account your administrator gave you.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              <Field
                id="username"
                label="Username or email"
                hint={error ? undefined : 'Case-insensitive.'}
              >
                <Input
                  ref={usernameRef}
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="e.g. dulshan"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    if (error) setError('')
                  }}
                  required
                  autoFocus
                  invalid={Boolean(error)}
                  className="h-10"
                />
              </Field>

              <Field id="password" label="Password">
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    invalid={Boolean(error)}
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    aria-pressed={showPw}
                    className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[5px] text-[var(--text-faint)] transition-colors duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  >
                    {showPw ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                  </button>
                </div>
              </Field>

              <div
                ref={errorRef}
                role="alert"
                tabIndex={-1}
                aria-live="assertive"
                className="empty:hidden"
              >
                {error && (
                  <div className="flex items-start gap-2 rounded-[7px] border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger-text)] outline-none">
                    <WarningCircle size={15} aria-hidden className="mt-px shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                  </div>
                )}
              </div>

              <Button
                id="login-submit"
                type="submit"
                disabled={!canSubmit}
                loading={loading}
                className="mt-1 w-full"
                size="lg"
              >
                {loading ? 'Signing in' : 'Sign in'}
              </Button>

              <p className="pt-1 text-center text-[11.5px] text-[var(--text-faint)]">
                Password forgotten? Ask an administrator to reset it.
              </p>
            </form>
          </div>

          {/* Guest pass is a different audience, not a lesser login: it is a
              separate surface with its own purpose, so it sits outside the
              credential card. */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/guest/shop')}
              className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-[var(--border-2)] bg-[var(--surface)] px-4 py-3 text-left transition-colors duration-100 hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                  Guest bill pass
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[var(--text-muted)]">
                  Look up a bill with a pass code — no account needed.
                </span>
              </span>
              <ArrowRight
                size={16}
                aria-hidden
                className="shrink-0 text-[var(--text-faint)] transition-colors group-hover:text-[var(--text-tertiary)]"
              />
            </button>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-6 text-center text-[11px] text-[var(--text-faint)]">
        Love Laundry · Operations system
      </footer>
    </div>
  )
}
