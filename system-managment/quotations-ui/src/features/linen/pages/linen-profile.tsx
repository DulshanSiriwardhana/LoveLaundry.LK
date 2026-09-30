import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { useRef, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useLinen, useLinenEvents, useScanLinen } from '../hooks/useLinen'
import { LINEN_STATUS_CONFIG, SCAN_ACTIONS, type LinenStatus } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { ErrorState } from '../../../components/ui/error-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { formatDate } from '../../../lib/utils'
import { toast } from 'sonner'

export default function LinenProfile() {
  const { id } = useParams<{ id: string }>()
  const { data: linen, isLoading, isError } = useLinen(id)
  const { data: events } = useLinenEvents(id)
  const scanMutation = useScanLinen()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && linen?.linen_id) {
      JsBarcode(barcodeRef.current, linen.linen_id, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0,
      })
    }
  }, [linen?.linen_id])

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="flex gap-5">
        <Skeleton className="w-80 h-96 rounded-xl" />
        <div className="flex-1 space-y-4"><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
      </div>
    </div>
  )
  if (isError || !linen) return <ErrorState />

  const stCfg = LINEN_STATUS_CONFIG[linen.status as LinenStatus] ?? { label: linen.status, color: '#6B7280', bg: '#F3F4F6' }

  const handleQuickAction = (action: string) => {
    if (!id) return
    setPendingAction(action)
    scanMutation.mutate(
      { docId: id, payload: { action } },
      {
        onSuccess: () => {
          const label = SCAN_ACTIONS.find(a => a.value === action)?.label ?? action
          toast.success(`${label} — ${linen.linen_id}`)
        },
        onSettled: () => setPendingAction(null),
      }
    )
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Linen', href: '/linen' },
        { label: 'Inventory', href: '/linen/inventory' },
        { label: linen.linen_id },
      ]} />

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left column — QR, Barcode, Status, Actions */}
        <div className="lg:w-80 space-y-4">
          {/* QR + Barcode card */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              <QRCodeSVG value={linen.linen_id} size={160} level="M" includeMargin />
              <div className="w-full text-center">
                <svg ref={barcodeRef} className="w-full" />
                <p className="mt-2 text-lg font-bold font-mono text-[var(--text-primary)] tracking-wider">{linen.linen_id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Current Status</p>
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stCfg.color }} />
                <span className="text-lg font-bold" style={{ color: stCfg.color }}>{stCfg.label}</span>
              </div>
              {linen.location && <p className="text-xs text-[var(--text-muted)] mt-1.5">Location: {linen.location}</p>}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {SCAN_ACTIONS.map(sa => (
                  <Button
                    key={sa.value}
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start h-8 focus:ring-2 focus:ring-[#DC2626]/20"
                    style={{ borderColor: sa.color + '30', color: sa.color }}
                    onClick={() => handleQuickAction(sa.value)}
                    disabled={scanMutation.isPending}
                  >
                    {pendingAction === sa.value && <Loader2 size={12} className="animate-spin mr-1.5" />}
                    {sa.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Details + History */}
        <div className="flex-1 space-y-4">
          {/* Item details */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4" style={{ fontFamily: '"Spectral", Georgia, serif' }}>Item Details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  ['Category', linen.category],
                  ['Item Type', linen.item_type],
                  ['Client', linen.client_name],
                  ['Department', linen.department || '—'],
                  ['Size', linen.size || '—'],
                  ['Color', linen.color || '—'],
                  ['Condition', linen.condition],
                  ['Wash Count', String(linen.wash_count)],
                  ['Last Washed', linen.last_washed_date ? formatDate(linen.last_washed_date) : '—'],
                  ['Created', formatDate(linen.created_at)],
                  ['Last Updated', formatDate(linen.updated_at)],
                  ['Retirement', linen.retirement_date ? formatDate(linen.retirement_date) : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wide">{label}</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              {linen.notes && (
                <div className="mt-4 p-3 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <p className="text-[11px] text-[var(--text-muted)] font-medium uppercase mb-1">Notes</p>
                  <p className="text-sm text-[var(--text-primary)]">{linen.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Movement history */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4" style={{ fontFamily: '"Spectral", Georgia, serif' }}>Movement History</h2>
              {events?.items?.length ? (
                <div className="space-y-0">
                  {events.items.map((evt, i) => {
                    const fromCfg = evt.from_status ? LINEN_STATUS_CONFIG[evt.from_status as LinenStatus] : null
                    const toCfg = LINEN_STATUS_CONFIG[evt.to_status as LinenStatus] ?? { label: evt.to_status, color: '#6B7280' }
                    return (
                      <div key={evt.id} className="flex gap-3 relative pb-4 last:pb-0">
                        {i < events.items.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-[var(--border)]" />}
                        <div className="w-[15px] h-[15px] rounded-full border-2 flex-shrink-0 mt-0.5 z-10" style={{ borderColor: toCfg.color, backgroundColor: i === 0 ? toCfg.color : '#fff' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {fromCfg && <span className="text-xs text-[var(--text-muted)]">{fromCfg.label} →</span>}
                            <span className="text-xs font-bold" style={{ color: toCfg.color }}>{toCfg.label}</span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(evt.timestamp)}{evt.user ? ` · ${evt.user}` : ''}{evt.location ? ` · ${evt.location}` : ''}</p>
                          {evt.notes && <p className="text-xs text-[var(--text-secondary)] mt-0.5 italic">{evt.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No history yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
