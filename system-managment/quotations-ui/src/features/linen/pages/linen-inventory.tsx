import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLinens } from '../hooks/useLinen'
import { LINEN_STATUS_CONFIG, LINEN_CATEGORIES, LINEN_CONDITIONS, type LinenStatus } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { EmptyState } from '../../../components/ui/empty-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import { Search, ChevronLeft, ChevronRight, Download, X } from 'lucide-react'

export default function LinenInventory() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [condition, setCondition] = useState('')
  const [page, setPage] = useState(0)
  const perPage = 50

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError } = useLinens({
    search: debouncedSearch || undefined,
    category: category || undefined,
    status: status || undefined,
    condition: condition || undefined,
    skip: page * perPage,
    limit: perPage,
  })

  const totalPages = data ? Math.ceil(data.total / perPage) : 0
  const hasFilters = Boolean(debouncedSearch || category || status || condition)

  const clearFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setCategory('')
    setStatus('')
    setCondition('')
    setPage(0)
  }

  const handleExport = () => {
    if (!data?.items?.length) return
    const headers = ['Linen ID', 'Category', 'Item Type', 'Client', 'Status', 'Condition', 'Wash Count', 'Last Scan']
    const rows = data.items.map(l => [
      l.linen_id, l.category, l.item_type, l.client_name, l.status, l.condition, String(l.wash_count), l.last_scanned_date || ''
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `linen-inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Inventory' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>Linen Inventory</h1>
          <p className="text-sm text-[var(--text-muted)]">{data?.total ?? 0} total items</p>
        </div>
        <div className="flex gap-2">
          <Link to="/linen/scanner"><Button variant="outline" size="sm">Scan</Button></Link>
          <Link to="/linen/tags"><Button variant="outline" size="sm">Generate Tags</Button></Link>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!data?.items?.length}><Download size={14} className="mr-1" />Export</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border border-[var(--border)] shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search linen ID, type, client..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors"
              />
            </div>
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(0) }}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors">
              <option value="">All Categories</option>
              {LINEN_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors">
              <option value="">All Statuses</option>
              {(Object.keys(LINEN_STATUS_CONFIG) as LinenStatus[]).map(s => (
                <option key={s} value={s}>{LINEN_STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <select value={condition} onChange={e => { setCondition(e.target.value); setPage(0) }}
              className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors">
              <option value="">All Conditions</option>
              {LINEN_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[var(--text-muted)] hover:text-[#DC2626]">
                <X size={14} className="mr-1" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : isError ? <ErrorState /> : !data?.items?.length ? (
        <EmptyState title="No linen found" description="Try adjusting your filters or generate new linen tags." />
      ) : (
        <Card className="border border-[var(--border)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  {['Linen ID', 'Type', 'Client', 'Status', 'Condition', 'Washes', 'Last Scan', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map(linen => {
                  const stCfg = LINEN_STATUS_CONFIG[linen.status as LinenStatus] ?? { label: linen.status, color: '#6B7280', bg: '#F3F4F6' }
                  return (
                    <tr
                      key={linen.id}
                      onClick={() => navigate(`/linen/${linen.id}`)}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold text-[var(--text-primary)]">{linen.linen_id}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{linen.item_type}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{linen.client_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stCfg.color }} />
                          {stCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{linen.condition}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-center">{linen.wash_count}</td>
                      <td className="px-4 py-3 text-[var(--text-muted)] text-xs">{linen.last_scanned_date ? formatDate(linen.last_scanned_date) : '—'}</td>
                      <td className="px-4 py-3">
                        <Link to={`/linen/${linen.id}`} onClick={e => e.stopPropagation()} className="text-[#DC2626] hover:underline text-xs font-semibold">View</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--text-muted)]">Page {page + 1} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
