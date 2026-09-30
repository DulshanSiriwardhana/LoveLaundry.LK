import { FileText, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import { useQuotations } from '../hooks/useQuotations'

export default function ClientsPage() {
  const { data, isLoading, isError, error } = useQuotations()

  const clients = useMemo(() => {
    const grouped: Record<string, typeof data> = {}
    for (const q of data ?? []) {
      const name = (q.client_name ?? 'Unknown').trim() || 'Unknown'
      if (!grouped[name]) grouped[name] = []
      grouped[name]!.push(q)
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  return (
    <div className="space-y-5 pb-10 select-none">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'By Client' }]} />
        <h1 className="text-dashboard-title mt-1">By Client</h1>
        <p className="text-[13px] text-[#98A2B3] mt-0.5">All hotels and venues with their quotations</p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          description={error instanceof Error ? error.message : 'Unable to load clients'}
        />
      ) : clients.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map(([clientName, quotes], idx) => (
            <motion.div
              key={clientName}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
            >
              <Card className="h-full hover:border-[#FECACA] transition-colors">
                <CardHeader className="border-b border-[#F2F4F7] pb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA] text-[15px] font-bold">
                      {clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{clientName}</CardTitle>
                      <p className="text-[11px] text-[#98A2B3] mt-0.5">
                        {quotes?.length ?? 0} quotation{(quotes?.length ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Link to={`/quotations/new`}>
                    <Button variant="secondary" size="sm">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardHeader>

                <CardContent className="pt-3 space-y-1.5">
                  {(quotes ?? []).map(q => (
                    <Link
                      key={q.id}
                      to={`/quotations/${q.id}`}
                      className="flex items-center gap-3 rounded-lg border border-[#E4E7EC] bg-white px-3 py-2.5 hover:border-[#FECACA] hover:bg-[#FFF8F8] transition-all group"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB] group-hover:text-[#DC2626] transition-colors" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-[#374151] truncate">
                          {q.quotation_title || `Quotation #${q.id}`}
                        </p>
                        <p className="text-[10px] text-[#98A2B3]">
                          {q.line_items?.length ?? 0} items · {formatDate(q.updated_at ?? q.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          description="Clients will appear once you create quotations."
          action={
            <Link to="/quotations/new">
              <Button>Create quotation</Button>
            </Link>
          }
        />
      )}
    </div>
  )
}
