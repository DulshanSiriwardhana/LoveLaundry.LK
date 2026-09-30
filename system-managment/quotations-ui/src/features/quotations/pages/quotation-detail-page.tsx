import { ArrowLeft, Edit, Printer, Building2, Calendar, Hash, QrCode, Copy } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import {
  useQuotation,
  useAdvanceQuotationStatus,
  useQuotationTags,
  useCreateTags,
} from '../hooks/useQuotations'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_STYLE,
  type OrderStatus,
} from '../../../types/quotation'

function groupByCategory(
  items: Array<{
    item_name: string
    category?: string
    unit_price: number
    notes?: string
    id?: string | number
    specifications?: Array<{ specification: string; unit_price: number }>
  }>,
) {
  const groups: Record<string, typeof items> = {}
  for (const item of items) {
    const cat = item.category?.trim() || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  return Object.entries(groups)
}

export default function QuotationDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: q, isLoading, isError, error } = useQuotation(id)
  const advance = useAdvanceQuotationStatus()
  const tagsQuery = useQuotationTags(id)
  const createTags = useCreateTags()

  const currentStatus = (q?.status ?? 'draft') as OrderStatus
  const nextStages = ORDER_STATUS_TRANSITIONS[currentStatus] ?? []
  const history = q?.status_history ?? []

  const [perItem, setPerItem] = useState(false)
  const [tagLabel, setTagLabel] = useState("")

  const grouped = q ? groupByCategory(q.line_items ?? []) : []

  return (
    <div className="space-y-5 pb-10 select-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Quotations', href: '/quotations' },
              { label: q?.client_name ?? 'Details' },
            ]}
          />
          <h1 className="text-dashboard-title mt-1">{q?.client_name ?? '—'}</h1>
          {q?.quotation_title && (
            <p className="text-[13px] text-[#98A2B3] mt-0.5">{q.quotation_title}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => navigate('/quotations')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <Link to={`/quotations/${String(id)}/print`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </Link>
          <Link to={`/quotations/${String(id)}/edit`}>
            <Button>
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : isError ? (
        <ErrorState
          description={error instanceof Error ? error.message : 'Unable to load quotation'}
        />
      ) : q ? (
        <>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA]">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide">
                      Client
                    </p>
                    <p className="text-[13px] font-semibold text-[#101828]">{q.client_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] border border-[#E4E7EC]">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide">
                      Line Items
                    </p>
                    <p className="text-[13px] font-semibold text-[#101828]">
                      {q.line_items?.length ?? 0} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] border border-[#E4E7EC]">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide">
                      Updated
                    </p>
                    <p className="text-[13px] font-semibold text-[#101828]">
                      {formatDate(q.updated_at ?? q.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide">
                      Order Status
                    </p>
                    <span
                      className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${
                        ORDER_STATUS_STYLE[currentStatus]
                      }`}
                    >
                      {ORDER_STATUS_LABELS[currentStatus]}
                    </span>
                  </div>
                </div>

                {nextStages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {nextStages.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        disabled={advance.isPending}
                        onClick={() =>
                          advance.mutate({
                            id: String(id),
                            status: stage,
                          })
                        }
                        className={`rounded-lg px-3 py-2 text-[12px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                          stage === 'cancelled'
                            ? 'bg-white text-[#B42318] border-[#FECDCA] hover:bg-[#FEF3F2]'
                            : 'bg-[#E01E31] text-white border-[#E01E31] hover:bg-[#C11324]'
                        }`}
                      >
                        {stage === 'cancelled'
                          ? 'Cancel'
                          : `Mark ${ORDER_STATUS_LABELS[stage]}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[#98A2B3]">
                    This order is in a terminal state.
                  </p>
                )}

                {history.length > 0 && (
                  <div>
                    <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide mb-2">
                      History
                    </p>
                    <ol className="relative border-l border-[#E4E7EC] ml-1 space-y-2.5 pl-4">
                      {history
                        .slice()
                        .reverse()
                        .map((h, i) => (
                          <li key={i} className="relative">
                            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#E01E31] border-2 border-white" />
                            <p className="text-[12px] font-medium text-[#101828]">
                              {ORDER_STATUS_LABELS[h.status as OrderStatus] ?? h.status}
                            </p>
                            <p className="text-[11px] text-[#98A2B3]">
                              {formatDate(h.changed_at)}
                              {h.note ? ` · ${h.note}` : ''}
                              {h.changed_by ? ` · ${h.changed_by}` : ''}
                            </p>
                          </li>
                        ))}
                    </ol>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <QrCode className="h-4 w-4 text-[#E01E31]" />
                Garment Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex items-center gap-2 text-[12px] text-[#475467]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#D0D5DD]"
                    checked={perItem}
                    onChange={(e) => setPerItem(e.target.checked)}
                  />
                  One tag per item
                </label>
                {!perItem && (
                  <input
                    value={tagLabel}
                    onChange={(e) => setTagLabel(e.target.value)}
                    placeholder="Tag label (optional)"
                    className="rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
                  />
                )}
                <Button
                  size="sm"
                  disabled={createTags.isPending}
                  onClick={() =>
                    createTags.mutate({
                      id: String(id),
                      body: { per_item: perItem, label: tagLabel || undefined, count: 1 },
                    })
                  }
                >
                  {createTags.isPending ? 'Generating…' : 'Generate Tag'}
                </Button>
              </div>

              {tagsQuery.isLoading ? (
                <p className="text-[12px] text-[#98A2B3]">Loading tags…</p>
              ) : tagsQuery.data && tagsQuery.data.tags.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {tagsQuery.data.tags.map((t) => (
                    <div
                      key={String(t.id)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-[#EEF0F3] p-3"
                    >
                      <QRCodeSVG value={t.tracking_url} size={96} />
                      <p className="text-[11px] font-semibold text-[#101828] text-center">
                        {t.label || 'Garment'}
                      </p>
                      <p className="text-[10px] text-[#98A2B3] break-all text-center">
                        {t.code}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(t.tracking_url)}
                        className="flex items-center gap-1 rounded-md border border-[#E5E5E5] px-2 py-1 text-[10px] text-[#475467] hover:bg-[#F9FAFB]"
                      >
                        <Copy className="h-3 w-3" />
                        Copy URL
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#98A2B3]">
                  No tags yet. Generate QR tags to attach to each garment for scanning at
                  every stage.
                </p>
              )}
            </CardContent>
          </Card>

          <Card id="printable-receipt">
            <CardHeader className="border-b border-[#F2F4F7] pb-4">
              <div>
                <CardTitle>{q.client_name} — Price List</CardTitle>
                {q.quotation_title && (
                  <p className="text-[12px] text-[#98A2B3] mt-0.5">{q.quotation_title}</p>
                )}
              </div>
              <div className="hidden print:block text-right">
                <p className="text-[12px] font-bold text-[#101828]">Love Laundry</p>
                <p className="text-[11px] text-[#98A2B3]">
                  Medagama, Panirendawa · Reg. No: 40-3064
                </p>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {grouped.map(([cat, items]) => (
                <div key={cat}>
                  {grouped.length > 1 && (
                    <div className="px-4 py-2 bg-[#F9FAFB] border-b border-[#F2F4F7]">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                        {cat}
                      </p>
                    </div>
                  )}

                  <table className="w-full">
                    {grouped.indexOf(grouped.find(g => g[0] === cat)!) === 0 && (
                      <thead className="border-b border-[#F2F4F7]">
                        <tr className="bg-[#F9FAFB]">
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] w-12">
                            #
                          </th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3]">
                            Item
                          </th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#98A2B3] w-36">
                            Unit Price (LKR)
                          </th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {items.map((li, idx) => {
                        const globalIdx = (q.line_items ?? []).indexOf(
                          li as (typeof q.line_items)[0],
                        )
                        return (
                          <tr
                            key={li.id ?? idx}
                            className="border-b border-[#F7F8FA] hover:bg-[#FAFAFA] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-[12px] text-[#98A2B3] w-12">
                              {globalIdx + 1}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-[13px] font-medium text-[#101828]">
                                {li.item_name}
                              </span>
                              {li.notes && (
                                <span className="ml-1.5 text-[12px] text-[#98A2B3]">
                                  ({li.notes})
                                </span>
                              )}
                              {li.specifications && li.specifications.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {li.specifications.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px]">
                                      <span className="text-[#475467]">
                                        <span className="text-[#DC2626] mr-1.5">•</span>
                                        {s.specification}
                                      </span>
                                      <span className="text-[#6B7280]">—</span>
                                      <span className="font-medium text-[#101828]">
                                        LKR {s.unit_price.toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className="text-[13px] font-semibold text-[#101828]">
                                {li.unit_price.toFixed(2)}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              <div className="border-t border-[#E4E7EC] px-4 py-3 flex items-center justify-between bg-[#F9FAFB]">
                <span className="text-[12px] font-medium text-[#6B7280]">
                  {q.line_items?.length ?? 0} items total
                </span>
                <div className="text-right">
                  <p className="text-[11px] text-[#98A2B3] uppercase font-semibold tracking-wide">Currency</p>
                  <p className="text-[13px] font-semibold text-[#101828]">LKR (Sri Lankan Rupees)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Quotation not found"
          description="This quotation may have been deleted."
          action={<Button onClick={() => navigate('/quotations')}>Back to list</Button>}
        />
      )}
    </div>
  )
}
