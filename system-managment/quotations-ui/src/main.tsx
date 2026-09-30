import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { ErrorBoundary } from './components/ui/error-boundary'

// ---------------------------------------------------------------------------
// Stale-chunk recovery: when the app is open in a tab while a new deploy lands,
// the old index.html references chunk files that no longer exist, so the lazy
// import() 404s ("Failed to fetch dynamically imported module"). Vite's runtime
// fires a cancelable 'vite:preloadError' in that case — we swallow it and do one
// clean hard reload so the browser picks up the fresh index.html and new hashes.
// ---------------------------------------------------------------------------
const RECOVERY_KEY = 'll_stale_reload'
// Allow at most this many auto-reloads inside the window; if the fresh deploy
// is also broken we stop hammering reloads instead of looping forever.
const MAX_RELOADS = 2
const RECOVERY_WINDOW_MS = 60_000

const staleReload = (): void => {
  try {
    const now = Date.now()
    const raw = sessionStorage.getItem(RECOVERY_KEY)
    const cached = raw ? (JSON.parse(raw) as { t: number; n: number }) : null
    if (cached && now - cached.t < RECOVERY_WINDOW_MS) {
      if ((cached.n ?? 0) >= MAX_RELOADS) return
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ t: now, n: (cached.n ?? 0) + 1 }))
    } else {
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ t: now, n: 1 }))
    }
  } catch {
    return
  }
  window.location.replace(window.location.pathname + window.location.search + window.location.hash)
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  staleReload()
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  const detail = reason instanceof Error ? reason.message : String(reason ?? '')
  if (detail.includes('Failed to fetch dynamically imported module')) {
    event.preventDefault()
    staleReload()
  }
})

// ---------------------------------------------------------------------------
// Scroll-lock fallback: the body:has(.fixed.inset-0) CSS rule needs :has().
// On browsers without support, watch the DOM and lock scrolling while any
// overlay (fixed inset-0) is mounted, and unlock as soon as it is removed.
// ---------------------------------------------------------------------------
if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('selector(:has(*))')) {
  const applyLock = () => {
    try {
      document.body.style.overflow = document.querySelector('.fixed.inset-0') ? 'hidden' : ''
    } catch {
      document.body.style.overflow = ''
    }
  }
  const observer = new MutationObserver(applyLock)
  observer.observe(document.body, { childList: true, subtree: true })
  applyLock()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)