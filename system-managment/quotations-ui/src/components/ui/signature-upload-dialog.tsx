import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Printer, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

export interface SignatureSlot {
  id: string
  label: string
  value?: string
}

interface SignatureUploadDialogProps {
  open: boolean
  slots: SignatureSlot[]
  onClose: () => void
  onConfirm: (signatures: Record<string, string>) => void
}

const MAX_SIZE = 3 * 1024 * 1024

export function SignatureUploadDialog({ open, slots, onClose, onConfirm }: SignatureUploadDialogProps) {
  const [pending, setPending] = useState<Record<string, string>>({})
  const [place, setPlace] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const activeSlot = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPending(
      slots.reduce<Record<string, string>>((a, s) => (s.value ? { ...a, [s.id]: s.value } : a), {}),
    )
    setPlace(
      slots.reduce<Record<string, boolean>>((a, s) => (s.value ? { ...a, [s.id]: true } : a), {}),
    )
    activeSlot.current = slots[0]?.id ?? null
  }, [open, slots])

  const pickFor = (id: string) => {
    activeSlot.current = id
    inputRef.current?.click()
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const id = activeSlot.current
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!id || !file) return
    if (file.type !== 'image/png') {
      toast.error('Only PNG images are supported.')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('Signature image is too large (max 3 MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPending(p => ({ ...p, [id]: String(reader.result) }))
      setPlace(p => ({ ...p, [id]: true }))
    }
    reader.readAsDataURL(file)
  }

  const payload = slots.reduce<Record<string, string>>(
    (a, s) => (place[s.id] && pending[s.id] ? { ...a, [s.id]: pending[s.id] } : a),
    {},
  )

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add laundry sign</DialogTitle>
          <DialogDescription>
            Upload the laundry's sign (PNG) for this print. It is used for this print only and is never
            saved to the database.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <input ref={inputRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
          {slots.map(slot => {
            const has = Boolean(pending[slot.id])
            return (
              <div key={slot.id} className="flex items-center gap-3 rounded-[10px] border border-[var(--border)] p-3">
                <label className="flex flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(place[slot.id])}
                    onChange={e => setPlace(p => ({ ...p, [slot.id]: e.target.checked }))}
                    disabled={!has}
                    className="accent-[var(--brand)] cursor-pointer"
                  />
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">{slot.label}</span>
                </label>
                {has ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={pending[slot.id]}
                      alt={slot.label}
                      className="h-10 max-w-[90px] rounded-[4px] border border-[var(--border)] bg-[var(--surface)] object-contain"
                    />
                    <button
                      onClick={() => {
                        setPending(p => { const n = { ...p }; delete n[slot.id]; return n })
                        setPlace(p => ({ ...p, [slot.id]: false }))
                      }}
                      className="cursor-pointer p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--danger-text)]"
                      aria-label={`Remove ${slot.label}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => pickFor(slot.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-[var(--border-2)] px-3 py-1.5 text-[12px] font-semibold text-[var(--brand-text)] transition-colors hover:bg-[var(--brand-soft)]"
                  >
                    <Upload size={14} /> Upload
                  </button>
                )}
              </div>
            )
          })}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full cursor-pointer">
            Cancel
          </Button>
          <Button onClick={() => onConfirm(payload)} className="w-full cursor-pointer gap-2">
            <Printer size={15} /> Print with laundry sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}