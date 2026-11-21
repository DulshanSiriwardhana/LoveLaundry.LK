export interface NavItem {
  path: string
  label: string
  /** The real endpoint this screen will consume. */
  endpoint: string
  blurb: string
}

export const appConfig = {
  title: 'Hotel Desk',
  tagline: 'Your account with Love Laundry',
  authKind: 'client' as 'staff' | 'client',
  /** /client/auth/login — the only sign-in this app may call. */
  loginPath: '/client/auth/login',
  statusPath: '/client/auth/status',
  nav: [
    {
      "path": "/",
      "label": "Overview",
      "endpoint": "GET /client-portal/summary",
      "blurb": "This month at a glance: pieces in, pieces out, amount due."
    },
    {
      "path": "/gate-passes",
      "label": "Gate passes",
      "endpoint": "GET /client-portal/gate-passes",
      "blurb": "Every collection from your property, with piece counts."
    },
    {
      "path": "/deliveries",
      "label": "Deliveries",
      "endpoint": "GET /client-portal/deliveries",
      "blurb": "What came back, when, and what was short."
    },
    {
      "path": "/invoices",
      "label": "Invoices",
      "endpoint": "GET /client-portal/bills",
      "blurb": "Invoices and their settlement status."
    }
  ] as NavItem[],
}
