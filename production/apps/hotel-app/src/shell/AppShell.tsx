import { NavLink, Outlet } from 'react-router-dom'
import clsx from 'clsx'
import { ThemeSwitcher } from '../ll-theme'
import { useAuth } from '../auth/AuthContext'
import { appConfig } from '../config/app'

export function AppShell() {
  const { user, signOut } = useAuth()
  const scope = user?.clientName ?? user?.laundry

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <span className="app-brand__mark" aria-hidden="true">LL</span>
            <div className="app-brand__copy">
              <p className="app-brand__title">{appConfig.title}</p>
              <p className="app-brand__tagline">{appConfig.tagline}</p>
            </div>
          </div>

          <div className="app-header__actions">
            {scope ? <span className="badge badge--brand">{scope}</span> : null}
            <div className="user-chip">
              <span className="user-chip__avatar" aria-hidden="true">
                {(user?.name ?? 'U').slice(0, 1).toUpperCase()}
              </span>
              <span className="user-chip__copy">
                <span className="user-chip__name">{user?.name}</span>
                <span className="user-chip__role">{user?.role || 'Member'}</span>
              </span>
            </div>
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={signOut}
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="app-nav" aria-label="Workspace sections">
          <div className="app-nav__inner">
            {appConfig.nav.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  clsx('app-nav__link', isActive && 'app-nav__link--active')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="app-main" id="main-content">
        <Outlet />
      </main>
      <footer className="app-footer">Love Laundry · {appConfig.title}</footer>
    </div>
  )
}
