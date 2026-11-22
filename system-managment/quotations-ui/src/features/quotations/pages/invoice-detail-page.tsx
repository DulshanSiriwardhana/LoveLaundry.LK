import { useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Button } from '../../../components/ui/button'
import { EmptyState } from '../../../components/ui/empty-state'
import { PrintTarget } from '../../../components/ui/print-target'
import { ConsolidatedInvoiceTemplate } from '../components/consolidated-invoice-template'
import { formatDate } from '../../../lib/utils'
import { customersOf, getConsolidatedInvoice } from '../../../lib/consolidated-invoices'

const money = (n: number) => `LKR ${n.toFixed(2)}`

export default function InvoiceDetailPage() {
  const { id = '' } = useParams()
  const record = useMemo(() => getConsolidatedInvoice(id), [id])
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Consolidated-Invoice-${record?.invoiceNo ?? id}`,
  })

  if (!record) {
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Invoices', href: '/invoices' }, { label: 'Not found' }]} />
        <EmptyState
          icon={<FileText className="size-[18px]" aria-hidden />}
          title="Invoice not found"
          description="This invoice is not stored in this browser. It may have been created on another device or the browser data was cleared."
          action={<Link to="/invoices"><Button>Back to Invoices</Button></Link>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Invoices', href: '/invoices' }, { label: record.invoiceNo }]} />
          <h1 className="text-dashboard-title mt-1">{record.invoiceNo}</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Generated {formatDate(record.createdAt)} · Period {record.dateFrom || '—'} to {record.dateTo || '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/invoices">
            <Button variant="secondary"><ArrowLeft className="h-4 w-4 mr-2" /> Invoices</Button>
          </Link>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-2" /> Reprint</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 print:hidden">
        {[
          ['Bills included', String(record.bills.length)],
          ['Customers', customersOf(record)],
          ['Total outstanding', money(record.totalOutstanding)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
            <p className="mt-0.5 truncate text-[15px] font-bold text-[var(--text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="px-4 py-3 font-semibold">Bill</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-right font-semibold">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {record.bills.map(bill => (
                <tr key={bill.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{bill.id.slice(0, 10).toUpperCase()}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{bill.client_name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(bill.created_at)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{money(bill.grand_total ?? bill.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{money(bill.paid_amount ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-[var(--danger-deep)]">
                    {money(bill.outstanding_amount ?? (bill.grand_total ?? bill.total_amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PrintTarget>
        <ConsolidatedInvoiceTemplate
          ref={printRef}
          bills={record.bills}
          dateFrom={record.dateFrom}
          dateTo={record.dateTo}
          generatedAt={record.createdAt}
        />
      </PrintTarget>
    </div>
  )
}
