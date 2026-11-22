import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, Search } from 'lucide-react'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { formatDate } from '../../../lib/utils'
import {
  customersOf,
  listConsolidatedInvoices,
  type ConsolidatedInvoiceRecord,
} from '../../../lib/consolidated-invoices'

const money = (n: number) => `LKR ${n.toFixed(2)}`

export default function InvoicesListPage() {
  const [records, setRecords] = useState<ConsolidatedInvoiceRecord[]>(() => listConsolidatedInvoices())
  const [query, setQuery] = useState('')

  useEffect(() => {
    const refresh = () => setRecords(listConsolidatedInvoices())
    window.addEventListener('storage', refresh)
    window.addEventListener('lovelaundry:consolidated-invoices', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('lovelaundry:consolidated-invoices', refresh)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return records
    return records.filter(r =>
      r.invoiceNo.toLowerCase().includes(q) ||
      customersOf(r).toLowerCase().includes(q) ||
      r.dateFrom.includes(q) || r.dateTo.includes(q),
    )
  }, [records, query])

  const totalOutstanding = records.reduce((s, r) => s + r.totalOutstanding, 0)

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Invoices' }]} />
          <h1 className="text-dashboard-title mt-1">Invoices</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Consolidated invoices created in this browser · {records.length} record{records.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to="/invoices/new">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-2" /> New Consolidated Invoice
          </Button>
        </Link>
      </div>

      {records.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">Invoices created</p>
            <p className="mt-0.5 text-[20px] font-bold text-[var(--text-primary)]">{records.length}</p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">Total invoiced</p>
            <p className="mt-0.5 text-[20px] font-bold text-[var(--danger-deep)]">
              {money(totalOutstanding)}
            </p>
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search invoice number or customer"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-8 pr-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--danger-deep)] focus:ring-2 focus:ring-[var(--danger-deep)]/10"
          />
        </div>
      )}

      {records.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-[18px]" aria-hidden />}
          title="No consolidated invoices yet"
          description="Create and print a consolidated invoice from unpaid bills. It will appear here with its number, period and total."
          action={
            <Link to="/invoices/new">
              <Button variant="primary"><Plus className="h-4 w-4 mr-2" /> New Consolidated Invoice</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState kind="search" description={`No invoices match “${query}”.`} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Customers</th>
                  <th className="px-4 py-3 text-right font-semibold">Bills</th>
                  <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
                  <th className="px-4 py-3 text-right font-semibold">Open</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(record => (
                  <tr key={record.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{record.invoiceNo}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(record.createdAt)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{record.dateFrom || '—'} → {record.dateTo || '—'}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-secondary)]" title={customersOf(record)}>{customersOf(record)}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{record.bills.length}</td>
                    <td className="px-4 py-3 text-right font-bold text-[var(--danger-deep)]">{money(record.totalOutstanding)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/invoices/${record.id}`}
                        className="inline-flex rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--danger-deep)] hover:text-[var(--danger-deep)]"
                      >
                        View / Print
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
