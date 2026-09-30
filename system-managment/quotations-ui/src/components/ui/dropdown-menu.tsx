import * as React from 'react'
import { cn } from '../../lib/utils'

export interface MenuItem {
  id: string
  label: React.ReactNode
  icon?: React.ReactNode
  onSelect?: () => void
  disabled?: boolean
  /** Renders in the danger tone; use for delete and revoke. */
  destructive?: boolean
  /** Optional right-aligned hint, e.g. a shortcut. */
  hint?: React.ReactNode
  /** Renders a check on the right — use for single-select menus. */
  selected?: boolean
}

export interface MenuGroup {
  /** Small uppercase separator label. */
  label?: string
  items: MenuItem[]
}

export interface DropdownMenuProps {
  /** The trigger. Receives the props it must spread onto its button. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>
    onClick: () => void
    'aria-expanded': boolean
    'aria-haspopup': 'menu'
    id: string
  }) => React.ReactNode
  groups: MenuGroup[]
  align?: 'start' | 'end'
  className?: string
  menuClassName?: string
  /** Accessible name for the menu itself. */
  label?: string
}

/**
 * DropdownMenu — the row-actions menu.
 *
 * Built in-house rather than with a popover library so it can guarantee the two
 * things an operations screen depends on:
 *   · viewport containment — the menu flips to the left edge and clamps its
 *     height when it would leave the screen, so it never opens off-canvas
 *   · keyboard support — arrows move, Enter/Space select, Escape closes and
 *     returns focus to the trigger
 */
export function DropdownMenu({
  trigger,
  groups,
  align = 'end',
  className,
  menuClassName,
  label = 'Actions',
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [flipLeft, setFlipLeft] = React.useState(false)
  const [upward, setUpward] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const menuId = React.useId()

  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups])

  const close = React.useCallback((restoreFocus = true) => {
    setOpen(false)
    setActiveIndex(-1)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // Close on outside pointer / Escape.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  // Keep the menu inside the viewport.
  React.useEffect(() => {
    if (!open) {
      setFlipLeft(false)
      setUpward(false)
      return
    }
    const t = triggerRef.current
    const m = menuRef.current
    if (!t || !m) return

    const tRect = t.getBoundingClientRect()
    const mRect = m.getBoundingClientRect()
    const vh = window.innerHeight
    const margin = 8

    setFlipLeft(align === 'end' && tRect.right - mRect.width < margin)
    setUpward(tRect.bottom + mRect.height + margin > vh && tRect.top - mRect.height - margin > 0)
  }, [open, align])

  const move = (dir: 1 | -1) => {
    if (!flat.length) return
    let next = activeIndex
    for (let step = 0; step < flat.length; step++) {
      next = (next + dir + flat.length) % flat.length
      if (!flat[next].disabled) break
    }
    setActiveIndex(next)
  }

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(flat.length - 1)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const commit = (item: MenuItem) => {
    if (item.disabled) return
    close(false)
    item.onSelect?.()
  }

  let cursor = -1

  return (
    <div className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        id: `${menuId}-trigger`,
      })}

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-50 min-w-[184px] max-w-[min(260px,calc(100vw-16px))] overflow-y-auto overscroll-contain',
            'rounded-[8px] border border-[var(--border-2)] bg-[var(--surface)] p-1 shadow-[var(--shadow-pop)]',
            upward ? 'bottom-full mb-1' : 'top-full mt-1',
            flipLeft ? 'right-0 left-auto' : align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          )}
        >
          {groups.map((group, gi) => (
            <div key={group.label ?? gi}>
              {group.label && (
                <p className="px-2 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.04em] text-[var(--text-faint)] uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                cursor += 1
                const index = cursor
                const isActive = index === activeIndex
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    tabIndex={isActive ? 0 : -1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(item)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] transition-colors duration-75',
                      'disabled:pointer-events-none disabled:opacity-45',
                      item.destructive
                        ? 'text-[var(--danger-text)] hover:bg-[var(--danger-soft)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
                      isActive &&
                        (item.destructive
                          ? 'bg-[var(--danger-soft)]'
                          : 'bg-[var(--surface-hover)]'),
                    )}
                  >
                    {item.icon && (
                      <span className="flex size-4 shrink-0 items-center justify-center text-[var(--text-faint)] [&_svg]:size-4">
                        {item.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.selected ? (
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden
                        className="size-3.5 shrink-0 text-[var(--brand-text)]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 8.5 6.2 11.7 13 4.9" />
                      </svg>
                    ) : (
                      item.hint && (
                        <span className="shrink-0 text-[11.5px] text-[var(--text-faint)]">
                          {item.hint}
                        </span>
                      )
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * RowActions — the standard "…" trigger for a table row. Icon + tooltip +
 * accessible name, so the control is self-describing without a label.
 */
export function RowActions({
  groups,
  label = 'Row actions',
  align = 'end',
}: {
  groups: MenuGroup[]
  label?: string
  align?: 'start' | 'end'
}) {
  return (
    <DropdownMenu
      label={label}
      align={align}
      groups={groups}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          title={label}
          aria-label={label}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-[6px] text-[var(--text-faint)]',
            'transition-colors duration-100 hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          )}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
            <circle cx="8" cy="3.2" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="8" cy="12.8" r="1.4" />
          </svg>
        </button>
      )}
    />
  )
}
