import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * ManagerRoute — gates the payroll, HR, expense and reporting screens to the
 * roles that hold those capabilities. ADMIN and MANAGER only; everything else
 * is sent to the management dashboard rather than shown a page that would 403
 * on load.
 *
 * Every restricted `management/*` path is wrapped here in src/routes/index.tsx:
 * hiding a sidebar link is not access control, so the route guard is the single
 * enforcement point and is kept in step with `ROLE_CAPABILITIES` in
 * laundry-management/src/auth_helper.py.
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
