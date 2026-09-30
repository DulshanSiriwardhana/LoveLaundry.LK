import { useLinenStats } from '../hooks/useLinen'
import { LINEN_STATUS_CONFIG, type LinenStatus } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { StatCard } from '../../../components/ui/stat-card'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Package, Droplets, Clock } from 'lucide-react'

const STATUS_ORDER: LinenStatus[] = [
  'IN_STOCK', 'AT_CLIENT', 'COLLECTED', 'AT_LAUNDRY',
  'WASHING', 'DRYING', 'PRESSING', 'READY',
  'DELIVERED', 'MISSING', 'DAMAGED', 'RETIRED',
]

export default function LinenDashboard() {
  const { data: stats, isLoading, isError } = useLinenStats()

  if (isLoading) return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Dashboard' }]} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )

  if (isError || !stats) return <ErrorState />

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Dashboard' }]} />

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
          Linen Tracking
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Overview of all linen assets across clients and statuses</p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Linens" value={stats.total.toLocaleString()} icon={<Package size={22} />} description="All tracked items" />
        <StatCard label="Total Wash Cycles" value={stats.total_wash_cycles.toLocaleString()} icon={<Droplets size={22} />} description="Across all items" />
        <StatCard label="Recently Scanned" value={stats.recently_scanned.toLocaleString()} icon={<Clock size={22} />} description="Last 24 hours" />
      </div>

      {/* Status breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">Status Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {STATUS_ORDER.map(status => {
            const cfg = LINEN_STATUS_CONFIG[status]
            const key = status.toLowerCase()
            const value = (stats as unknown as Record<string, number>)[key] ?? 0
            return (
              <Card key={status} className="group border border-[var(--border)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 hover:border-[var(--border-2)]">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[var(--text-muted)] truncate group-hover:text-[var(--text-secondary)] transition-colors">{cfg.label}</p>
                    <p className="text-lg font-bold transition-colors" style={{ color: cfg.color }}>{value.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
