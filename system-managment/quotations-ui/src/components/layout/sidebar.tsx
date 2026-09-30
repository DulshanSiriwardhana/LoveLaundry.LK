import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  House, ChartBar, ClipboardText, Truck, UsersThree, CurrencyCircleDollar, FileText,
  FolderOpen, GearSix, Users, Database, CaretLeft, CaretRight, ChatCircleDots, Scan, Upload,
  ListChecks, Receipt, UserCircle, Package, Wallet, Money, CalendarBlank, CalendarPlus,
  Lightning, Brain, CloudArrowDown, FlowArrow, Package as PackageIcon, CaretDown,
} from '@phosphor-icons/react'
import { LogoOnDark } from '../brand/logo'
import { cn } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'

interface NavItem {
  to: string
  label: string
  icon: any
  end?: boolean
  indent?: boolean
  permission?: string
  roles?: string[]
  children?: NavItem[]
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/today', label: 'Today', icon: Lightning },
      { to: '/dashboard', label: 'Dashboard', icon: House },
      { to: '/business-dashboard', label: 'Business Intelligence', icon: ChartBar },
      { to: '/live-chat', label: 'Live Chat', icon: ChatCircleDots, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/gate-passes', label: 'Gate Passes', icon: ClipboardText, permission: 'view_gate_passes' },
      { to: '/deliveries', label: 'Deliveries', icon: Truck, permission: 'view_deliveries' },
      { to: '/dispatch', label: 'Dispatch', icon: PackageIcon, permission: 'view_deliveries' },
      { to: '/hotel-linen-flow', label: 'Hotel Linen Flow', icon: FlowArrow },
      { to: '/returns', label: 'Returns', icon: ClipboardText, permission: 'view_gate_passes' },
      {
        to: '/workers',
        label: 'Staff',
        icon: Users,
        end: true,
        children: [{ to: '/workers/daily-tasks', label: 'Daily Tasks', icon: UsersThree }],
      },
      { to: '/bills', label: 'Bills', icon: CurrencyCircleDollar, permission: 'view_bills' },
      { to: '/statements', label: 'Client Statement', icon: Wallet, permission: 'view_bills' },
      { to: '/shop-bills', label: 'Shop Bills', icon: CurrencyCircleDollar, permission: 'view_bills' },
      { to: '/legacy-invoice', label: 'Legacy Invoice', icon: FileText, permission: 'view_bills' },
      { to: '/invoices/new', label: 'Invoices', icon: FileText, permission: 'view_bills' },
    ],
  },
  {
    label: 'Linen Tracking',
    items: [
      { to: '/linen', label: 'Dashboard', icon: House },
      { to: '/linen/inventory', label: 'Inventory', icon: ClipboardText },
      { to: '/linen/scanner', label: 'Scan Linen', icon: Scan },
      { to: '/linen/bulk-scan', label: 'Bulk Scan', icon: Scan },
      { to: '/linen/tags', label: 'Tag Generator', icon: FileText },
      { to: '/linen/gate-pass', label: 'Gate Pass (Camelot)', icon: FileText },
    ],
  },
  {
    label: 'Contracts',
    items: [
      { to: '/quotations', label: 'Quotations', icon: FileText, permission: 'view_quotations' },
      { to: '/categories', label: 'By Client', icon: FolderOpen, permission: 'view_clients' },
      { to: '/customers', label: 'Customers 360', icon: Users },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/management', label: 'Dashboard', icon: House },
      { to: '/management/transactions', label: 'Transactions', icon: ListChecks },
      { to: '/management/historical-entry', label: 'Data Entry', icon: ClipboardText, roles: ['ADMIN', 'MANAGER'] },
      { to: '/management/import', label: 'Import Data', icon: Upload, roles: ['ADMIN', 'MANAGER'] },
      { to: '/management/customers', label: 'Customers', icon: Users },
      { to: '/management/items', label: 'Items & Categories', icon: Package },
      { to: '/management/expenses', label: 'Expenses', icon: Receipt, roles: ['ADMIN', 'MANAGER'] },
      {
        to: '/management/employees',
        label: 'Employees',
        icon: UserCircle,
        roles: ['ADMIN', 'MANAGER'],
        children: [
          { to: '/management/salary-slip', label: 'Generate Slip', icon: Money },
          { to: '/management/salary-history', label: 'Salary History', icon: ListChecks },
          { to: '/management/advances', label: 'Advances', icon: Wallet },
          { to: '/management/holidays', label: 'Holidays', icon: CalendarBlank },
          { to: '/management/extra-work', label: 'Extra Work', icon: Lightning },
          { to: '/management/attendance', label: 'Attendance', icon: CalendarBlank },
          { to: '/management/attendance-log', label: 'Log Attendance', icon: CalendarPlus },
        ],
      },
      { to: '/management/company-settings', label: 'Company Settings', icon: GearSix, roles: ['ADMIN', 'MANAGER'] },
      { to: '/management/payments', label: 'Payments', icon: Wallet },
      { to: '/management/reports', label: 'Management Reports', icon: ChartBar, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', label: 'Reports', icon: ChartBar, permission: 'view_reports' },
      { to: '/ai-insights', label: 'AI Insights', icon: Brain },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation()

  // Any navigation closes the mobile drawer.
  useEffect(() => {
    if (mobileOpen) onMobileClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
      {/* Desktop rail. Width is a plain CSS transition rather than a JS-driven
          animation so the shell padding tracks it exactly. */}
      <aside
        className={cn(
          'sidebar-dark fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden lg:flex',
          'transition-[width] duration-150 ease-out',
          collapsed ? 'w-[60px]' : 'w-[236px]',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} isMobile={false} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="overlay-backdrop fixed inset-0 z-40 lg:hidden"
            onClick={onMobileClose}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="sidebar-dark fixed inset-y-0 left-0 z-50 flex w-[268px] max-w-[85vw] flex-col lg:hidden"
            style={{ animation: 'slide-in-left 160ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <SidebarContent collapsed={false} onToggle={onToggle} isMobile />
            <style>{`@keyframes slide-in-left{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
          </aside>
        </>
      )}
    </>
  )
}

interface SidebarContentProps {
  collapsed: boolean
  onToggle: () => void
  isMobile: boolean
}

function SidebarContent({ collapsed, onToggle, isMobile }: SidebarContentProps) {
  const { user } = useAuth()
  const { hasPermission } = usePermissions()
  const isAdmin = user?.role_id?.toUpperCase() === 'ADMIN'
  const role = user?.role_id ? String(user.role_id).toUpperCase() : ''

  const groups = useMemo(() => {
    const system: NavItem[] = [
      { to: '/settings', label: 'Settings', icon: GearSix },
      ...(isAdmin
        ? [
            { to: '/users', label: 'Users', icon: Users },
            { to: '/database-sync', label: 'Database Sync', icon: Database },
            { to: '/reports-backup', label: 'Reports & Backup', icon: CloudArrowDown },
          ]
        : []),
    ]

    const allowed = (i: NavItem): NavItem | null => {
      if (i.permission && !hasPermission(i.permission)) return null
      if (i.roles && !i.roles.includes(role)) return null
      const children = i.children?.filter(Boolean).map(allowed).filter(Boolean) as NavItem[] | undefined
      return { ...i, children: children?.length ? children : undefined }
    }

    const all = [...navGroups, { label: 'System', items: system }]
    return all
      .map((g) => ({ ...g, items: g.items.map(allowed).filter(Boolean) as NavItem[] }))
      .filter((g) => g.items.length > 0)
  }, [hasPermission, isAdmin, role])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      {/* Brand */}
      <div
        className={cn(
          'flex h-13 shrink-0 items-center border-b border-[var(--sidebar-border)] px-3.5',
          collapsed && 'justify-center px-0',
        )}
      >
        <LogoOnDark collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav
        aria-label="Main"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
          'px-2 py-3',
          '[scrollbar-width:thin]',
        )}
      >
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.07em] text-[var(--sidebar-label)] uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarNavItem item={item} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse control — desktop only; the drawer has no collapse state. */}
      {!isMobile && (
        <div className="shrink-0 border-t border-[var(--sidebar-border)] p-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2',
              'text-[12px] font-medium text-[var(--sidebar-label)]',
              'transition-colors duration-100 hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <CaretRight size={14} aria-hidden /> : <CaretLeft size={14} aria-hidden />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarNavItem({
  item,
  collapsed,
}: {
  item: NavItem
  collapsed: boolean
}) {
  const { to, label, icon: Icon, end, children } = item
  const hasChildren = Boolean(children?.length)
  const [expanded, setExpanded] = useState(false)
  const location = useLocation()

  // A parent is "open" when it, or any descendant, is the current route.
  const childActive = hasChildren && children!.some((c) => location.pathname.startsWith(c.to))
  const open = expanded || childActive

  return (
    <div>
      <div className="relative">
        <NavLink
          to={to}
          end={end}
          onClick={(e) => {
            // A parent that owns children toggles rather than navigating on the
            // first tap, but still navigates if it is already open.
            if (hasChildren && !collapsed && !open) {
              e.preventDefault()
              setExpanded(true)
            }
          }}
          title={collapsed ? label : undefined}
          aria-current={undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded-[6px] py-2 pr-2.5 pl-2.5',
              'text-[13px] font-medium transition-colors duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              collapsed && 'justify-center px-0',
              // Active = filled brand surface. Inactive = transparent until hover.
              isActive
                ? 'bg-[var(--brand)] text-white'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                size={17}
                weight={isActive ? 'fill' : 'regular'}
                aria-hidden
                className={cn(
                  'shrink-0',
                  isActive
                    ? 'text-white'
                    : 'text-[var(--sidebar-label)] group-hover:text-[var(--sidebar-hover-text)]',
                )}
              />
              {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
              {!collapsed && hasChildren && (
                <CaretDown
                  size={13}
                  aria-hidden
                  className={cn(
                    'shrink-0 text-[var(--sidebar-label)] transition-transform duration-150',
                    open && 'rotate-180',
                  )}
                />
              )}
            </>
          )}
        </NavLink>
      </div>

      {/* Sub-items. Indented with a rail rather than a filled block, so the
          parent stays readable as the section heading. */}
      {hasChildren && !collapsed && open && (
        <ul className="relative mt-0.5 ml-[18px] space-y-0.5 border-l border-[var(--sidebar-border)] pl-2.5">
          {children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-[5px] py-1.5 pr-2 pl-2.5 text-[12.5px] font-medium',
                    'transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                    isActive
                      ? 'bg-[var(--sidebar-hover-bg)] text-[var(--sidebar-active)]'
                      : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)] hover:text-[var(--sidebar-hover-text)]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                        isActive ? 'bg-[var(--sidebar-indicator)]' : 'bg-[var(--sidebar-border)]',
                      )}
                    />
                    <span className="min-w-0 truncate">{child.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
