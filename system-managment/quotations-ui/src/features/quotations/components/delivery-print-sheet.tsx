import React from 'react'
import type { Delivery, GatePass } from '../../../types/operations'

const deliveryPrintStyles = `
  @media print {
    .dls-page { margin: 0; padding: 0; width: 100%; min-height: auto; }
    @page { size: A4; margin: 0; }
    @page :first { margin: 0; }
    .no-print { display: none !important; }
  }
  @page { size: A4; margin: 0; }
  @page :first { margin: 0; }
  .dls-page {
    font-family: "Spectral", Georgia, serif;
    color: #000;
    background: #fff;
  }
  .dls-sheet {
    width: 210mm;
    min-height: 297mm;
    padding: 12mm;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.4;
  }
  .dls-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .dls-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    border: 2px solid #DC2626;
    border-radius: 50%;
    padding: 4px;
  }
  .dls-company-center { text-align: center; flex: 1; }
  .dls-company-name {
    font-size: 28px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 3px;
    line-height: 1.2;
    margin: 0;
  }
  .dls-company-tagline {
    font-size: 16px;
    font-weight: 600;
    margin: 2px 0 0 0;
  }
  .dls-services {
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
  .dls-service-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #000;
    display: inline-block;
    margin-right: 4px;
  }
  .dls-contact {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 10px;
  }
  .dls-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border: 2px solid #000;
    padding: 8px 10px;
    margin-bottom: 10px;
  }
  .dls-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 0;
  }
  .dls-title-meta {
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  .dls-details {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .dls-detail-left { width: 58%; }
  .dls-detail-right { width: 40%; text-align: right; }
  .dls-detail-line { display: flex; margin-bottom: 3px; }
  .dls-detail-label { width: 110px; flex-shrink: 0; }
  .dls-detail-value {
    flex: 1;
    border-bottom: 1px dotted #000;
    padding-left: 4px;
    font-weight: 600;
  }
  .dls-items-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .dls-items-table th,
  .dls-items-table td {
    border: 1px solid #000;
    padding: 4px 6px;
  }
  .dls-items-table th {
    text-align: left;
    background: #f5f5f5;
  }
  .dls-items-table td {
    height: 22px;
  }
  .dls-col-no { width: 24px; text-align: center; }
  .dls-col-spec { width: 38%; }
  .dls-col-qty { width: 80px; text-align: center; }
  .dls-totals {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .dls-signatures {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 40px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }
  .dls-sig-box { width: 150px; }
  .dls-sig-line {
    border-top: 2px dotted #000;
    padding-top: 4px;
  }
`

export const DeliveryPrintSheet = React.forwardRef<HTMLDivElement, { delivery: Delivery; gp?: GatePass }>(
    ({ delivery, gp }, ref) => {
        const items = delivery.items ?? []
        const totalPieces = items.reduce((sum, item) => sum + (item.quantity || 0), 0)
        const gatePassNumber = gp?.gate_pass_number ?? delivery.gate_pass_id.slice(-8).toUpperCase()

        return (
            <div ref={ref} className="dls-page">
                <style dangerouslySetInnerHTML={{ __html: deliveryPrintStyles }} />
                <div className="dls-sheet">
                    <div className="dls-header">
                        <div>
                            <img src="/icon.png" alt="Love Laundry" className="dls-logo" />
                        </div>
                        <div className="dls-company-center">
                            <h1 className="dls-company-name">Love Laundry</h1>
                            <h2 className="dls-company-tagline">and dry cleaning experts</h2>
                        </div>
                    </div>

                    <div className="dls-services">
                        {['Dry Cleaning', 'Free Pickup & Delivery', 'Wash & Pressed', 'Wash & Fold', 'Laundered Pressed'].map(s => (
                            <span key={s}><span className="dls-service-dot" />{s}</span>
                        ))}
                    </div>

                    <div className="dls-contact">
                        <div>
                            <p style={{ margin: 0 }}>Tel: +94 77 4200 919 / 070 243 3566</p>
                            <p style={{ margin: 0 }}>Email: lovelaundry01@gmail.com</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0 }}>Hotel Housekeeping Outerwear / Linen</p>
                            <p style={{ margin: 0 }}>Machine Washable Textiles</p>
                        </div>
                    </div>

                    <div className="dls-title-row">
                        <p className="dls-title">Delivery Note</p>
                        <div className="dls-title-meta">
                            <div>Ref: DLV-{delivery.id.slice(-8).toUpperCase()}</div>
                            <div>Gate Pass: {gatePassNumber}</div>
                        </div>
                    </div>

                    <div className="dls-details">
                        <div className="dls-detail-left">
                            <div className="dls-detail-line">
                                <span className="dls-detail-label">Delivered To:</span>
                                <span className="dls-detail-value">{delivery.client_name || ''}</span>
                            </div>
                            <div className="dls-detail-line">
                                <span className="dls-detail-label">Delivered By:</span>
                                <span className="dls-detail-value">{delivery.delivered_by || ''}</span>
                            </div>
                            <div className="dls-detail-line">
                                <span className="dls-detail-label">Received By:</span>
                                <span className="dls-detail-value">{delivery.received_by || ''}</span>
                            </div>
                        </div>
                        <div className="dls-detail-right">
                            <div className="dls-detail-line">
                                <span className="dls-detail-label">Delivery Date:</span>
                                <span className="dls-detail-value">{delivery.delivery_date ? new Date(delivery.delivery_date).toLocaleDateString() : ''}</span>
                            </div>
                            <div className="dls-detail-line">
                                <span className="dls-detail-label">Item Types:</span>
                                <span className="dls-detail-value">{items.length}</span>
                            </div>
                        </div>
                    </div>

                    <table className="dls-items-table">
                        <thead>
                            <tr>
                                <th className="dls-col-no">No.</th>
                                <th>Item</th>
                                <th className="dls-col-spec">Specification</th>
                                <th className="dls-col-qty">Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={`${item.item_name}-${index}`}>
                                    <td className="dls-col-no">{index + 1}</td>
                                    <td>{item.item_name}</td>
                                    <td className="dls-col-spec">{item.specification || ''}</td>
                                    <td className="dls-col-qty">{item.quantity ?? ''}</td>
                                </tr>
                            ))}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={4}>No items</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="dls-totals">
                        <span>Total Item Types: {items.length}</span>
                        <span>Total Pieces: {totalPieces}</span>
                    </div>

                    <div className="dls-signatures">
                        <div className="dls-sig-box">
                            <div className="dls-sig-line">Delivered By</div>
                        </div>
                        <div className="dls-sig-box">
                            <div className="dls-sig-line">Received By Client</div>
                        </div>
                        <div className="dls-sig-box">
                            <div className="dls-sig-line">Authorized Signature</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
)