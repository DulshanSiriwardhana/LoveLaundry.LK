import React from 'react'
import { type Bill } from '../../../types/bill'
import { formatDate } from '../../../lib/utils'
import { COMPANY } from '../../../config/company'

interface ConsolidatedInvoiceTemplateProps {
  bills: Bill[]
  dateFrom?: string
  dateTo?: string
}

const printStyles = `
  @page {
    size: A4 portrait;
    margin: 10mm 10mm 15mm 10mm;
  }

  @media print {
    html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .inv-root { margin: 0; padding: 0; width: auto; background: #fff; }

    /* ---- Table rules ---- */
    .inv-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
      line-height: 1.3;
    }

    /* Column widths (total ≈ 180mm usable) */
    .inv-table colgroup .col-no   { width: 13%; }
    .inv-table colgroup .col-cli  { width: 23%; }
    .inv-table colgroup .col-date { width: 15%; }
    .inv-table colgroup .col-amt  { width: 15%; }
    .inv-table colgroup .col-paid { width: 15%; }
    .inv-table colgroup .col-out  { width: 19%; }

    .inv-table th,
    .inv-table td {
      border: 1px solid #D1D5DB;
      padding: 5px 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;
    }

    .inv-table th {
      background: #DC2626;
      color: #fff;
      font-weight: 600;
      text-align: left;
      border-color: #DC2626;
    }
    .inv-table th.num { text-align: right; }
    .inv-table th.ctr { text-align: center; }

    .inv-table td { text-align: left; }
    .inv-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .inv-table td.ctr { text-align: center; }
    .inv-table td.bold { font-weight: 600; }
    .inv-table td.red  { color: #DC2626; font-weight: 600; }

    .inv-table tbody tr:nth-child(even) { background: #F9FAFB; }

    /* Page-break controls */
    .inv-table thead { display: table-header-group; }
    .inv-table tfoot { display: table-footer-group; }
    .inv-table tbody tr { page-break-inside: avoid; break-inside: avoid; }

    /* Keep outstanding box + notes together */
    .inv-footer-block { page-break-inside: avoid; break-inside: avoid; }
  }

  /* Screen fallback — same table-layout so WYSIWYG */
  .inv-table {
    table-layout: fixed;
  }
  .inv-table colgroup .col-no   { width: 13%; }
  .inv-table colgroup .col-cli  { width: 23%; }
  .inv-table colgroup .col-date { width: 15%; }
  .inv-table colgroup .col-amt  { width: 15%; }
  .inv-table colgroup .col-paid { width: 15%; }
  .inv-table colgroup .col-out  { width: 19%; }

  .inv-table th,
  .inv-table td {
    padding: 5px 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }
  .inv-table th { text-align: left; }
  .inv-table th.num { text-align: right; }
  .inv-table th.ctr { text-align: center; }
  .inv-table td { text-align: left; }
  .inv-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .inv-table td.ctr { text-align: center; }
  .inv-table tbody tr:nth-child(even) { background: #F9FAFB; }
`

