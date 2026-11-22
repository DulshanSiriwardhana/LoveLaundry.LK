import { Building2 } from 'lucide-react'

/** Prominent hotel label used when the All Hotels admin view is active. */
export function HotelBadge({ name }: { name: string }) {
    return (
        <span
            title={name}
            className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-[var(--brand-border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-deep)]"
        >
            <Building2 size={10} className="shrink-0" />
            <span className="truncate">{name}</span>
        </span>
    )
}