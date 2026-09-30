import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * AdminRoute — only renders children for users whose role is ADMIN.
 * All other authenticated users are silently redirected to the dashboard.
 */
export function AdminRoute() {
    const { user, isAuthenticated } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    const isAdmin = user?.role_id?.toUpperCase() === 'ADMIN'

    if (!isAdmin) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
