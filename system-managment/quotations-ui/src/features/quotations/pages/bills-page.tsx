import { useMemo, useState } from 'react'
import { Search, Receipt, Building2, ArrowLeft, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { useQuotations } from '../hooks/useQuotations'
import type { Quotation } from '../../../types/quotation'
import { BillBuilder } from '../components/bill-builder'

export default function BillsPage() {
  const { data: quotations = [], isLoading, isError, error } = useQuotations()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Quotation | null>(null)

  const filteredQuotations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return quotations
    return quotations.filter(quo =>
      [quo.client_name, quo.quotation_title ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [quotations, search])

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Bills' },
          ]}
        />
        <h1 className="text-dashboard-title mt-1">Create Bill</h1>
        <p className="text-[13px] text-[#98A2B3] mt-0.5">
          {selected
            ? 'Search items in this quotation and set quantities to build the bill'
            : 'Pick a quotation to start a bill for it'}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-64" />
        </div>
      ) : isError ? (
        <ErrorState
          description={error instanceof Error ? error.message : 'Unable to load quotations'}
        />
      ) : !selected ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search quotations by client or title…"
              className="h-11 w-full rounded-xl border border-[#E4E7EC] bg-white pl-10 pr-9 text-[14px] text-[#101828] outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/10 shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {filteredQuotations.length === 0 ? (
            <EmptyState
              title="No quotations found"
              description={
                quotations.length === 0
                  ? 'Create a quotation first, then come back to build a bill from it.'
                  : `No quotations match "${search}".`
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredQuotations.map(q => (
                <Card
                  key={q.id}
                  hover
                  onClick={() => setSelected(q)}
                  className="cursor-pointer p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA]">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#101828] truncate">
                        {q.client_name}
                      </p>
                      <p className="text-[12px] text-[#98A2B3] truncate">
                        {q.quotation_title || 'Price List'} · {q.line_items?.length ?? 0} items
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b border-[#F2F4F7] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F1] text-[#DC2626] border border-[#FECACA]">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle>{selected.client_name}</CardTitle>
                  <p className="text-[12px] text-[#98A2B3] mt-0.5">
                    {selected.quotation_title || 'Price List'} · {selected.line_items?.length ?? 0} items
                  </p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-3.5 w-3.5" /> Change quotation
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-[12px] text-[#98A2B3]">
                Only this quotation's items can be added to this bill. To bill a different
                client, change the quotation above — a bill can't mix items from two quotations.
              </p>
            </CardContent>
          </Card>

          <BillBuilder quotation={selected} />
        </>
      )}
    </div>
  )
}