import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { cn } from '../../../lib/utils'

export interface RowAction {
    label: string
    icon?: ReactNode
    onClick?: () => void
    danger?: boolean
}

export function RowActionsMenu({ actions, size = 16 }: { actions: RowAction[]; size?: number }) {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

    const measure = () => {
        const el = triggerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }

    useLayoutEffect(() => {
        if (open) measure()
    }, [open])

    useEffect(() => {
        if (!open) return
        const onDown = (event: MouseEvent) => {
            if (
                rootRef.current &&
                rcContains(rootRef.current, event.target as Node) === false &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setOpen(false)
            }
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const onScrollOrResize = () => measure()
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        window.addEventListener('scroll', onScrollOrResize, true)
        window.addEventListener('resize', onScrollOrResize)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
            window.removeEventListener('scroll', onScrollOrResize, true)
            window.removeEventListener('resize', onScrollOrResize)
        }
    }, [open])

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label="More actions"
                onClick={event => {
                    event.stopPropagation()
                    setOpen(value => !value)
                }}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[#98A2B3] transition hover:border-[#E4E7EC] hover:bg-[#F9FAFB] hover:text-[#475467]"
            >
                <MoreVertical size={size} />
            </button>
            {open && pos && createPortal(
                <div
                    ref={rootRef}
                    style={{ top: pos.top, right: pos.right }}
                    className="fixed z-[9999] min-w-[176px] overflow-hidden rounded-xl border border-[#E4E7EC] bg-white p-1 shadow-lg"
                >
                    {actions.map(action => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={event => {
                                event.stopPropagation()
                                setOpen(false)
                                action.onClick?.()
                            }}
                            className={cn(
                                'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition',
                                action.danger
                                    ? 'text-[#DC2626] hover:bg-red-50'
                                    : 'text-[#475467] hover:bg-[#F9FAFB] hover:text-[#101828]',
                            )}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    )
}

function rcContains(root: HTMLElement, target: Node | null): boolean {
    return root.contains(target)
}