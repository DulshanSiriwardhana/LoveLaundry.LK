import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { CommandSearch } from '../ui/command-search'
import { OfflineSyncBar } from '../ui/offline-sync-bar'
import { useAuth } from '../../context/AuthContext'
import { setUnauthorizedHandler } from '../../api/interceptors'

const pageTitles: Record<string, string> = {
  '/': 'Daily Operations',
  '/today': 'Daily Operations',
  '/dashboard': 'Dashboard',
  '/business-dashboard': 'Business Intelligence',
  '/quotations': 'Quotations',
  '/quotations/new': 'New Quotation',
  '/categories': 'Categories',
  '/settings': 'Settings',
  '/profile': 'My Profile',
  '/bills': 'Bills',
  '/bills/new': 'Create Bill',
  '/statements': 'Client Statement',
  '/invoices/new': 'Consolidated Invoice',
  '/gate-passes': 'Gate Passes',
  '/gate-passes/new': 'New Gate Pass',
  '/deliveries': 'Deliveries',
  '/dispatch': 'Dispatch',
  '/returns': 'Returns',
  '/returns/new': 'Record Return',
  '/customers': 'Customers',
  '/deliveries/new': 'New Delivery',
  '/reports': 'Reports',
  '/users': 'Users',
  '/database-sync': 'Database Sync',
  '/live-chat': 'Live Chat',
  '/notifications': 'Notifications',
  '/workers': 'Staff Management',
  '/workers/daily-tasks': 'Daily Tasks',
  '/shop-bills': 'Shop Bills',
  '/shop-bills/dashboard': 'Shop Bills Dashboard',
  '/shop-bills/new': 'Create Shop Bill',
  '/legacy-invoice': 'Legacy Invoice',
  '/linen': 'Linen Dashboard',
  '/linen/inventory': 'Linen Inventory',
  '/linen/scanner': 'Scan Linen',
  '/linen/bulk-scan': 'Bulk Scan',
  '/linen/tags': 'Tag Generator',
  '/linen/gate-pass': 'Gate Pass (Camelot)',
  '/linen/gate-pass/linen': 'Camelot Linen Receipt',
  '/linen/gate-pass/uniform': 'Camelot Uniform Receipt',
  '/management': 'Management Dashboard',
  '/management/transactions': 'All Transactions',
  '/management/historical-entry': 'Historical Data Entry',
  '/management/import': 'Import Historical Data',
  '/management/customers': 'Manage Customers',
  '/management/items': 'Items & Categories',
  '/management/expenses': 'Expense Management',
  '/management/employees': 'Employees & Salaries',
  '/management/salary-slip': 'Generate Salary Slip',
  '/management/salary-history': 'Salary History',
  '/management/advances': 'Salary Advances',
  '/management/holidays': 'Holiday Calendar',
  '/management/extra-work': 'Extra Work Records',
  '/management/attendance': 'Attendance Entry',
  '/management/attendance-log': 'Log Attendance — All Staff',
  '/management/company-settings': 'Company Settings',
  '/management/payments': 'Payments',
  '/management/reports': 'Management Reports',
  '/ai-insights': 'AI Insights',
  '/reports-backup': 'Reports & Backup',
  '/hotel-linen-flow': 'Hotel Linen Flow',
}

function getPageTitle(pathname: string): string {
  if (pathname.match(/^\/quotations\/[^/]+\/edit$/)) return 'Edit Quotation'
  if (pathname.match(/^\/quotations\/[^/]+$/)) return 'Quotation Details'
  if (pathname.match(/^\/bills\/[^/]+$/)) return 'Bill Details'
  if (pathname.match(/^\/gate-passes\/[^/]+$/)) return 'Gate Pass Details'
  if (pathname.match(/^\/deliveries\/[^/]+$/)) return 'Delivery Details'
  if (pathname.match(/^\/returns\/[^/]+$/)) return 'Return Details'
  if (pathname === '/linen/gate-pass') return 'Gate Pass (Camelot)'
  if (pathname === '/linen/gate-pass/linen') return 'Camelot Linen Receipt'
  if (pathname === '/linen/gate-pass/uniform') return 'Camelot Uniform Receipt'
  if (pathname.match(/^\/linen\/[^/]+$/)) return 'Linen Profile'
  if (pathname.match(/^\/shop-bills\/[^/]+$/)) return 'Shop Bill Details'
  return pageTitles[pathname] ?? 'Love Laundry'
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [logout, navigate])

  // Ctrl/Cmd+K opens search from anywhere, including inside inputs and textareas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A new route should start at the top. Without this, a scrolled list keeps its
  // scroll offset and the next page appears to open halfway down.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // The collapsed rail is a desktop-only affordance; reset it when the viewport
  // shrinks so the mobile drawer is never hidden behind a stale collapsed state.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => {
      if (!mq.matches) setCollapsed(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-[6px] focus:bg-[var(--brand)] focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <TopBar
        title={getPageTitle(location.pathname)}
        sidebarCollapsed={collapsed}
        onMobileMenuToggle={() => setMobileOpen((v) => !v)}
        onOpenSearch={() => setCmdOpen(true)}
      />

      <CommandSearch open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <OfflineSyncBar />

      <main
        id="main-content"
        className={`min-h-dvh pt-13 transition-[padding-left] duration-150 ease-out ${
          collapsed ? 'lg:pl-[60px]' : 'lg:pl-[236px]'
        }`}
      >
        {/* Wide cap with a tighter margin on small screens: a 320px viewport
            gets 16px of gutter, a desktop gets a comfortable measure. */}
        <div className="mx-auto w-full max-w-[1480px] px-4 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
