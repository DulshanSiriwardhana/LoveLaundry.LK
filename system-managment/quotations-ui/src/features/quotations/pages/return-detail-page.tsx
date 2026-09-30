import { useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Calendar, User, Package, FileText,
  ChevronDown, ChevronUp, Send, CheckCircle2, Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { toast } from 'sonner'
import { formatDate } from '../../../lib/utils'
import { returns as returnsApi } from '../services/returns.service'
import type { Return } from '../../../types/operations'
import { invalidateResource } from '../../../cache/invalidation'

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  PENDING: { label: 'Pending', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', icon: Clock },
  RECEIVED: { label: 'Received', bg: '#DBEAFE', text: '#2563EB', border: '#93C5FD', icon: Package },
  PROCESSED: { label: 'Processed', bg: '#D1FAE5', text: '#059669', border: '#6EE7B7', icon: CheckCircle2 },
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['RECEIVED'],
  RECEIVED: ['PROCESSED'],
  PROCESSED: [],
}

const REASON_LABELS: Record<string, string> = {
  WRONG_ITEM: 'Wrong Item Sent',
  DAMAGED: 'Damaged / Stained',
  MISSING: 'Missing Items',
  OTHER: 'Other',
}

const CONDITION_LABELS: Record<string, string> = {
  GOOD: 'Good (re-usable)',
  DAMAGED: 'Damaged',
  STAINED: 'Stained',
  LOST: 'Lost (not returned)',
}

const ACTION_LABELS: Record<string, string> = {
  RECEIVE_BACK: 'Receive Back',
  RE_WASH: 'Re-wash Cycle',
  DISCARD: 'Discard',
  COMPENSATE: 'Compensate Client',
}

export default function ReturnDetailPage() {
  const queryClient = useQueryClient()
  const { id } = useParams()
  const [returnData, setReturnData] = useState<Return | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Fetch return data
  useEffect(() => {
    if (!id) return
    setLoading(true)
    returnsApi.get(id)
      .then((data) => {
        setReturnData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load return')
        setLoading(false)
      })
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!returnData) return
    setUpdating(true)
    try {
      const updated = await returnsApi.update(returnData.return_id, { status: newStatus })
      setReturnData(updated)
      setStatusOpen(false)
      invalidateResource(queryClient, 'returns', 'gatepasses')
      toast.success(`Status updated to ${newStatus}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleMarkResent = async (itemName: string, spec: string) => {
    if (!returnData) return
    try {
      const updated = await returnsApi.markResent(returnData.return_id, itemName, spec)
      setReturnData(updated)
      invalidateResource(queryClient, 'returns')
      toast.success('Marked as sent')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to mark as sent')
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error) {
    return <ErrorState description={error} />
  }

  if (!returnData) {
    return <EmptyState title="Return not found" description="It may have been removed." />
  }

  const sc = STATUS_CONFIG[returnData.status] || STATUS_CONFIG.PENDING
  const StatusIcon = sc.icon
  const transitions = STATUS_TRANSITIONS[returnData.status] || []
  // See delivery-detail-page: the type says non-optional, the API can disagree.
  const items = returnData.items ?? []
  const totalReturned = items.reduce((s, i) => s + i.returned_qty, 0)

  return (
    <div className="space-y-5 pb-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link to="/returns" className="mt-1 text-[#98A2B3] hover:text-[#374151] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Returns', href: '/returns' },
              { label: returnData.return_id },
            ]}
          />
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-dashboard-title">{returnData.client_name}</h1>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
            >
              <StatusIcon className="h-3 w-3" />
              {sc.label}
            </span>
          </div>
          <p className="text-[13px] text-[#98A2B3] mt-0.5">
            Return ID: <span className="font-mono">{returnData.return_id}</span>
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: Calendar, label: 'Recorded', value: formatDate(returnData.created_at) },
          { icon: User, label: 'Recorded By', value: returnData.recorded_by || '—' },
          { icon: Package, label: 'Total Returned', value: `${totalReturned} pcs` },
          { icon: FileText, label: 'Gate Pass', value: returnData.gate_pass_id.slice(-8).toUpperCase() },
        ].map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-[#98A2B3]" />
              <p className="text-[11px] text-[#98A2B3] font-medium uppercase tracking-wide">{label}</p>
            </div>
            <p className="text-[13px] font-semibold text-[#101828]">{value}</p>
          </Card>
        ))}
      </div>

      {/* Status Change */}
      {transitions.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50/80 hover:bg-gray-100 transition cursor-pointer"
          >
            <span className="text-[13px] font-semibold text-gray-900">Change Status</span>
            {statusOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {statusOpen && (
            <div className="px-5 py-4 border-t border-gray-100">
              <p className="text-[12px] text-gray-500 mb-3">Move to:</p>
              <div className="flex gap-2">
                {transitions.map((s) => {
                  const tc = STATUS_CONFIG[s]
                  if (!tc) return null
                  const TIcon = tc.icon
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={updating}
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80 cursor-pointer disabled:opacity-50"
                      style={{ background: tc.bg, color: tc.text, borderColor: tc.border }}
                    >
                      <TIcon className="h-3 w-3" />
                      {tc.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Returned Items */}
      <Card>
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-[15px] font-semibold text-gray-900">
            Returned Items ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Item</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Spec</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Qty</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reason</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Condition</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.item_name}</td>
                  <td className="px-4 py-3">
                    {item.specification ? (
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-gray-500">
                        {item.specification}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{item.returned_qty}</td>
                  <td className="px-4 py-3 text-gray-600">{REASON_LABELS[item.reason] || item.reason}</td>
                  <td className="px-4 py-3 text-gray-600">{CONDITION_LABELS[item.condition] || item.condition}</td>
                  <td className="px-4 py-3 text-gray-600">{ACTION_LABELS[item.action] || item.action}</td>
                  <td className="px-4 py-3 text-center">
                    {item.action === 'RECEIVE_BACK' || item.action === 'RE_WASH' ? (
                      item.resend_status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarkResent(item.item_name, item.specification || '')}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                        >
                          <Send className="h-3 w-3" /> Mark Sent
                        </button>
                      )
                    ) : (
                      <span className="text-gray-400 text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Bill Adjustment */}
      {returnData.bill_adjustment && returnData.bill_adjustment.adjustment_type !== 'NONE' && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-[#101828] mb-3">Bill Adjustment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-[#98A2B3] mb-0.5">Type</p>
              <p className="text-[13px] font-semibold text-[#101828]">{returnData.bill_adjustment.adjustment_type}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#98A2B3] mb-0.5">Amount</p>
              <p className="text-[13px] font-semibold text-[#101828]">LKR {returnData.bill_adjustment.amount.toLocaleString()}</p>
            </div>
            {returnData.bill_adjustment.notes && (
              <div>
                <p className="text-[11px] text-[#98A2B3] mb-0.5">Notes</p>
                <p className="text-[13px] text-[#374151]">{returnData.bill_adjustment.notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Notes */}
      {returnData.notes && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-[#101828] mb-3">Notes</h3>
          <p className="text-[13px] text-[#374151]">{returnData.notes}</p>
        </Card>
      )}
    </div>
  )
}
