export interface NavItem {
  path: string
  label: string
  /** The real endpoint this screen will consume. */
  endpoint: string
  blurb: string
}

export const appConfig = {
  title: 'Shop Counter',
  tagline: 'Billing and day close for shop customers',
  authKind: 'staff' as 'staff' | 'client',
  /** /auth/login — the only sign-in this app may call. */
  loginPath: '/auth/login',
  statusPath: '/auth/status',
  nav: [
    {
      "path": "/",
      "label": "Today",
      "endpoint": "GET /shop-bills/stats/overview",
      "blurb": "Open bills, takings and what is waiting at the counter."
    },
    {
      "path": "/bills",
      "label": "Bills",
      "endpoint": "GET /shop-bills",
      "blurb": "Every shop bill with status, client and balance."
    },
    {
      "path": "/quick-bill",
      "label": "Quick bill",
      "endpoint": "POST /shop-bills/quick-bill",
      "blurb": "Counter sale in a few taps, no customer record required."
    },
    {
      "path": "/day-close",
      "label": "Day close",
      "endpoint": "GET /day-close",
      "blurb": "Cash counted against what the system recorded."
    }
  ] as NavItem[],
}
