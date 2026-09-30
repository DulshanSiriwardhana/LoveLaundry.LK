import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Printer, Save, Search, RotateCcw, CheckCircle2, FileText } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { EmptyState } from '../../../components/ui/empty-state'
import { ErrorState } from '../../../components/ui/error-state'
import { Skeleton } from '../../../components/ui/skeleton'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { SyncStatusBar } from '../../../components/ui/sync-status-bar'
import { SignatureUploadDialog } from '../../../components/ui/signature-upload-dialog'
import { useDataGrid } from '../../../hooks/use-data-grid'
import { COMPANY } from '../../../config/company'
import {
  useCreateLegacyInvoice,
  useDeleteLegacyInvoice,
  useLegacyInvoices,
} from '../hooks/useLegacyInvoices'
import type { LegacyInvoice } from '../../../types/shop-bill'
import { formatDateOnly } from '../../../lib/utils'
import { formatDayMonthYear, todayISO } from '../../../lib/time'

interface InvoiceRow {
  id: string
  date: string
  billNumber: string
  amount: number
}

const inputClass = 'h-10 w-full rounded-lg border border-[#E4E7EC] bg-white px-3 text-[13px] text-[#101828] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition'
const cellInputClass = 'h-9 w-full rounded-lg border border-[#E4E7EC] bg-white px-2 text-[13px] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition'

