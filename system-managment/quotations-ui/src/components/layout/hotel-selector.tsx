import { useMemo } from 'react'
import { Buildings, Stack } from '@phosphor-icons/react'
import { useHotel } from '../../context/HotelContext'
import { DropdownMenu, type MenuGroup } from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'

/**
 * HotelSelector — the scope every record query is filtered by.
 *
 * It lives in the top bar rather than inside each page because the selection is
 * global. The control reads as a field (it holds a value), and it is labelled
 * "Scope" instead of "Hotel" on wide screens so the all-hotels state is not
 * ambiguous: picking "All Hotels" is a deliberate act, not a leftover default.
 */
export function HotelSelector() {
  const { hotels, selectedHotel, setSelectedHotel, showAllHotels } = useHotel()

  const groups = useMemo<MenuGroup[]>(() => {
    const hotelItems = hotels.map((hotel) => ({
      id: hotel,
      label: hotel,
      selected: selectedHotel === hotel,
      onSelect: () => setSelectedHotel(hotel),
    }))

    if (showAllHotels) {
      return [
        {
          label: 'Aggregate',
          items: [
            {
              id: '__all',
              label: 'All hotels',
              icon: <Stack size={16} />,
              selected: selectedHotel === '',
              onSelect: () => setSelectedHotel(''),
            },
          ],
        },
        { label: 'Scope to one hotel', items: hotelItems },
      ]
    }

    return [{ items: hotelItems }]
  }, [hotels, selectedHotel, setSelectedHotel, showAllHotels])

  const isAggregate = selectedHotel === ''
  const label = isAggregate ? 'All hotels' : selectedHotel || 'Select hotel'

  return (
    <DropdownMenu
      label="Hotel scope"
      menuClassName="max-w-[min(300px,calc(100vw-16px))]"
      groups={groups}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          title="Records are filtered to the selected hotel"
          className={cn(
            'flex h-8 max-w-[184px] items-center gap-1.5 rounded-[6px] border px-2',
            'text-[12.5px] transition-colors duration-100 sm:max-w-[240px]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            isAggregate
              ? 'border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]'
              : 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand-soft)]/70',
          )}
        >
          <Buildings
            size={15}
            aria-hidden
            weight={isAggregate ? 'regular' : 'fill'}
            className="shrink-0"
          />
          <span className="hidden shrink-0 text-[11px] font-semibold tracking-[0.03em] uppercase lg:inline">
            Scope
          </span>
          <span className="min-w-0 truncate font-medium">{label}</span>
        </button>
      )}
    />
  )
}
