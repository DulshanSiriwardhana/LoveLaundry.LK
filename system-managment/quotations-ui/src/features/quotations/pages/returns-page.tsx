import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, RotateCcw, X, Send } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { returns as returnsApi } from '../services/returns.service'
import type { Return } from '../../../types/operations'

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PENDING: { bg: '#FEF3C7', border: '#FDE68A', text: '#D97706' },
  RECEIVED: { bg: '#DBEAFE', border: '#93C5FD', text: '#2563EB' },
  PROCESSED: { bg: '#D1FAE5', border: '#6EE7B7', text: '#059669' },
}

function ReturnCard({ r, onResent }: { r: Return; onResent: (returnId: string, itemName: string, spec: string) => void }) {
  const items = r.items ?? []
  const totalReturned = items.reduce((s, i) => s + i.returned_qty, 0)
  const sc = STATUS_COLORS[r.status] || STATUS_COLORS.PENDING
  const reasons = [...new Set(items.map((i) => i.reason))]
  const pendingResend = items.filter(
    (i) => (i.action === 'RECEIVE_BACK' || i.action === 'RE_WASH') && i.resend_status !== 'SENT'
  )

  return (
    <Link to={`/returns/${r.return_id}`}>
      <Card className="p-4 h-full cursor-pointer hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#101828] truncate">{r.client_name}</p>
            <p className="text-[11px] text-[#98A2B3] mt-0.5">{r.return_id}</p>
          </div>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
            style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}
          >
            {r.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {items.map((item, j) => (
            <span key={j} className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-200 px-2 py-0.5 text-[11px]">
              <span className="font-medium text-gray-700">{item.item_name}</span>
              {item.specification && (
                <span className="rounded px-1 text-[9px] font-bold text-white bg-gray-500">{item.specification}</span>
              )}
              <span className="text-gray-400">×{item.returned_qty}</span>
              {item.resend_status === 'SENT' && (
                <span className="text-[9px] font-bold text-green-600">✓Sent</span>
              )}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#F2F4F7] pt-3 text-[12px] text-[#6B7280]">
          <span>{totalReturned} items returned</span>
          <span>{reasons.join(', ')}</span>
        </div>

        {pendingResend.length > 0 && (
          <div className="mt-2 pt-2 border-t border-amber-100 space-y-1.5">
            {pendingResend.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-[11px] text-amber-700">
                  {item.item_name}{item.specification ? ` (${item.specification})` : ''} ×{item.returned_qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onResent(r.return_id, item.item_name, item.specification || '')
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                >
                  <Send className="h-3 w-3" /> Sent
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Link>
  )
}

export default function ReturnsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [clientName, setClientName] = useState('')
  const [returns, setReturns] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setClientName(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const fetchReturns = () => {
    setLoading(true)
    setError(null)
    returnsApi
      .list({ client_name: clientName || undefined })
      .then((data) => {
        setReturns(Array.isArray(data.items) ? data.items : [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load returns')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchReturns()
  }, [clientName])

  const handleResent = async (returnId: string, itemName: string, spec: string) => {
    try {
      await returnsApi.markResent(returnId, itemName, spec)
      toast.success('Marked as sent')
      fetchReturns()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to mark as sent')
    }
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Returns' },
            ]}
          />
          <h1 className="text-dashboard-title mt-1">Returns</h1>
          <p className="text-[13px] text-[#98A2B3] mt-0.5">
            {loading ? 'Loading…' : `${returns.length} return record${returns.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link to="/returns/new">
          <Button className="bg-[#D97706] hover:bg-[#B45309] text-white shadow-lg shadow-amber-600/20">
            <Plus className="h-4 w-4" />
            Record Return
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by client name…"
          className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10 shadow-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} />
      ) : returns.length === 0 ? (
        <EmptyState
          title="No returns recorded"
          description={clientName ? `No returns found for "${clientName}".` : 'Record a return when garments come back from a client.'}
          action={
            !clientName && (
              <Link to="/returns/new">
                <Button className="bg-[#D97706] hover:bg-[#B45309] text-white">
                  <Plus className="h-4 w-4" />
                  Record Return
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {returns.map((r, i) => (
            <motion.div
              key={r.return_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <ReturnCard r={r} onResent={handleResent} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
