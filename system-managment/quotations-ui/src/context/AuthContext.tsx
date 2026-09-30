import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { deleteCacheDb, sanitizeScope } from '../cache/db'

interface AuthCtx {
    token: string | null
    user: User | null
    setUser: (user: User) => void
    login: (token: string, user: User) => void
    logout: () => void
    isAuthenticated: boolean
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('ll_token'))
    const [user, setUser] = useState<User | null>(() => {
        try { return JSON.parse(localStorage.getItem('ll_user') ?? 'null') } catch { return null }
    })

    const login = useCallback((tok: string, usr: User) => {
        localStorage.setItem('ll_token', tok)
        localStorage.setItem('ll_user', JSON.stringify(usr))
        setToken(tok)
        setUser(usr)
    }, [])

    const logout = useCallback(() => {
        const scope = user?.id
        localStorage.removeItem('ll_token')
        localStorage.removeItem('ll_user')
        setToken(null)
        setUser(null)
        // Drop that user's local_cache_db so the next sign-in starts clean —
        // never leak one account's cached data into another's session.
        if (scope) void deleteCacheDb(sanitizeScope(scope))
    }, [user])

    const updateUser = useCallback((usr: User) => {
        localStorage.setItem('ll_user', JSON.stringify(usr))
        setUser(usr)
    }, [])

    // Proactively detect an expired JWT so the user is sent to login cleanly
    // instead of hitting a silent 401 on the first data request.
    useEffect(() => {
        if (!token) return
        try {
            const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
            if (payload?.exp && payload.exp * 1000 < Date.now()) {
                logout()
            }
        } catch {
            // Malformed token — leave it; the API will reject and trigger logout.
        }
    }, [token, logout])

    return (
        <AuthContext.Provider value={{ token, user, setUser: updateUser, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
