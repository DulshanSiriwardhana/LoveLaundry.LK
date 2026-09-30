import React from 'react'
import { type Quotation } from '../../../types/quotation'
import { COMPANY } from '../../../config/company'

interface QuotationPrintTemplateProps {
  quotation: Quotation
}

const ITEMS_PER_PAGE = 22

const printStyles = `
  @media print {
    .quotation-print-page {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: auto;
    }
    @page {
      size: A4;
      margin: 0;
    }
    @page :first { margin: 0; }
    @page :left { margin: 0; }
    @page :right { margin: 0; }
    .avoid-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table {
      page-break-inside: auto !important;
    }
    tr {
      page-break-inside: avoid !important;
      page-break-after: auto !important;
      break-inside: avoid !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    .no-print {
      display: none !important;
    }
    .page-sheet {
      page-break-after: always !important;
      break-after: page !important;
    }
    .page-sheet:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .page-border {
      position: fixed;
      top: 10mm;
      left: 10mm;
      right: 10mm;
      bottom: 10mm;
      border: 2px solid #000;
      pointer-events: none;
      z-index: 9999;
    }
  }
  .quotation-print-page {
    color: #000;
    background: #fff;
    font-family: "Spectral", Georgia, serif;
  }
  .page-sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 15mm;
    box-sizing: border-box;
    position: relative;
    background: #fff;
    margin: 0 auto 20px auto;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }
  .page-sheet:last-child {
    margin-bottom: 0;
  }
  .page-border {
    position: absolute;
    top: 10mm;
    left: 10mm;
    right: 10mm;
    bottom: 10mm;
    border: 2px solid #000;
    pointer-events: none;
  }
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px double #000;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .logo-section {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo-img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    border: 2px solid #000;
    border-radius: 0;
    padding: 4px;
    background: #fafafa;
  }
  .company-info {
    text-align: center;
    flex: 1;
  }
  .company-name {
    font-size: 24px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    line-height: 1.2;
    margin: 0 0 4px 0;
    font-family: "Spectral", Georgia, serif;
  }
  .company-tagline {
    font-size: 14px;
    font-weight: 500;
    font-style: italic;
    margin: 0;
    color: #333;
    font-family: "Spectral", Georgia, serif;
  }
  .reg-no {
    font-size: 12px;
    font-weight: 600;
    text-align: right;
    white-space: nowrap;
    border: 1px solid #000;
    padding: 6px 12px;
    background: #f9f9f9;
    border-radius: 0;
  }
  .services-row {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 11px;
    font-weight: 600;
    border-bottom: 2px solid #000;
    padding-bottom: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .service-item {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    padding: 4px 8px;
    background: #f5f5f5;
    border: 1px solid #000;
    border-radius: 0;
  }
  .service-dot {
    width: 8px;
    height: 8px;
    background: #000;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .contact-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 20px;
    padding: 10px 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
  }
  .contact-left, .contact-right {
    line-height: 1.7;
  }
  .contact-right {
    text-align: right;
  }
  .contact-left p, .contact-right p {
    margin: 2px 0;
  }
  .quotation-title {
    font-size: 18px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    text-align: center;
    border-bottom: 2px solid #000;
    padding-bottom: 10px;
    margin-bottom: 20px;
    font-family: "Spectral", Georgia, serif;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    font-size: 12px;
    margin-bottom: 20px;
  }
  .detail-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 10px;
  }
  .detail-label {
    font-weight: 700;
    white-space: nowrap;
    min-width: 80px;
    color: #000;
  }
  .detail-value {
    border-bottom: 2px solid #000;
    flex: 1;
    padding-bottom: 4px;
    min-height: 20px;
  }
  .details-right {
    text-align: right;
  }
  .details-right .detail-row {
    justify-content: flex-end;
  }
  .details-right .detail-label {
    min-width: 100px;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 11px;
    page-break-inside: auto;
    border: 2px solid #000;
  }
  .items-table th,
  .items-table td {
    border: 1px solid #000;
    padding: 10px 8px;
    vertical-align: top;
  }
  .items-table th {
    background: #000;
    color: #fff;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 10px;
    font-family: "Spectral", Georgia, serif;
    border: 1px solid #000;
  }
  .items-table .col-no { width: 45px; text-align: center; }
  .items-table .col-item { width: auto; min-width: 200px; }
  .items-table .col-category { width: 120px; }
  .items-table .col-price { width: 100px; text-align: right; }
  .items-table tbody tr:nth-child(even) td {
    background: #f5f5f5;
  }
  .items-table tbody tr:hover td {
    background: #e8e8e8;
  }
  .total-items-row {
    text-align: right;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 30px;
    padding: 12px 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    background: #f0f0f0;
    font-family: "Spectral", Georgia, serif;
  }
  .signatures {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 2px solid #000;
  }
  .sig-block {
    width: 160px;
    text-align: center;
    font-size: 11px;
  }
  .sig-line {
    border-top: 2px dotted #000;
    padding-top: 10px;
    margin-bottom: 8px;
    min-height: 50px;
  }
  .sig-label {
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #000;
  }
  .sig-center {
    flex: 1;
    text-align: center;
    padding: 0 20px;
  }
  .empty-state {
    text-align: center;
    color: #999;
    padding: 60px 20px;
    border: 2px dashed #000;
    font-style: italic;
    border-radius: 0;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #000;
    font-size: 10px;
    color: #666;
  }
  .page-header-title {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #000;
  }
  .page-indicator {
    font-family: "Spectral", Georgia, serif;
  }
  .continue-notice {
    text-align: center;
    font-size: 10px;
    color: #999;
    font-style: italic;
    padding: 8px;
    border-top: 1px dashed #000;
    margin-top: -10px;
    margin-bottom: 10px;
  }
  .no-print {
    display: block;
  }
  @media screen {
    .no-print {
      display: block;
    }
  }
`

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export const QuotationPrintTemplate = React.forwardRef<HTMLDivElement, QuotationPrintTemplateProps>(
  ({ quotation }, ref) => {
    const items = quotation.line_items ?? []
    const totalItems = items.length
    const itemPages = chunkArray(items, ITEMS_PER_PAGE)
    const totalPages = itemPages.length

    return (
      <div
        ref={ref}
        className="quotation-print-page"
        style={{
          fontFamily: '"Spectral", Georgia, serif',
          color: '#000',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: printStyles }} />

        {itemPages.map((pageItems, pageIndex) => {
          const isFirstPage = pageIndex === 0
          const isLastPage = pageIndex === totalPages - 1
          const startNum = pageIndex * ITEMS_PER_PAGE

          return (
            <div key={pageIndex} className="page-sheet avoid-break">
              {/* Page Border - one per A4 sheet */}
              <div className="page-border" aria-hidden="true" />

              {/* Page Header (on continuation pages) */}
              {!isFirstPage && (
                <div className="page-header no-print" style={{ display: 'block' }}>
                  <span className="page-header-title">{COMPANY.name} - QUOTATION</span>
                  <span className="page-indicator">Page {pageIndex + 1} of {totalPages}</span>
                </div>
              )}

              {/* Full Header only on first page */}
              {isFirstPage && (
                <>
                  {/* Header Section */}
                  <div className="header-row">
                    <div className="logo-section">
                      <img
                        src="/icon.png"
                        alt="Love Laundry Logo"
                        className="logo-img"
                      />
                    </div>
                    <div className="company-info">
                      <h1 className="company-name">{COMPANY.name}</h1>
                      <h2 className="company-tagline">{COMPANY.tagline}</h2>
                    </div>
                    <div className="reg-no">
                      Reg. No: {COMPANY.registrationNo}
                    </div>
                  </div>

                  {/* Services List */}
                  <div className="services-row">
                    <span className="service-item"><span className="service-dot" /> Dry Cleaning</span>
                    <span className="service-item"><span className="service-dot" /> Free Pickup & Delivery</span>
                    <span className="service-item"><span className="service-dot" /> Wash & Pressed</span>
                    <span className="service-item"><span className="service-dot" /> Wash & Fold</span>
                    <span className="service-item"><span className="service-dot" /> Laundered Pressed</span>
                  </div>

                  {/* Contact Info */}
                  <div className="contact-row">
                    <div className="contact-left">
                      <p>Tel: {COMPANY.phone.primary} / {COMPANY.phone.secondary}</p>
                      <p>Email: {COMPANY.email}</p>
                    </div>
                    <div className="contact-right">
                      <p>{COMPANY.address.line1}</p>
                      <p>{COMPANY.address.line2}</p>
                    </div>
                  </div>

                  {/* Quotation Title & Customer Details */}
                  <div>
                    <h3 className="quotation-title">QUOTATION</h3>
                    <div className="details-grid">
                      <div>
                        <div className="detail-row">
                          <span className="detail-label">Client:</span>
                          <span className="detail-value">{quotation.client_name}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Title:</span>
                          <span className="detail-value">{quotation.quotation_title || 'General Price List'}</span>
                        </div>
                      </div>
                      <div className="details-right">
                        <div className="detail-row">
                          <span className="detail-label">Date:</span>
                          <span className="detail-value">{quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : ''}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Quotation #:</span>
                          <span className="detail-value">{quotation.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Items Table */}
              <table className="items-table">
                <thead>
                  <tr>
                    <th className="col-no">No.</th>
                    <th className="col-item">Description of Item</th>
                    <th className="col-category">Category</th>
                    <th className="col-price">Unit Price (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length > 0 ? (
                    pageItems.map((item: typeof pageItems[0], index: number) => (
                      <tr key={item.id ?? index} className="avoid-break" style={{ background: (startNum + index) % 2 === 0 ? '#f5f5f5' : 'transparent' }}>
                        <td className="col-no">{startNum + index + 1}.</td>
                        <td className="col-item">
                          <div>{item.item_name}</div>
                          {item.specifications && item.specifications.length > 0 && (
                            <div style={{ marginTop: 2, fontSize: '10px' }}>
                              {item.specifications.map((s, i) => (
                                <div key={i} style={{ lineHeight: 1.3 }}>
                                  <span style={{ color: '#DC2626' }}>• </span>
                                  {s.specification} — LKR {s.unit_price.toFixed(2)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="col-category">{item.category || 'General'}</td>
                        <td className="col-price">{item.unit_price.toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-state">No items in this quotation</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Continue notice on non-last pages */}
              {!isLastPage && (
                <div className="continue-notice">
                  Continued on next page...
                </div>
              )}

              {/* Totals and Signatures only on last page */}
              {isLastPage && (
                <>
                  {/* Total Items Only */}
                  <div className="total-items-row">
                    Total Items: {totalItems}
                  </div>

                  {/* Signature Block */}
                  <div className="signatures">
                    <div className="sig-block">
                      <div className="sig-line" />
                      <div className="sig-label">Prepared By</div>
                    </div>
                    <div className="sig-block sig-center">
                      <p style={{ fontWeight: 700, margin: '0 0 4px 0', fontSize: '13px' }}>{COMPANY.name}</p>
                      <p style={{ fontSize: '10px', margin: 0 }}>{COMPANY.address.line1}</p>
                      <p style={{ fontSize: '10px', margin: 0 }}>{COMPANY.address.line2}</p>
                      <p style={{ fontSize: '10px', margin: '6px 0 0 0' }}>Tel: {COMPANY.phone.primary}</p>
                    </div>
                    <div className="sig-block">
                      <div className="sig-line" />
                      <div className="sig-label">Authorized Signature</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }
)

QuotationPrintTemplate.displayName = 'QuotationPrintTemplate'