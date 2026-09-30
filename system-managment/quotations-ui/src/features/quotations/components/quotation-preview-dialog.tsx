import { Printer, Search } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogBody,
  DialogTitle, DialogDescription,
} from '../../../components/ui/dialog'
import { Button } from '../../../components/ui/button'
import type { Quotation } from '../../../types/quotation'
import { Input } from '../../../components/ui/input'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  quotation: Quotation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuotationPreviewDialog({ quotation, open, onOpenChange }: Props) {
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(quotation)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!quotation) {
      setSelectedQuotation(null)
      return
    }
    if (searchTerm !== '') {
      const filteredItems = quotation.line_items?.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setSelectedQuotation({ ...quotation, line_items: filteredItems || [] })
    } else {
      setSelectedQuotation(quotation)
    }
  }, [searchTerm, quotation])

  if (!quotation || !selectedQuotation) return null

  const items = selectedQuotation.line_items ?? []
  const groups: Record<string, typeof items> = {}
  for (const item of items) {
    const cat = item.category?.trim() || 'General'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  const groupEntries = Object.entries(groups)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex justify-between mb-3 relative">
              <div className="flex flex-col items-center gap-0 text-[#101828] text-xs font-pacifico text-center">
                <img src="/icon.png" alt="Logo" className="h-8 w-h-8 md:h-12 md:w-12" />
                <div>Love Laundry</div>
              </div>
              <div className="flex absolute w-full inset-0 items-center justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white border border-[#FECACA] text-[16px] font-bold">
                  {(selectedQuotation.client_name ?? '?').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
            <DialogTitle>{selectedQuotation.client_name ?? '(Unnamed)'}</DialogTitle>
            <DialogDescription>
              {selectedQuotation.quotation_title || 'Price List'} · {items.length} items
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className='flex gap-2 items-center'>
              <Input className='' onChange={(e) => setSearchTerm(e.target.value)} />
              <Search className='h-full w-6' />
            </div>
            <div className="max-h-[380px] overflow-y-auto -mx-1 px-1 space-y-3">
              {groupEntries.map(([cat, catItems]) => (
                <div key={cat}>
                  {groupEntries.length > 1 && (
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#98A2B3] mb-1.5 px-1">
                      {cat}
                    </p>
                  )}
                  <div className="space-y-1">
                    {catItems.map((li, idx) => {
                      const globalNum = items.indexOf(li) + 1
                      return (
                        <div
                          key={li.id ?? idx}
                          className="flex items-center justify-between rounded-lg border border-[#E4E7EC] bg-red-100 px-3 py-2 hover:bg-red-600 text-black hover:text-white hover:border-[#D1D5DB] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-bold w-5 shrink-0 text-right">
                              {globalNum}
                            </span>
                            <div className="min-w-0">
                              <span className="text-[13px] font-medium truncate block">
                                {li.item_name}
                              </span>
                              {li.notes && (
                                <span className="text-[11px]">{li.notes}</span>
                              )}
                              {li.specifications && li.specifications.length > 0 && (
                                <div className="mt-0.5 space-y-0.5">
                                  {li.specifications.map((s, i) => (
                                    <div key={i} className="text-[11px] leading-tight">
                                      <span>{s.specification}</span>
                                      <span className="opacity-70"> — LKR {s.unit_price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-[13px] font-semibold shrink-0 ml-3">
                            {li.unit_price.toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between rounded-lg bg-black border border-red-600 px-3 py-2.5">
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">
                {items.length} items · LKR
              </span>
              <Link to={`/quotations/${quotation.id}/print`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary">
                  <Printer className="h-3 w-3" /> Print
                </Button>
              </Link>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
