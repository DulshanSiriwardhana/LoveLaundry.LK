import type { ReactNode } from 'react'
import { cn } from '../../../lib/utils'

export interface MetricItem {
    id: string
    label: string
    value: number
    icon?: ReactNode
    tone?: 'blue' | 'green' | 'amber' | 'red' | 'gray'
    money?: boolean
}

const toneMap = {
    blue: { iconBg: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]', valueText: 'text-[#1D4ED8]' },
    green: { iconBg: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]', valueText: 'text-[#15803D]' },
    amber: { iconBg: 'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]', valueText: 'text-[#B45309]' },
    red: { iconBg: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]', valueText: 'text-[#B91C1C]' },
    gray: { iconBg: 'border-[#E4E7EC] bg-[#F9FAFB] text-[#475467]', valueText: 'text-[#374151]' },
}

export function CompactMetrics({ items, className }: { items: MetricItem[]; className?: string }) {
    return (
        <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6', className)}>
            {items.map(metric => {
                const tone = toneMap[metric.tone ?? 'gray']
                return (
                    <div
                        key={metric.id}
                        className="flex items-center gap-3 rounded-xl border border-[#E4E7EC] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
                    >
                        {metric.icon && (
                            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', tone.iconBg)}>
                                {metric.icon}
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className={cn('text-[18px] font-bold leading-none tracking-tight', metric.money && 'text-[14px]', tone.valueText)} title={metric.money ? `LKR ${metric.value.toLocaleString()}` : undefined}>
                                {metric.money ? `LKR ${metric.value.toLocaleString()}` : metric.value}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-medium text-[#98A2B3]">{metric.label}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}