import React from 'react'
import { type Bill } from '../../../types/bill'

interface BillPrintTemplateProps {
  bill: Bill
  contactNo?: string
  address?: string
  receivedDate?: string
  deliveryDate?: string
  gatePass?: string
}

const billPrintStyles = `
  @media print {
    .bill-print-page { margin: 0; padding: 0; width: 100%; min-height: auto; }
    .bill-print-page * { display: inherit !important; }
    @page { size: A4; margin: 0; }
    @page :first { margin: 0; }
    .no-print { display: none !important; }
  }
  @page { size: A4; margin: 0; }
  @page :first { margin: 0; }

  .bill-print-page {
    font-family: "Spectral", Georgia, serif;
    color: #000;
    background: #fff;
  }
  .bp-sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.4;
  }
  .bp-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .bp-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    border: 2px solid #DC2626;
    border-radius: 50%;
    padding: 4px;
  }
  .bp-company-center {
    text-align: center;
    flex: 1;
  }
  .bp-company-name {
    font-size: 28px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 3px;
    line-height: 1.2;
    margin: 0;
    font-family: "Spectral", Georgia, serif;
  }
  .bp-company-tagline {
    font-size: 16px;
    font-weight: 600;
    margin: 2px 0 0 0;
    font-family: "Spectral", Georgia, serif;
  }
  .bp-services {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 11px;
    font-weight: 700;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .bp-service-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #000;
    display: inline-block;
    margin-right: 4px;
  }
  .bp-contact {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .bp-customer-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .bp-customer-left {
    width: 55%;
  }
  .bp-detail-line {
    display: flex;
    margin-bottom: 3px;
  }
  .bp-detail-label {
    width: 90px;
    flex-shrink: 0;
  }
  .bp-detail-value {
    flex: 1;
    border-bottom: 1px dotted #000;
    padding-left: 4px;
  }
  .bp-dates-box {
    width: 40%;
    display: flex;
    justify-content: flex-end;
  }
  .bp-dates-table {
    width: 200px;
    border-collapse: collapse;
    border: 2px solid #000;
    font-size: 12px;
  }
  .bp-dates-table td {
    border: 2px solid #000;
    padding: 3px 6px;
  }
  .bp-items-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .bp-items-table th,
  .bp-items-table td {
    border: 2px solid #000;
    padding: 4px 6px;
  }
  .bp-items-table th {
    font-weight: 700;
    text-align: left;
  }
  .bp-items-table td {
    height: 22px;
  }
  .bp-status-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    margin-top: 4px;
    margin-bottom: 8px;
  }
  .bp-red { color: #DC2626; }
  .bp-conditions {
    font-size: 10px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 20px;
  }
  .bp-conditions p { margin: 0 0 3px 0; }
  .bp-conditions ul {
    margin: 0;
    padding-left: 16px;
  }
  .bp-conditions li { margin-bottom: 1px; }
  .bp-signatures {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 30px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .bp-sig-box {
    width: 150px;
  }
  .bp-sig-line {
    border-top: 2px dotted #000;
    padding-top: 4px;
  }
  .bp-id-line {
    border-bottom: 2px dotted #000;
    padding-bottom: 2px;
    margin-bottom: 4px;
    padding-left: 10px;
    padding-right: 10px;
  }
`

