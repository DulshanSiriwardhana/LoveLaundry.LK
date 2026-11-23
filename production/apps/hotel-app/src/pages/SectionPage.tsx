import { Link, useLocation, useNavigate } from 'react-router-dom'
import { appConfig, type NavItem } from '../config/app'

const SECTION_PREVIEW: Record<string, { heading: string; points: string[] }> = {
  Overview: {
    heading: 'Monthly movement snapshot',
    points: [
      'Pieces collected and returned this month',
      'Outstanding amount and settlement status',
      'Movement trend against the previous period',
    ],
  },
  'Gate passes': {
    heading: 'Collection trail',
    points: [
      'Every gate pass raised for your property',
      'Piece counts, driver and collection time',
      'Quick access to printable gate-pass records',
    ],
  },
  Deliveries: {
    heading: 'Return history',
    points: [
      'Deliveries received at your property',
      'Short or damaged item notes',
      'Dates, references and signed handovers',
    ],
  },
  Invoices: {
    heading: 'Billing overview',
    points: [
      'Invoices raised for your account',
      'Paid, partially paid and outstanding balances',
      'Statements and printable invoice copies',
    ],
  },
}

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 7v6c0 4.5 3.2 7.4 8 8 4.8-.6 8-3.5 8-8V7l-8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function SectionPage({ item }: { item: NavItem }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = appConfig.nav.find((route) => route.path === pathname) ?? item
  const isCurrent = current.path === pathname
  const preview = SECTION_PREVIEW[current.label] ?? {
    heading: 'Workspace preview',
    points: ['Signed-in client scope', 'Existing service contract', 'Ready for live data'],
  }

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
            <ShieldIcon />
          </span>
          <div>
            <p className="eyebrow eyebrow--light">Love Laundry · client workspace</p>
            <h1>{current.label}</h1>
            <p>{current.blurb}</p>
          </div>
        </div>
        <span className="hero-band__stamp">Preview</span>
      </div>

      <header className="page-header">
        <div>
          <p className="page-header__eyebrow">{appConfig.title}</p>
          <h2 className="page-header__title">{current.label}</h2>
          <p className="page-header__subtitle">
            This page is laid out and ready for the existing client-portal contract. Live data is
            intentionally not fetched in this preview build.
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

      <div className="workspace-grid">
        <section className="panel workspace-preview">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Page preview</p>
              <h3>{preview.heading}</h3>
            </div>
            <span className="badge badge--brand">/{pathname === '/' ? '' : pathname}</span>
          </div>
          <ul className="preview-list">
            {preview.points.map((point) => (
              <li key={point}>
                <span className="preview-list__dot" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="empty-panel">
            <span className="empty-panel__icon" aria-hidden="true">—</span>
            <div>
              <strong>No live records in preview mode</strong>
              <p>
                Records will appear here when <code>{current.endpoint}</code> is enabled for this
                workspace. Nothing on this screen accepts a tenant ID from the URL.
              </p>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Navigation</p>
              <h3>Application routes</h3>
            </div>
            <span className="code-chip">{appConfig.nav.length} total</span>
          </div>
          <ul className="route-grid route-grid--compact">
            {appConfig.nav.map((route) => {
              const active = route.path === pathname
              return (
                <li key={route.path}>
                  <Link
                    to={route.path}
                    aria-current={active ? 'page' : undefined}
                    className={active ? 'route-card route-card--active' : 'route-card'}
                  >
                    <span className="route-card__path">{route.path}</span>
                    <span className="route-card__title">
                      {route.label}
                      <span className="route-card__arrow" aria-hidden="true"><ArrowIcon /></span>
                    </span>
                    <span className="route-card__blurb">{route.blurb}</span>
                    <span className="route-card__endpoint">{route.endpoint}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <p className="notice">
        Tenant scope always comes from the signed-in token. No screen here accepts a laundry or
        hotel ID from the URL.
      </p>
    </section>
  )
}
