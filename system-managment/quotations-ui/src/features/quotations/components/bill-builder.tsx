import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Receipt, RotateCcw, Save, Search, X, PackageSearch } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { useCreateBill } from '../hooks/useBills'
import type { Quotation } from '../../../types/quotation'

interface BillBuilderProps {
  quotation: Quotation
}

export function BillBuilder({ quotation }: BillBuilderProps) {
  const navigate = useNavigate()
  const createBill = useCreateBill()
  const lineItems = quotation.line_items ?? []

  const items = useMemo(() => {
    const seen = new Set<string>()
    return lineItems.map((li, index) => {
      const rawId = li.id !== undefined && li.id !== null ? String(li.id).trim() : ''
      const safeKey = rawId && !seen.has(rawId) ? rawId : `idx-${index}`
      seen.add(safeKey)
      return { ...li, _key: safeKey }
    })
  }, [lineItems])

  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [highlight, setHighlight] = useState(0)

  const setCount = (key: string, next: number) => {
    const safe = Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0
    setCounts(prev => ({ ...prev, [key]: safe }))
  }

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return items
      .filter(li =>
        [li.item_name, li.category ?? '', li.notes ?? ''].join(' ').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [items, search])

  useEffect(() => {
    setHighlight(prev => (searchResults.length === 0 ? 0 : Math.min(prev, searchResults.length - 1)))
  }, [searchResults.length])

  const selectedRows = useMemo(
    () =>
      items
        .map(li => ({ item: li, qty: counts[li._key] ?? 0 }))
        .filter(row => row.qty > 0),
    [items, counts],
  )

  const totalQuantity = selectedRows.reduce((sum, r) => sum + r.qty, 0)
  const grandTotal = selectedRows.reduce((sum, r) => sum + r.qty * r.item.unit_price, 0)

  const handleReset = () => {
    setCounts({})
    setSearch('')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(prev => Math.min(prev + 1, searchResults.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(prev => Math.max(prev - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      const target = searchResults[highlight]
      if (!target) return
      e.preventDefault()
      if ((counts[target._key] ?? 0) === 0) setCount(target._key, 1)
    }
  }

  const handleSave = () => {
    createBill.mutate(
      {
        quotation_id: String(quotation.id),
        client_name: quotation.client_name,
        quotation_title: quotation.quotation_title,
        items: selectedRows.map(({ item, qty }) => ({
          item_name: item.item_name,
          category: item.category,
          unit_price: item.unit_price,
          quantity: qty,
        })),
      },
      {
        onSuccess: bill => {
          navigate(`/bills/${bill.id}`)
        },
      },
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12 select-none">
      <Card className="lg:col-span-7">
        <CardHeader className="border-b border-[#F2F4F7] pb-4">
          <div className="w-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Add Items</CardTitle>
                <p className="text-[12px] text-[#98A2B3] mt-0.5">
                  Search this quotation's items by name or category to add them
                </p>
              </div>
              {selectedRows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              )}
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Type to search items…"
                className="h-9 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-8 text-[13px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-[#98A2B3]">
              Use ↑/↓ to move and Enter to add
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {items.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#98A2B3]">
              This quotation has no line items yet.
            </p>
          ) : !search.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3F4F6] border border-[#E4E7EC]">
                <PackageSearch className="h-5 w-5 text-[#9CA3AF]" />
              </div>
              <p className="text-[13px] font-medium text-[#374151]">Search to add an item</p>
              <p className="text-[12px] text-[#98A2B3] mt-1 max-w-[260px]">
                Start typing an item name or category above — matching items will appear here.
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-[#98A2B3]">
              No items match &quot;{search}&quot;.
            </p>
          ) : (
            <div className="divide-y divide-[#F2F4F7]">
              {searchResults.map((li, index) => {
                const qty = counts[li._key] ?? 0
                return (
                  <div
                    key={li._key}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg border transition-colors ${
                      index === highlight
                        ? 'border-red-300 bg-[#FFF8F8]'
                        : qty > 0
                          ? 'border-transparent bg-[#FFF8F8]'
                          : 'border-transparent'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#101828] truncate">
                        {li.item_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {li.category && <Badge variant="secondary">{li.category}</Badge>}
                        <span className="text-[12px] text-[#98A2B3]">
                          LKR {li.unit_price.toFixed(2)} / unit
                        </span>
                        {li.notes && (
                          <span className="text-[12px] text-[#98A2B3]">· {li.notes}</span>
                        )}
                      </div>
                    </div>

                    {qty === 0 ? (
                      <Button size="sm" onClick={() => setCount(li._key, 1)} className="shrink-0">
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCount(li._key, qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
                          aria-label={`Decrease ${li.item_name} quantity`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={e => setCount(li._key, Number(e.target.value))}
                          className="h-7 w-12 rounded-md border border-[#E4E7EC] text-center text-[13px] font-semibold text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10"
                          aria-label={`${li.item_name} quantity`}
                        />
                        <button
                          type="button"
                          onClick={() => setCount(li._key, qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E4E7EC] text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
                          aria-label={`Increase ${li.item_name} quantity`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-5">
        <Card className="lg:sticky lg:top-4">
          <CardHeader className="border-b border-[#F2F4F7] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA]">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle>Bill Summary</CardTitle>
                <p className="text-[12px] text-[#98A2B3] mt-0.5 truncate">
                  {quotation.client_name}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {selectedRows.length === 0 ? (
              <p className="text-[13px] text-[#98A2B3] py-6 text-center">
                No items added yet. Search on the left and add items to build the bill.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedRows.map(({ item, qty }) => (
                  <div
                    key={item._key}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[#F2F4F7] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#101828] truncate">
                        {item.item_name}
                      </p>
                      <p className="text-[12px] text-[#98A2B3]">
                        LKR {item.unit_price.toFixed(2)} × {qty} ={' '}
                        <span className="font-semibold text-[#101828]">
                          LKR {(item.unit_price * qty).toFixed(2)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCount(item._key, qty - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E4E7EC] text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
                        aria-label={`Decrease ${item.item_name} quantity`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-[12px] font-semibold text-[#101828]">
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCount(item._key, qty + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E4E7EC] text-[#6B7280] hover:bg-[#F3F4F6] transition cursor-pointer"
                        aria-label={`Increase ${item.item_name} quantity`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCount(item._key, 0)}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#FEF2F2] hover:text-[#DC2626] transition cursor-pointer"
                        aria-label={`Remove ${item.item_name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-t border-[#E4E7EC] pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                <span>Items selected</span>
                <span className="font-medium">{selectedRows.length}</span>
              </div>
              <div className="flex items-center justify-between text-[12px] text-[#6B7280]">
                <span>Total quantity</span>
                <span className="font-medium">{totalQuantity}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#E4E7EC] pt-2 text-[15px] font-bold text-[#101828]">
                <span>Total Amount</span>
                <span className="text-[#DC2626]">LKR {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full mt-4"
              disabled={selectedRows.length === 0 || createBill.isPending}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              {createBill.isPending ? 'Saving…' : 'Save Bill'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}