export const ConsolidatedInvoiceTemplate = React.forwardRef<HTMLDivElement, ConsolidatedInvoiceTemplateProps>(
  ({ bills, dateFrom, dateTo }, ref) => {
    const unpaid = bills.filter(b => b.payment_status !== 'PAID' && b.payment_status !== 'CANCELLED')
    const totalOutstanding = unpaid.reduce(
      (sum, b) => sum + (b.outstanding_amount ?? (b.grand_total ?? b.total_amount)),
      0,
    )
    const totalBilled = unpaid.reduce((sum, b) => sum + (b.grand_total ?? b.total_amount), 0)
    const totalPaid = unpaid.reduce((s, b) => s + (b.paid_amount ?? 0), 0)
    const g = (n: number) => n.toFixed(2)

    return (
      <div ref={ref} className="inv-root" style={{ fontFamily: '"Spectral", Georgia, serif', color: '#000', background: '#fff' }}>
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />

        <div style={{ padding: '0 0 8px 0' }}>
          {/* ── Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px double #000', paddingBottom: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <img
                src="/icon.png"
                alt="Love Laundry"
                style={{ width: 72, height: 72, objectFit: 'contain', border: '2px solid #000', borderRadius: 0, padding: 3, background: '#fafafa' }}
              />
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, lineHeight: 1.2, margin: '0 0 3px 0' }}>
                {COMPANY.name}
              </h1>
              <h2 style={{ fontSize: 13, fontWeight: 500, fontStyle: 'italic', margin: 0, color: '#333' }}>
                {COMPANY.tagline}
              </h2>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', border: '1px solid #000', padding: '5px 10px', background: '#f9f9f9', borderRadius: 0, flexShrink: 0 }}>
              Reg. No: {COMPANY.registrationNo}
            </div>
          </div>

          {/* ── Services ── */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 10, fontWeight: 600, borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {['Dry Cleaning', 'Free Pickup & Delivery', 'Wash & Pressed', 'Wash & Fold', 'Laundered Pressed'].map(s => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
                {s}
              </span>
            ))}
          </div>

          {/* ── Contact ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0 }}>Tel: {COMPANY.phone.primary} / {COMPANY.phone.secondary}</p>
              <p style={{ margin: 0 }}>Email: {COMPANY.email}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0 }}>{COMPANY.address.line1}</p>
              <p style={{ margin: 0 }}>{COMPANY.address.line2}</p>
            </div>
          </div>

          {/* ── Title ── */}
          <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', margin: '0 0 12px 0' }}>
            CONSOLIDATED INVOICE
          </h3>

          {/* ── Invoice meta ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12 }}>
            <div>
              <span style={{ fontWeight: 700 }}>Invoice Period: </span>
              <span>{dateFrom || '—'} to {dateTo || '—'}</span>
            </div>
            <div>
              <span style={{ fontWeight: 700 }}>Generated: </span>
              <span>{formatDate(new Date().toISOString())}</span>
            </div>
          </div>

          {/* ── Bills table ── */}
          <table className="inv-table">
            <colgroup>
              <col className="col-no" />
              <col className="col-cli" />
              <col className="col-date" />
              <col className="col-amt" />
              <col className="col-paid" />
              <col className="col-out" />
            </colgroup>
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Client</th>
                <th>Date</th>
                <th className="num">Amount</th>
                <th className="num">Paid</th>
                <th className="num">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {unpaid.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', whiteSpace: 'normal' }}>
                    No unpaid bills in the selected period.
                  </td>
                </tr>
              )}
              {unpaid.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 500 }}>{b.id.slice(0, 10).toUpperCase()}</td>
                  <td>{b.client_name}</td>
                  <td>{formatDate(b.created_at)}</td>
                  <td className="num">{g(b.grand_total ?? b.total_amount)}</td>
                  <td className="num">{g(b.paid_amount ?? 0)}</td>
                  <td className="num bold">{g(b.outstanding_amount ?? (b.grand_total ?? b.total_amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, background: '#F3F4F6' }}>TOTALS</td>
                <td className="num bold" style={{ background: '#F3F4F6' }}>{g(totalBilled)}</td>
                <td className="num bold" style={{ background: '#F3F4F6' }}>{g(totalPaid)}</td>
                <td className="num red" style={{ background: '#F3F4F6' }}>{g(totalOutstanding)}</td>
              </tr>
            </tfoot>
          </table>

          {/* ── Outstanding notice + notes (kept together) ── */}
          <div className="inv-footer-block">
            {/* Outstanding notice */}
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid #DC2626', background: '#FFF1F1', padding: '10px 16px' }}>
              <div>
                <p style={{ fontWeight: 800, textTransform: 'uppercase', color: '#DC2626', fontSize: 12, margin: 0 }}>Total Outstanding</p>
                <p style={{ fontSize: 10, color: '#6B7280', margin: '3px 0 0 0' }}>
                  This amount is due across {unpaid.length} unpaid bill{unpaid.length === 1 ? '' : 's'} in the selected period.
                </p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#DC2626', margin: 0, whiteSpace: 'nowrap' }}>LKR {g(totalOutstanding)}</p>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 16, fontSize: 9, color: '#6B7280', lineHeight: 1.5, borderTop: '1px solid #D1D5DB', paddingTop: 10 }}>
              <p style={{ fontWeight: 700, color: '#000', margin: '0 0 3px 0', fontSize: 10 }}>Notes:</p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>Payments received after the generated date are not reflected on this invoice.</li>
                <li>Any complaints regarding the quality of cleaning should be made within 24 hours of delivery.</li>
                <li>Garments should be collected within 10 days from the date of delivery, after which the management will not be responsible for any loss or damage.</li>
              </ul>
            </div>

            {/* Signatures */}
            <div style={{ marginTop: 36, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontWeight: 700, fontSize: 11, textAlign: 'center' }}>
              <div style={{ width: 180, borderTop: '2px dotted #000', paddingTop: 4 }}>Authorized Signature</div>
              <div style={{ width: 180, borderTop: '2px dotted #000', paddingTop: 4 }}>Received Signature</div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

ConsolidatedInvoiceTemplate.displayName = 'ConsolidatedInvoiceTemplate'
