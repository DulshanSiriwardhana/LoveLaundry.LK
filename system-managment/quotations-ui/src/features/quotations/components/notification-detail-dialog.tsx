import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import { RiCloseLine, RiFileTextLine, RiEditLine, RiAddLine, RiTruckLine } from 'react-icons/ri'
import { useNavigate } from 'react-router-dom'
import type { Quotation } from '../../../types/quotation'
import type { GatePassPendingEntry, NotificationType } from '../../../types/notification'
import { formatDate } from '../../../lib/utils'

interface NotificationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: Quotation | GatePassPendingEntry | null
  type: NotificationType
}

export function NotificationDetailDialog({ open, onOpenChange, data, type }: NotificationDetailDialogProps) {
  const navigate = useNavigate()

  if (!data) return null

  const handleClose = () => onOpenChange(false)

  const isGatePass = type === 'gatepass_pending'

  const handlePrimaryAction = () => {
    onOpenChange(false)
    if (isGatePass) {
      const entry = data as GatePassPendingEntry
      navigate(`/gate-passes/${entry.gate_pass_id}`)
    } else {
      const q = data as Quotation
      navigate(`/bills/new?quotation_id=${q.id}`)
    }
  }

  const handleViewDetails = () => {
    onOpenChange(false)
    if (isGatePass) {
      const entry = data as GatePassPendingEntry
      navigate(`/gate-passes/${entry.gate_pass_id}`)
    } else {
      const q = data as Quotation
      navigate(`/quotations/${q.id}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                isGatePass ? 'bg-[var(--surface-2)] text-[var(--danger-deep)]' : 'bg-[var(--surface-2)] text-[var(--success-text)]'
              }`}>
                {isGatePass ? <RiTruckLine size={20} /> : <RiFileTextLine size={20} />}
              </div>
              <div>
                <DialogTitle className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {isGatePass ? 'Pending to Send' : 'Ready for Billing'}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-[var(--text-secondary)]">
                  {isGatePass
                    ? 'This item is still pending to be sent from its gate pass'
                    : 'This quotation has been accepted and is ready to create a bill'}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Close"
            >
              <RiCloseLine size={18} />
            </button>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {isGatePass ? (
            <div className="rounded-lg border border-[var(--border)] bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Client</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as GatePassPendingEntry).client_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Gate Pass</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)] font-mono">#{(data as GatePassPendingEntry).gate_pass_number}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Item</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as GatePassPendingEntry).item_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Pending to Send</p>
                  <p className="text-[14px] font-semibold text-[var(--danger-deep)]">{(data as GatePassPendingEntry).pending}</p>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3 grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Received</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as GatePassPendingEntry).received}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Delivered so far</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as GatePassPendingEntry).delivered}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--border)] bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Client</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as Quotation).client_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Title</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as Quotation).quotation_title || 'General Price List'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Date</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">{(data as Quotation).created_at ? formatDate((data as Quotation).created_at) : '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">Quotation #</p>
                  <p className="text-[14px] font-medium text-[var(--text-primary)] font-mono">{(data as Quotation).id}</p>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">
                  Items {((data as Quotation).line_items?.length ?? 0)}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {((data as Quotation).line_items?.slice(0, 10) ?? []).map((item, idx) => (
                    <div key={item.id ?? idx} className="flex items-center justify-between text-[13px]">
                      <span className="text-[var(--text-primary)] truncate pr-2">{item.item_name}</span>
                      <span className="text-[var(--text-secondary)] shrink-0">{item.category || 'General'}</span>
                      <span className="font-semibold text-[var(--text-primary)] shrink-0 ml-3">LKR {item.unit_price.toFixed(2)}</span>
                    </div>
                  ))}
                  {((data as Quotation).line_items?.length ?? 0) > 10 && (
                    <p className="text-[12px] text-[var(--text-faint)] text-center py-2">
                      +{((data as Quotation).line_items?.length ?? 0) - 10} more items
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                  (data as Quotation).status === 'draft' ? 'bg-[var(--surface-2)] text-[var(--danger-deep)] border-[var(--danger-border)]' :
                  (data as Quotation).status === 'received' ? 'bg-[var(--surface-2)] text-[var(--brand-text)] border-[var(--brand-border)]' :
                  (data as Quotation).status === 'delivered' ? 'bg-[var(--surface-2)] text-[var(--success-text)] border-[var(--success-border)]' :
                  'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]'
                }`}>
                  {(data as Quotation).status?.toUpperCase()}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)]">Tag: {(data as Quotation).tag?.toUpperCase() || '—'}</span>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleClose}
          >
            Close
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={handleViewDetails}
          >
            {isGatePass ? <RiTruckLine size={16} className="mr-1.5" /> : <RiEditLine size={16} className="mr-1.5" />}
            View Details
          </Button>
          <Button
            className="w-full sm:w-auto bg-[var(--danger-deep)] hover:bg-[var(--danger-deep)] text-white"
            onClick={handlePrimaryAction}
          >
            {isGatePass ? (
              <>
                <RiTruckLine size={16} className="mr-1.5" />
                Open Gate Pass
              </>
            ) : (
              <>
                <RiAddLine size={16} className="mr-1.5" />
                Create Bill
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
