import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { EmptyState } from '../../../components/ui/empty-state'
import { cn } from '../../../lib/utils'

export interface StatusSection<T> {
    key: string
    label: string
    icon?: ReactNode
    tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray'
    items: T[]
    renderItem: (item: T, index: number) => ReactNode
}

const toneMap: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]', text: 'text-[#1D4ED8]', border: 'border-[#BFDBFE]' },
    green: { bg: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', text: 'text-[#15803D]', border: 'border-[#BBF7D0]' },
    amber: { bg: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]', text: 'text-[#B45309]', border: 'border-[#FDE68A]' },
    red: { bg: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]', text: 'text-[#B91C1C]', border: 'border-[#FECACA]' },
    gray: { bg: 'bg-[#F9FAFB] text-[#475467] border-[#E4E7EC]', text: 'text-[#475467]', border: 'border-[#E4E7EC]' },
}

/**
 * Hotel-scoped status sections: one labeled block per status with a count,
 * each holding item cards. Collapsible; all sections can be expanded freely.
 */
export function StatusSectionList<T>({ sections }: { sections: StatusSection<T>[] }) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

    const visible = sections.filter(s => s.items.length > 0)
    if (visible.length === 0) return null

    return (
        <div className="space-y-6">
            {visible.map(section => {
                const tone = toneMap[section.tone ?? 'gray']
                const isCollapsed = collapsed[section.key] ?? false
                return (
                    <section key={section.key} className="rounded-xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setCollapsed(prev => ({ ...prev, [section.key]: !isCollapsed }))}
                            className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[#F9FAFB]"
                        >
                            {section.icon && (
                                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border', tone.bg)}>
                                    {section.icon}
                                </span>
                            )}
                            <h2 className={cn('text-[13px] font-bold', tone.text)}>{section.label}</h2>
                            <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold', tone.bg)}>
                                {section.items.length}
                            </span>
                            {section.items.length > 0 && (
                                <p className="ml-auto hidden truncate text-[11px] text-[var(--text-faint)] sm:block">
                                    {section.items.length === 1 ? '1 record' : `${section.items.length} records`}
                                </p>
                            )}
                            <ChevronDown size={15} className={cn('shrink-0 text-[var(--text-faint)] transition-transform', isCollapsed && '-rotate-90')} />
                        </button>
                        {!isCollapsed && (
                            <div className="grid gap-3 border-t border-[#E4E7EC] p-3 sm:grid-cols-2 xl:grid-cols-3">
                                {section.items.map((item, i) => (
                                    <div key={String((item as { id?: string })?.id ?? i)}>
                                        {section.renderItem(item, i)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )
            })}
        </div>
    )
}

export function SectionEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
    return (
        <EmptyState
            title={title}
            description={description}
            action={action}
        />
    )
}