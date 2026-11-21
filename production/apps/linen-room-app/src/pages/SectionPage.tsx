import { Link, useLocation, useNavigate } from 'react-router-dom'
import { appConfig, type NavItem } from '../config/app'

export function SectionPage({ item }: { item: NavItem }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = appConfig.nav.find((route) => route.path === pathname) ?? item
  const isCurrent = current.path === pathname

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <section className="page">
      <div className="hero-band">
        <div className="hero-band__grid" aria-hidden="true" />
        <div className="hero-band__content">
          <span className="hero-band__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 7v6c0 4.5 3.2 7.4 8 8 4.8-.6 8-3.5 8-8V7l-8-4Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div>
            <p className="eyebrow eyebrow--light"> love laundry workspace </p>
            <h1>{current.label}</h1>
            <p>{current.blurb}</p>
          </div>
        </div>
      </div>

      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">{appConfig.title}</p>
          <h2 className="page-header__title">{current.label}</h2>
          <p className="page-header__subtitle">
            This screen is wired to the existing service contract. Data appears
            here as soon as the endpoint is connected.
          </p>
        </div>
        <div className="page-header__actions">
          <span className={isCurrent ? 'badge badge--success' : 'badge badge--soft'}>
            {isCurrent ? 'Current page' : 'Available route'}
          </span>
          <button type="button" className="btn btn--ghost" onClick={goBack}>Back</button>
        </div>
      </header>

      <div className="stat-grid">
        <article className="stat-card">
          <p className="stat-card__label">Workspace</p>
          <p className="stat-card__value">{appConfig.title}</p>
          <p className="stat-card__foot">Signed-in area</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Routes</p>
          <p className="stat-card__value">{appConfig.nav.length}</p>
          <p className="stat-card__foot">Available in this app</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Account type</p>
          <p className="stat-card__value">
            {appConfig.authKind === 'client' ? 'Client' : 'Staff'}
          </p>
          <p className="stat-card__foot">Set by the sign-in service</p>
        </article>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Navigation</p>
            <h3>Application routes</h3>
          </div>
          <span className="code-chip">{pathname}</span>
        </div>
        <ul className="route-grid">
          {appConfig.nav.map((route) => (
            <li key={route.path}>
              <Link
                to={route.path}
                aria-current={route.path === pathname ? 'page' : undefined}
                className={route.path === pathname ? 'route-card route-card--active' : 'route-card'}
              >
                <span className="route-card__path">{route.path}</span>
                <span className="route-card__title">{route.label}</span>
                <span className="route-card__blurb">{route.blurb}</span>
                <span className="route-card__endpoint">{route.endpoint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="notice">
        Tenant scope always comes from the signed-in token. No screen here accepts
        a laundry or hotel ID from the URL.
      </p>
    </section>
  )
}
