import { useAuth } from '../context/AuthContext'

export function usePermissions() {
    const { user } = useAuth()
    
    const hasPermission = (permission: string) => {
        if (!user) return false
        // Platform admins and tenant sub-admins (hotel / shop / laundry admins)
        // are all administrators for the purposes of the admin UI.
        const adminLikeRoles = ['ADMIN', 'SHOP_ADMIN', 'HOTEL_ADMIN', 'PLATFORM_ADMIN']
        if (adminLikeRoles.includes((user.role_id || '').toUpperCase())) return true
        
        if (!user.permissions) return false
        
        try {
            const permsArray = JSON.parse(user.permissions)
            if (Array.isArray(permsArray)) {
                return permsArray.includes(permission)
            }
        } catch {
            // If it's just a comma separated string
            const permsArray = user.permissions.split(',').map(p => p.trim())
            return permsArray.includes(permission)
        }
        return false
    }

    return { hasPermission }
}
