import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * Payrolled and audited management screens, paired one-for-one with the
 * capability each backend route requires.
 *
 * The client hid nothing here, so any signed-in user — including a counter
 * STAFF account — could open the salary, HR, expense and reporting screens. The
 * backends now refuse those capabilities to STAFF as well; this list is kept in
 * step with `ROLE_CAPABILITIES` in laundry-management/src/auth_helper.py.
 */
const RESTRICTED = new Set([
    'management/expenses',
    'management/employees',
    'management/salary-slip',
    'management/salary-history',
    'management/advances',
    'management/holidays',
    'management/extra-work',
    'management/attendance',
    'management/attendance-log',
    'management/reports',
    'management/import',
    'management/historical-entry',
    'management/company-settings',
])

/** Whether a given `management/*` path is one a STAFF user may not open. */
export function isRestrictedManagementPath(path: string): boolean {
    return RESTRICTED.has(path.replace(/^\/+|\/+$/g, ''))
}

/**
 * ManagerRoute — renders children for the roles that hold payroll and expense
 * capabilities. ADMIN and MANAGER only; everything else is sent to the
 * management dashboard rather than shown a page that would 403 on load.
 */
export function ManagerRoute() {
    const { user, isAuthenticated } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    const role = user?.role_id?.toUpperCase() ?? ''
    if (role !== 'ADMIN' && role !== 'MANAGER') {
        return <Navigate to="/management" replace />
    }

    return <Outlet />
}
