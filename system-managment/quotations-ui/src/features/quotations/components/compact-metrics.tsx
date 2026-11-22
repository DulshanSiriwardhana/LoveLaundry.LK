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
    blue: { iconBg: 'border-[var(--brand-border)] bg-[var(--surface-2)] text-[var(--brand-text)]', valueText: 'text-[var(--brand-deep)]' },
    green: { iconBg: 'border-[var(--success-border)] bg-[var(--surface-2)] text-[var(--success-text)]', valueText: 'text-[var(--success-text)]' },
    amber: { iconBg: 'border-[var(--danger-border)] bg-[var(--surface-2)] text-[var(--danger-text)]', valueText: 'text-[var(--danger-text)]' },
    red: { iconBg: 'border-[var(--danger-border)] bg-[var(--surface-2)] text-[var(--danger-deep)]', valueText: 'text-[var(--danger-deep)]' },
    gray: { iconBg: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--brand-deep)]', valueText: 'text-[var(--text-primary)]' },
}

export function CompactMetrics({ items, className }: { items: MetricItem[]; className?: string }) {
    return (
        <div className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6', className)}>
            {items.map(metric => {
                const tone = toneMap[metric.tone ?? 'gray']
                return (
                    <div
                        key={metric.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0, 0, 0, 0.05)]"
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
                            <p className="mt-1 truncate text-[11px] font-medium text-[var(--text-faint)]">{metric.label}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}