const fmtMoney = (v: number) => `LKR ${(Number(v) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const legacyPrintStyles = `
  @media print {
    .li-print-sheet { margin: 0; padding: 0; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    .no-print { display: none !important; }
  }

  .li-print-sheet { font-family: "Spectral", Georgia, serif; color: #111; background: #fff; font-size: 12px; line-height: 1.4; }
  .li-slip { border: 1.5px solid #E01E31; }
  .li-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 20px; border-bottom: 1.5px solid #E01E31; }
  .li-brand { display: flex; align-items: center; gap: 10px; }
  .li-logo { width: 44px; height: 44px; object-fit: contain; background: #fff; border: 1.5px solid #E01E31; border-radius: 50%; padding: 5px; box-sizing: border-box; flex-shrink: 0; }
  .li-brand-name { font-weight: 700; letter-spacing: -0.25px; font-size: 20px; color: #E01E31; line-height: 1.15; }
  .li-brand-tagline { font-size: 11px; color: #6B7280; margin-top: 1px; }
  .li-brand-contact { font-size: 10px; color: #9CA3AF; margin-top: 4px; line-height: 1.45; }
  .li-meta { text-align: right; }
  .li-title { font-size: 17px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; color: #E01E31; line-height: 1.1; }
  .li-meta-line { font-size: 12px; color: #374151; margin-top: 3px; font-weight: 600; }
  .li-body { padding: 10px 20px 14px; }
  .li-info-grid { display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; background: #FDF6F7; border: 1px solid #F3C9CE; border-radius: 6px; padding: 7px 12px; }
  .li-info-row { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; font-size: 12px; }
  .li-info-label { color: #6B7280; font-weight: 500; }
  .li-info-value { font-weight: 700; text-align: right; }
  .li-section-title { color: #E01E31; border-left: 3px solid #E01E31; padding: 1px 0 1px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 4px; }
  .li-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .li-table th { text-align: left; padding: 3px 6px; color: #B71C1C; font-weight: 700; border-bottom: 1.5px solid #E01E31; }
  .li-table th.right, .li-table td.right { text-align: right; }
  .li-table th.center, .li-table td.center { text-align: center; }
  .li-table td { padding: 4px 6px; border-bottom: 1px solid #F7E5E7; }
  .li-table tr:last-child td { border-bottom: none; }
  .li-total-row td { border-top: 1.5px solid #E01E31; border-bottom: none; font-weight: 800; color: #B71C1C; padding-top: 6px; }
  .li-net { display: flex; align-items: center; justify-content: space-between; border: 1.5px solid #E01E31; border-radius: 6px; padding: 9px 16px; margin-top: 10px; }
  .li-net .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #B71C1C; }
  .li-net .amount { font-size: 24px; font-weight: 800; color: #E01E31; }
  .li-footer { display: flex; justify-content: space-between; align-items: flex-end; padding: 8px 20px 12px; }
  .li-sig { width: 150px; text-align: center; font-size: 11px; color: #1F2937; font-weight: 600; }
  .li-sig-img { display: block; height: 30px; max-width: 140px; margin: 0 auto; object-fit: contain; mix-blend-mode: multiply; }
  .li-sig-line { border-top: 1px solid #1F2937; padding-top: 4px; }
  .li-fill-line { border-bottom: 1px solid #1F2937; padding-bottom: 2px; margin-bottom: 4px; font-weight: 700; color: #111; }
`

function makeRow(): InvoiceRow {
  return { id: crypto.randomUUID(), date: '', billNumber: '', amount: 0 }
}

export default function LegacyInvoicePage() {
  const [shopName, setShopName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<InvoiceRow[]>([makeRow()])
  const [saved, setSaved] = useState<LegacyInvoice | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LegacyInvoice | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [signatures, setSignatures] = useState<Record<string, string>>({})
  const [printDialogOpen, setPrintDialogOpen] = useState(false)

  const updateRow = (id: string, field: keyof InvoiceRow, value: string | number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const addRow = () => setRows(prev => [...prev, makeRow()])
  const grid = useDataGrid({ columns: 3, rows: rows.length, onAppendRow: addRow })
  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const verticalRows = useMemo(() => rows.filter(r => r.billNumber.trim() || r.amount > 0), [rows])
  const grandTotal = useMemo(() => verticalRows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [verticalRows])

  const saveInvoice = useCreateLegacyInvoice()
  const deleteInvoice = useDeleteLegacyInvoice()

  const canSave = shopName.trim().length > 0 && verticalRows.length > 0 && grandTotal > 0 && !saveInvoice.isPending

  const handleSave = () => {
    if (!canSave) return
    saveInvoice.mutate(
      {
        shop_name: shopName.trim(),
        description: description.trim() || undefined,
        entries: verticalRows.map(r => ({
          date: r.date || undefined,
          bill_number: r.billNumber.trim() || undefined,
          amount: Number(r.amount) || 0,
        })),
      },
      {
onSuccess: invoice => {
          setSaved(invoice)
          setShopName('')
          setDescription('')
          setRows([makeRow()])
          setSignatures({})
        },
      },
    )
  }

  const handleNew = () => {
    setSaved(null)
    setShopName('')
    setDescription('')
    setRows([makeRow()])
    setSignatures({})
  }

  const handleLoad = (invoice: LegacyInvoice) => {
    setSaved(invoice)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteInvoice.mutate(deleteTarget.id, {
      onSuccess: () => {
        if (saved?.id === deleteTarget.id) setSaved(null)
        setDeleteTarget(null)
      },
    })
  }

  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${saved?.shop_name || shopName || 'Invoice'}`,
  })

  const requestPrint = () => setPrintDialogOpen(true)

  const handlePrintConfirm = (sig: Record<string, string>) => {
    setSignatures(sig)
    setPrintDialogOpen(false)
    setTimeout(() => handlePrint(), 180)
  }

  const sigSlots = [
    { id: 'laundry', label: 'Laundry Sign', value: signatures.laundry },
  ]

  const nowStr = todayISO().replace(/-/g, '')
  const previewNumber = saved?.invoice_number ?? `INV-${nowStr}-LEGACY`

  const printEntries = saved?.entries ?? verticalRows.map(r => ({ date: r.date, bill_number: r.billNumber, amount: r.amount }))
  const printTotal = saved?.grand_total ?? grandTotal

  const { data: listData, isLoading: listLoading, isError: listError, error: listErr } = useLegacyInvoices({
    search: searchInput.trim() || undefined,
    limit: 50,
  })

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="print:hidden">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Shop Bills', href: '/shop-bills' }, { label: 'Legacy Invoice' }]} />
        <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-full border-2 border-[#DC2626] bg-white p-1 flex items-center justify-center">
              <img src="/icon.png" alt="Love Laundry" className="h-full w-full rounded-full object-contain" />
            </div>
            <div>
              <h1 className="text-[17px] font-extrabold uppercase tracking-[2px] text-[#101828] leading-tight">Love Laundry</h1>
              <p className="text-[11px] font-semibold text-[#6B7280]">and dry cleaning experts</p>
              <p className="mt-0.5 text-[12px] text-[#98A2B3]">Legacy Invoice — aggregate old paper bills, save, then print.</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={requestPrint} disabled={!shopName.trim() && !saved} className="gap-2 cursor-pointer">
                <Printer size={16} /> Print
              </Button>
              <Button onClick={handleSave} disabled={!canSave} className="gap-2 cursor-pointer">
                <Save size={16} /> {saveInvoice.isPending ? 'Saving…' : 'Save Invoice'}
              </Button>
            </div>
            <SyncStatusBar queryKey={['legacy-invoices']} label="Invoices" />
          </div>
        </div>
      </div>

      {/* Saved confirmation banner */}
      {saved && (
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#16A34A]/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-[#16A34A]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#15803D]">Invoice {saved.invoice_number} saved</p>
              <p className="text-[11px] text-[#16A34A]/80">
                {saved.shop_name} · {saved.total_entries} entr{saved.total_entries === 1 ? 'y' : 'ies'} · {fmtMoney(saved.grand_total)} · {formatDateOnly(saved.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={requestPrint} className="gap-1.5 cursor-pointer">
              <Printer size={14} /> Print {saved.invoice_number}
            </Button>
            <Button size="sm" variant="outline" onClick={handleNew} className="gap-1.5 cursor-pointer">
              <RotateCcw size={14} /> New Invoice
            </Button>
          </div>
        </div>
      )}

      {/* Editable Form */}
      <div className="space-y-4 print:hidden">
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Shop / Hotel Name *</label>
              <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Enter shop or hotel name" className={inputClass} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Description (optional)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Laundry services for July 2026" className={inputClass} />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[13px] font-semibold text-[#101828]">Bill Entries</h3>
              <p className="text-[11px] text-[#98A2B3] mt-0.5">Old bill date, number and amount — press Enter to go to the next field, Enter on the last row adds one.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5 cursor-pointer">
              <Plus size={14} /> Add Row
            </Button>
          </div>

          <div className="overflow-x-auto" onKeyDown={grid.handleKeyDown}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E4E7EC]">
                  <th className="py-2 pr-3 text-left font-semibold text-[#6B7280] w-[40px]">#</th>
                  <th className="py-2 pr-3 text-left font-semibold text-[#6B7280]">Date</th>
                  <th className="py-2 pr-3 text-left font-semibold text-[#6B7280]">Bill Number</th>
                  <th className="py-2 pr-3 text-right font-semibold text-[#6B7280]">Amount (LKR)</th>
                  <th className="py-2 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-[#F2F4F7] hover:bg-[#F9FAFB]/60">
                    <td className="py-2 pr-3 text-[#98A2B3]">{idx + 1}</td>
                    <td className="py-2 pr-3">
                      <input type="date" value={row.date} onChange={e => updateRow(row.id, 'date', e.target.value)} className={cellInputClass} ref={grid.registerCell(idx, 0)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="text" value={row.billNumber} onChange={e => updateRow(row.id, 'billNumber', e.target.value)} placeholder="e.g. BL-001" className={cellInputClass} ref={grid.registerCell(idx, 1)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" min="0" step="0.01" value={row.amount || ''} onChange={e => updateRow(row.id, 'amount', parseFloat(e.target.value) || 0)} placeholder="0.00" className={`${cellInputClass} text-right`} ref={grid.registerCell(idx, 2)} />
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeRow(row.id)} disabled={rows.length <= 1 || Boolean(saved)} className="p-1.5 text-[#98A2B3] hover:text-[#DC2626] disabled:opacity-30 cursor-pointer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#101828]">
                  <td colSpan={3} className="py-3 pr-3 text-right font-bold text-[#101828]">Grand Total</td>
                  <td className="py-3 pr-3 text-right font-bold text-[#101828]">{fmtMoney(grandTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      {/* Saved Invoices */}
      <div className="space-y-3 print:hidden">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[#101828]">Saved Invoices</h2>
            <p className="text-[11px] text-[#98A2B3]">Every legacy invoice you create is stored and can be reprinted anytime.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by shop / hotel…"
              className="h-10 w-full rounded-lg border border-[#E4E7EC] bg-white pl-9 pr-3 text-[13px] text-[#101828] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 shadow-sm"
            />
          </div>
        </div>

        {listLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : listError ? (
          <ErrorState
            title="Unable to load saved invoices"
            description={listErr instanceof Error ? listErr.message : 'Failed to fetch saved invoices.'}
          />
        ) : !listData || listData.items.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No saved invoices"
            description={searchInput.trim() ? 'Nothing matches that shop / hotel name.' : 'Invoices you save will appear here.'}
          />
        ) : (
          <div className="rounded-xl border border-[#E4E7EC] bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E4E7EC] bg-[#F9FAFB]">
                  <th className="py-2.5 px-4 text-left font-semibold text-[#6B7280]">Invoice No.</th>
                  <th className="py-2.5 px-4 text-left font-semibold text-[#6B7280]">Shop / Hotel</th>
                  <th className="py-2.5 px-4 text-center font-semibold text-[#6B7280]">Entries</th>
                  <th className="py-2.5 px-4 text-right font-semibold text-[#6B7280]">Grand Total</th>
                  <th className="py-2.5 px-4 text-left font-semibold text-[#6B7280]">Created</th>
                  <th className="py-2.5 px-4 w-[120px]"></th>
                </tr>
              </thead>
              <tbody>
                {listData.items.map((inv: LegacyInvoice) => (
                  <tr key={inv.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-[#F9FAFB]/60">
                    <td className="py-2.5 px-4 font-semibold text-[#2563EB] whitespace-nowrap">{inv.invoice_number}</td>
                    <td className="py-2.5 px-4 text-[#101828] font-medium">{inv.shop_name}</td>
                    <td className="py-2.5 px-4 text-center text-[#6B7280]">{inv.total_entries}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-[#101828]">{fmtMoney(inv.grand_total)}</td>
                    <td className="py-2.5 px-4 text-[#98A2B3] whitespace-nowrap">{formatDateOnly(inv.created_at)}</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleLoad(inv)} className="gap-1.5 cursor-pointer">
                          <Printer size={14} /> View / Print
                        </Button>
                        <button onClick={() => setDeleteTarget(inv)} className="p-2 text-[#98A2B3] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg cursor-pointer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {listData.total > listData.items.length && (
              <p className="px-4 py-2.5 text-[11px] text-[#98A2B3] border-t border-[#F2F4F7]">
                Showing {listData.items.length} of {listData.total} — refine the search to narrow down.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Printable Invoice */}
      <div ref={printRef} className="hidden print:block">
        <style dangerouslySetInnerHTML={{ __html: legacyPrintStyles }} />
        <div className="li-print-sheet">
          <div className="li-slip">
            {/* Header */}
            <div className="li-header">
              <div className="li-brand">
                <img src="/icon.png" alt="Love Laundry" className="li-logo" />
                <div>
                  <div className="li-brand-name">{COMPANY.name}</div>
                  <div className="li-brand-tagline">{COMPANY.tagline}</div>
                  <div className="li-brand-contact">
                    {COMPANY.address.line1}, {COMPANY.address.line2}<br />
                    Tel: {COMPANY.phone.primary} | {COMPANY.phone.secondary}
                  </div>
                </div>
              </div>
              <div className="li-meta">
                <div className="li-title">Invoice</div>
                <div className="li-meta-line">{previewNumber}</div>
                <div className="li-meta-line">{formatDayMonthYear(todayISO())}</div>
              </div>
            </div>

            <div className="li-body">
              {/* Bill To / meta grid */}
              <div className="li-info-grid">
                <div className="li-info-row"><span className="li-info-label">Bill To</span><span className="li-info-value">{saved?.shop_name || shopName}</span></div>
                <div className="li-info-row"><span className="li-info-label">Invoice No</span><span className="li-info-value">{previewNumber}</span></div>
                <div className="li-info-row"><span className="li-info-label">Description</span><span className="li-info-value">{saved?.description || description || '—'}</span></div>
                <div className="li-info-row"><span className="li-info-label">Date</span><span className="li-info-value">{formatDayMonthYear(todayISO())}</span></div>
              </div>

              {/* Entries Table */}
              <div className="li-section-title">Bill Entries</div>
              <table className="li-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>No.</th>
                    <th>Bill Date</th>
                    <th>Bill Number</th>
                    <th className="right" style={{ width: 110 }}>Amount (LKR)</th>
                    <th className="center" style={{ width: 50 }}>CTs.</th>
                  </tr>
                </thead>
                <tbody>
                  {printEntries.map((entry, index) => {
                    const amt = Number(entry.amount) || 0
                    const whole = amt > 0 ? Math.floor(amt).toLocaleString('en-LK') : ''
                    const cts = amt > 0 ? Math.round((amt % 1) * 100).toString().padStart(2, '0') : ''
                    return (
                      <tr key={index}>
                        <td>{index + 1}.</td>
                        <td>{entry.date ? formatDateOnly(entry.date) : ''}</td>
                        <td>{entry.bill_number || ''}</td>
                        <td className="right">{whole}</td>
                        <td className="center">{cts}</td>
                      </tr>
                    )
                  })}
                  <tr className="li-total-row">
                    <td colSpan={3} className="right">Grand Total:</td>
                    <td className="right">{Math.floor(printTotal).toLocaleString('en-LK')}</td>
                    <td className="center">{Math.round((printTotal % 1) * 100).toString().padStart(2, '0')}</td>
                  </tr>
                </tbody>
              </table>

              <div className="li-net">
                <span className="label">Grand Total</span>
                <span className="amount">{fmtMoney(printTotal)}</span>
              </div>

              {/* Customer signature */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 34 }}>
                <div className="li-sig">
                  <div className="li-sig-line">Customer's Signature</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="li-footer">
              <div className="li-sig">
                {signatures.laundry && <img src={signatures.laundry} alt="Laundry sign" className="li-sig-img" />}
                <div className="li-sig-line">Laundry Sign</div>
              </div>
              <div className="li-sig"><div className="li-fill-line">{previewNumber}</div>Invoice Number</div>
              <div className="li-sig"><div className="li-fill-line">{formatDayMonthYear(todayISO())}</div>Date</div>
            </div>
          </div>
        </div>
      </div>

      <SignatureUploadDialog
        open={printDialogOpen}
        slots={sigSlots}
        onClose={() => setPrintDialogOpen(false)}
        onConfirm={handlePrintConfirm}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteInvoice.isPending}
        title="Delete Invoice"
        description={`Are you sure you want to delete ${deleteTarget?.invoice_number ?? 'this invoice'} for ${deleteTarget?.shop_name ?? ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}