export const BillPrintTemplate = React.forwardRef<HTMLDivElement, BillPrintTemplateProps>(
  ({ bill, contactNo, address, receivedDate, deliveryDate, gatePass }, ref) => {
    const paddedItems = [...(bill.items ?? [])]
    while (paddedItems.length < 15) {
      paddedItems.push({ item_name: '', quantity: 0, unit_price: 0, line_total: 0 })
    }
    const displayItems = paddedItems.slice(0, 15)

    return (
      <div ref={ref} className="bill-print-page">
        <style dangerouslySetInnerHTML={{ __html: billPrintStyles }} />

        <div className="bp-sheet">
          {/* Header */}
          <div className="bp-header">
            <div>
              <img src="/icon.png" alt="Love Laundry" className="bp-logo" />
            </div>
            <div className="bp-company-center">
              <h1 className="bp-company-name">Love Laundry</h1>
              <h2 className="bp-company-tagline">and dry cleaning experts</h2>
            </div>
          </div>

          {/* Services */}
          <div className="bp-services">
            {['Dry Cleaning', 'Free Pickup & Delivery', 'Wash & Pressed', 'Wash & Fold', 'Laundered Pressed'].map(s => (
              <span key={s}><span className="bp-service-dot" />{s}</span>
            ))}
          </div>

          {/* Contact */}
          <div className="bp-contact">
            <div>
              <p style={{ margin: 0 }}>Tel: +94 77 4200 919 / 070 243 3566</p>
              <p style={{ margin: 0 }}>Email: lovelaundry01@gmail.com</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0 }}>Kuda bingiriya, Panirendawa.</p>
            </div>
          </div>

          {/* Customer Details & Dates */}
          <div className="bp-customer-row">
            <div className="bp-customer-left">
              <div className="bp-detail-line">
                <span className="bp-detail-label">Name:</span>
                <span className="bp-detail-value">{bill.client_name}</span>
              </div>
              <div className="bp-detail-line">
                <span className="bp-detail-label">Address:</span>
                <span className="bp-detail-value">{address || ''}</span>
              </div>
              <div className="bp-detail-line">
                <span className="bp-detail-label">Contact No:</span>
                <span className="bp-detail-value">{contactNo || ''}</span>
              </div>
            </div>
            <div className="bp-dates-box">
              <table className="bp-dates-table">
                <tbody>
                  <tr>
                    <td>Received</td>
                    <td style={{ textAlign: 'center' }}>{receivedDate || ''}</td>
                  </tr>
                  <tr>
                    <td>Delivery</td>
                    <td style={{ textAlign: 'center' }}>{deliveryDate || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <table className="bp-items-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>No.</th>
                <th>Description of Item</th>
                <th style={{ width: 60, textAlign: 'center' }}>QTY</th>
                <th style={{ width: 80, textAlign: 'right' }}>Rate</th>
                <th style={{ width: 90, textAlign: 'right' }}>Amount</th>
                <th style={{ width: 50, textAlign: 'center' }}>CTs.</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, index) => {
                const amountWhole = item.line_total > 0 ? Math.floor(item.line_total) : ''
                const amountCts = item.line_total > 0 ? Math.round((item.line_total % 1) * 100).toString().padStart(2, '0') : ''
                return (
                  <tr key={index}>
                    <td style={{ textAlign: 'center' }}>{index + 1}.</td>
                    <td>{item.item_name}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity || ''}</td>
                    <td style={{ textAlign: 'right' }}>{item.unit_price > 0 ? item.unit_price.toFixed(2) : ''}</td>
                    <td style={{ textAlign: 'right' }}>{amountWhole}</td>
                    <td style={{ textAlign: 'center' }}>{amountCts}</td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={2} style={{ textAlign: 'right' }}>Total:</td>
                <td style={{ textAlign: 'center' }}>{bill.total_quantity || ''}</td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{Math.floor(bill.grand_total ?? bill.total_amount)}</td>
                <td style={{ textAlign: 'center' }}>{Math.round(((bill.grand_total ?? bill.total_amount) % 1) * 100).toString().padStart(2, '0')}</td>
              </tr>
            </tbody>
          </table>

          {/* Status */}
          <div className="bp-status-row">
            <span>STATUS: {bill.payment_status || '—'}</span>
            <span>PAID: LKR {(bill.paid_amount ?? 0).toFixed(2)}</span>
            <span className={((bill.outstanding_amount ?? 0) > 0) ? 'bp-red' : ''}>
              BALANCE: LKR {(bill.outstanding_amount ?? 0).toFixed(2)}
            </span>
          </div>

          {/* Conditions */}
          <div className="bp-conditions">
            <p>CONDITIONS:</p>
            <ul>
              <li>Garments will only be returned on production of the bill, in case of loss of the bill National card of the customer should be produced.</li>
              <li>Garments should be collected within 10 days from the date of delivery, after which the management will not be responsible for any loss or damage.</li>
              <li>The management is not responsible for any shrinkage or color fading of garments after cleaning.</li>
              <li>Any complaints regarding the quality of cleaning should be made within 24 hours of delivery.</li>
              <li>The management reserves the right to change the terms and conditions without prior notice.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="bp-signatures">
            <div className="bp-sig-box">
              <div className="bp-sig-line">Cashier Signature</div>
            </div>
            <div className="bp-sig-box">
              <div className="bp-id-line">{bill.id.slice(0, 10).toUpperCase()}</div>
              <div>Bill Number</div>
            </div>
            <div className="bp-sig-box">
              <div className="bp-id-line">{gatePass || 'N/A'}</div>
              <div>Gate Pass</div>
            </div>
            <div className="bp-sig-box">
              <div className="bp-sig-line">Customer Signature</div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

BillPrintTemplate.displayName = 'BillPrintTemplate'
