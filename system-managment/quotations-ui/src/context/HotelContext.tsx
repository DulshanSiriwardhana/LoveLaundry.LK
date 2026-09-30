import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useGatePasses } from '../features/quotations/hooks/useGatePasses'
import { useDeliveries } from '../features/quotations/hooks/useDeliveries'
import { useBills } from '../features/quotations/hooks/useBills'
import { useQuotations } from '../features/quotations/hooks/useQuotations'

/**
 * Hotel-first workspace.
 *
 * Laundry records (gate passes, deliveries, bills) carry a `client_name`
 * (no dedicated hotel field). This context exposes the distinct set of
 * clients so the top bar can scope every operations page to one hotel while
 * persisting the choice per user. "All Hotels" ("") is admin-only.
 */
interface HotelContextValue {
    hotels: string[]
    selectedHotel: string
    setSelectedHotel: (name: string) => void
    isAdmin: boolean
    showAllHotels: boolean
}

const HotelContext = createContext<HotelContextValue | null>(null)

export function HotelProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const isAdmin = user?.role_id?.toUpperCase() === 'ADMIN'

    const storageKey = useMemo(() => `ll_hotel_${user?.id ?? ''}`, [user?.id])

    const [selectedHotel, setSelectedHotelState] = useState<string>(() => {
        try {
            return localStorage.getItem(storageKey) ?? ''
        } catch {
            return ''
        }
    })

    const { data: gatePasses = [] } = useGatePasses()
    const { data: deliveries = [] } = useDeliveries()
    const { data: billsResp } = useBills({ limit: 1000 })
    const { data: quotations = [] } = useQuotations()

    const hotels = useMemo(() => {
        const set = new Set<string>()
        gatePasses.forEach(g => { if (g.client_name) set.add(g.client_name) })
        deliveries.forEach(d => { if (d.client_name) set.add(d.client_name) })
        ;(billsResp?.items ?? []).forEach(b => { if (b.client_name) set.add(b.client_name) })
        quotations.forEach(q => { if (q.client_name) set.add(q.client_name) })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [gatePasses, deliveries, billsResp, quotations])

    const setSelectedHotel = useCallback((name: string) => {
        setSelectedHotelState(name)
        try {
            localStorage.setItem(storageKey, name)
        } catch {
            // Ignore storage failures (private mode etc.) — selection just won't persist.
        }
    }, [storageKey])

    // Keep the stored choice valid:
    //  - admins may keep "" (All Hotels) or any hotel;
    //  - non-admins must always be scoped to a real hotel.
    useEffect(() => {
        if (hotels.length === 0) return
        if (selectedHotel && hotels.includes(selectedHotel)) return
        const fallback = !isAdmin && hotels[0] ? hotels[0] : ''
        if (selectedHotel !== fallback) setSelectedHotelState(fallback)
    }, [hotels, selectedHotel, isAdmin])

    const value = useMemo(
        () => ({
            hotels,
            selectedHotel: isAdmin ? selectedHotel : (hotels[0] ?? ''),
            setSelectedHotel,
            isAdmin,
            showAllHotels: isAdmin && selectedHotel === '',
        }),
        [hotels, selectedHotel, setSelectedHotel, isAdmin],
    )

    return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>
}

export function useHotel() {
    const ctx = useContext(HotelContext)
    if (!ctx) throw new Error('useHotel must be used within HotelProvider')
    return ctx
}

/** Convenience for list pages: active hotel filter (undefined = all) + whether the All Hotels admin view is active. */
export function useHotelScope() {
    const { selectedHotel, isAdmin, showAllHotels } = useHotel()
    return {
        hotel: selectedHotel || undefined,
        isAdmin,
        showAllHotels,
    }
}