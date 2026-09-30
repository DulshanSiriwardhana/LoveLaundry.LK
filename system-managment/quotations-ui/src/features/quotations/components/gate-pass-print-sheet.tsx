import React from 'react'
import type { GatePass } from '../../../types/operations'
import { GATE_PASS_STATUSES } from './operations-status'

const gatePassPrintStyles = `
  @media print {
    .gps-page { margin: 0; padding: 0; width: 100%; min-height: auto; }
    @page { size: A4; margin: 0; }
    @page :first { margin: 0; }
    .no-print { display: none !important; }
  }
  @page { size: A4; margin: 0; }
  @page :first { margin: 0; }
  .gps-page {
    font-family: "Spectral", Georgia, serif;
    color: #000;
    background: #fff;
  }
  .gps-sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.4;
  }
  .gps-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .gps-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    border: 2px solid #DC2626;
    border-radius: 50%;
    padding: 4px;
  }
  .gps-company-center { text-align: center; flex: 1; }
  .gps-company-name {
    font-size: 28px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 3px;
    line-height: 1.2;
    margin: 0;
  }
  .gps-company-tagline {
    font-size: 16px;
    font-weight: 600;
    margin: 2px 0 0 0;
  }
  .gps-services {
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
  .gps-service-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #000;
    display: inline-block;
    margin-right: 4px;
  }
  .gps-contact {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .gps-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border: 2px solid #000;
    padding: 8px 10px;
    margin-bottom: 10px;
  }
  .gps-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0;
  }
  .gps-title-meta {
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  .gps-details {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .gps-detail-left { width: 58%; }
  .gps-detail-right { width: 40%; text-align: right; }
  .gps-detail-line { display: flex; margin-bottom: 3px; }
  .gps-detail-label { width: 110px; flex-shrink: 0; }
  .gps-detail-value {
    flex: 1;
    border-bottom: 1px dotted #000;
    padding-left: 4px;
    font-weight: 600;
  }
  .gps-items-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .gps-items-table th,
  .gps-items-table td {
    border: 1px solid #000;
    padding: 4px 6px;
  }
  .gps-items-table th {
    text-align: left;
    background: #f5f5f5;
  }
  .gps-items-table td {
    height: 22px;
  }
  .gps-col-no { width: 24px; text-align: center; }
  .gps-col-item { width: auto; }
  .gps-col-spec { width: 30%; }
  .gps-col-qty { width: 64px; text-align: center; }
  .gps-totals {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .gps-mismatch {
    font-size: 11px;
    font-weight: 700;
    color: #DC2626;
    margin-bottom: 10px;
  }
  .gps-signatures {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 40px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .gps-sig-box { width: 150px; }
  .gps-sig-line {
    border-top: 2px dotted #000;
    padding-top: 4px;
  }
`

export const GatePassPrintSheet = React.forwardRef<HTMLDivElement, { gp: GatePass }>(
    ({ gp }, ref) => {
        const items = gp.items ?? []
        const totalPieces = items.reduce((sum, item) => sum + (item.received_qty || 0), 0)
        const mismatchedItems = items.filter(item => item.difference !== 0)
        const rewashedItems = items.filter(item => item.rewashed)
        const status = GATE_PASS_STATUSES[gp.status]?.label ?? gp.status

        return (
            <div ref={ref} className="gps-page">
                <style dangerouslySetInnerHTML={{ __html: gatePassPrintStyles }} />
                <div className="gps-sheet">
                    <div className="gps-header">
                        <div>
                            <img src="/icon.png" alt="Love Laundry" className="gps-logo" />
                        </div>
                        <div className="gps-company-center">
                            <h1 className="gps-company-name">Love Laundry</h1>
                            <h2 className="gps-company-tagline">and dry cleaning experts</h2>
                        </div>
                    </div>

                    <div className="gps-services">
                        {['Dry Cleaning', 'Free Pickup & Delivery', 'Wash & Pressed', 'Wash & Fold', 'Laundered Pressed'].map(s => (
                            <span key={s}><span className="gps-service-dot" />{s}</span>
                        ))}
                    </div>

                    <div className="gps-contact">
                        <div>
                            <p style={{ margin: 0 }}>Tel: +94 77 4200 919 / 070 243 3566</p>
                            <p style={{ margin: 0 }}>Email: lovelaundry01@gmail.com</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0 }}>Hotel Housekeeping Outerwear / Linen</p>
                            <p style={{ margin: 0 }}>Machine Washable Textiles</p>
                        </div>
                    </div>

                    <div className="gps-title-row">
                        <p className="gps-title">Gate Pass</p>
                        <div className="gps-title-meta">
                            <div>No: {gp.gate_pass_number}</div>
                            <div>Status: {status}</div>
                        </div>
                    </div>

                    <div className="gps-details">
                        <div className="gps-detail-left">
                            <div className="gps-detail-line">
                                <span className="gps-detail-label">Client / Hotel:</span>
                                <span className="gps-detail-value">{gp.client_name || ''}</span>
                            </div>
                            <div className="gps-detail-line">
                                <span className="gps-detail-label">Received By:</span>
                                <span className="gps-detail-value">{gp.received_by || ''}</span>
                            </div>
                        </div>
                        <div className="gps-detail-right">
                            <div className="gps-detail-line">
                                <span className="gps-detail-label">Date Received:</span>
                                <span className="gps-detail-value">{gp.receiving_date ? new Date(gp.receiving_date).toLocaleDateString() : ''}</span>
                            </div>
                            <div className="gps-detail-line">
                                <span className="gps-detail-label">Item Types:</span>
                                <span className="gps-detail-value">{items.length}</span>
                            </div>
                        </div>
                    </div>

                    <table className="gps-items-table">
                        <thead>
                            <tr>
                                <th className="gps-col-no">No.</th>
                                <th>Item</th>
                                <th className="gps-col-spec">Specification</th>
                                <th className="gps-col-qty">Client Qty</th>
                                <th className="gps-col-qty">Received</th>
                                <th className="gps-col-qty">Diff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={`${item.item_name}-${index}`}>
                                    <td className="gps-col-no">{index + 1}</td>
                                    <td>{item.item_name}{item.rewashed ? ' (REWASHED — not billed)' : ''}</td>
                                    <td className="gps-col-spec">{item.specification || ''}</td>
                                    <td className="gps-col-qty">{item.client_qty ?? ''}</td>
                                    <td className="gps-col-qty">{item.received_qty ?? ''}</td>
                                    <td className="gps-col-qty">{item.difference !== 0 ? item.difference : ''}</td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={6}>No items</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="gps-totals">
                        <span>Total Items: {items.length} type{items.length !== 1 ? 's' : ''}</span>
                        <span>Total Pieces: {totalPieces}</span>
                    </div>

                    {mismatchedItems.length > 0 && (
                        <div className="gps-mismatch">
                            Note: Quantity differences detected on {mismatchedItems.length} item
                            {mismatchedItems.length !== 1 ? 's' : ''}. Verified before processing.
                        </div>
                    )}

                    {rewashedItems.length > 0 && (
                        <div className="gps-mismatch" style={{ color: '#000' }}>
                            Note: {rewashedItems.length} item{rewashedItems.length !== 1 ? 's' : ''} tagged as free
                            re-wash — not billable.
                        </div>
                    )}

                    <div className="gps-signatures">
                        <div className="gps-sig-box">
                            <div className="gps-sig-line">Recorded By</div>
                        </div>
                        <div className="gps-sig-box">
                            <div className="gps-sig-line">Received At Laundry</div>
                        </div>
                        <div className="gps-sig-box">
                            <div className="gps-sig-line">Authorized Signature</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
)