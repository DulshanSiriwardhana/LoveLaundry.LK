import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatLkr } from '../lib/money';

type AnyInvoice = Record<string, any>;

function money(value: unknown): string {
  return formatLkr(Number(value ?? 0));
}

function drawLine(doc: PDFKit.PDFDocument, x1: number, x2: number) {
  doc
    .moveTo(x1, doc.y)
    .lineTo(x2, doc.y)
    .strokeColor('#e5e7eb')
    .lineWidth(0.6)
    .stroke();
  doc.moveDown(0.5);
}

export async function buildInvoicePdf(invoice: AnyInvoice): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk as Buffer));

  const provider = invoice.serviceProviderSnapshot ?? {};
  const customer = invoice.customerSnapshot ?? {};
  const statusLabel = String(invoice.status ?? 'draft').toUpperCase();

  // Header band
  doc.save();
  doc.rect(0, 0, doc.page.width, 10).fill('#1f2937');
  doc.restore();
  doc.y = 48;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(provider.name || 'Love Laundry', 48, 48);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  if (provider.address) doc.text(provider.address);
  const providerContact = [provider.phone, provider.email, provider.website].filter(Boolean).join('  ·  ');
  if (providerContact) doc.text(providerContact);
  if (provider.taxNumber) doc.text(`Tax No: ${provider.taxNumber}`);

  doc.font('Helvetica-Bold').fontSize(26).fillColor('#111827').text('INVOICE', 330, 48, {
    width: 217,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 330, 82, { width: 217, align: 'right' });
  doc.text(`Invoice Date: ${invoice.invoiceDate}`, 330, 95, { width: 217, align: 'right' });
  if (invoice.dueDate) doc.text(`Due Date: ${invoice.dueDate}`, 330, 108, { width: 217, align: 'right' });
  if (invoice.revisionNumber) {
    doc.text(`Revision: ${invoice.revisionNumber}`, 330, 121, { width: 217, align: 'right' });
  }

  // Status badge
  const badgeColor = invoice.status === 'paid' ? '#065f46' : invoice.status === 'void' ? '#991b1b' : '#1f2937';
  doc.save();
  doc.roundedRect(330, 138, 217, 22, 4).fill(badgeColor);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(statusLabel, 330, 145, {
    width: 217,
    align: 'center',
  });
  doc.restore();

  doc.y = 180;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#9ca3af').text('BILL TO');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(customer.name || 'Camelot Beach Hotel');
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
  if (customer.address) doc.text(customer.address);
  const cityLine = [customer.city, customer.country].filter(Boolean).join(', ');
  if (cityLine) doc.text(cityLine);
  const customerContact = [customer.contactPerson, customer.phone, customer.email].filter(Boolean).join(' · ');
  if (customerContact) doc.text(customerContact);
  if (customer.taxNumber) doc.text(`Tax No: ${customer.taxNumber}`);

  doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(
    `Service period: ${invoice.periodStart} to ${invoice.periodEnd}`,
    330,
    180,
    { width: 217, align: 'right' },
  );

  // Lines table
  const tableTop = Math.max(doc.y + 24, 250);
  const left = 48;
  const right = doc.page.width - 48;
  const cols = { desc: left + 6, qty: 330, rate: 395, amount: 470 };
  const rowHeight = 20;

  const drawHeader = () => {
    doc.save();
    doc.rect(left, doc.y, right - left, 22).fill('#1f2937');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    doc.text('DESCRIPTION', cols.desc, doc.y + 7, { width: 250 });
    doc.text('QTY', cols.qty, doc.y + 7, { width: 55, align: 'right' });
    doc.text('AVG. RATE', cols.rate, doc.y + 7, { width: 65, align: 'right' });
    doc.text('AMOUNT', cols.amount, doc.y + 7, { width: 78, align: 'right' });
    doc.restore();
    doc.y += 22;
  };

  doc.y = tableTop;
  drawHeader();
  for (const line of invoice.lines ?? []) {
    if (doc.y + rowHeight > doc.page.height - 180) {
      doc.addPage();
      doc.y = 60;
      drawHeader();
    }
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111827').text(line.description, cols.desc, y + 6, {
      width: 250,
      lineBreak: false,
    });
    doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
    doc.text(String(line.quantity), cols.qty, y + 6, { width: 55, align: 'right' });
    doc.text(line.unitRateLkr == null ? '—' : money(line.unitRateLkr), cols.rate, y + 6, {
      width: 65,
      align: 'right',
    });
    doc.text(money(line.subtotalLkr), cols.amount, y + 6, { width: 78, align: 'right' });
    doc.y = y + rowHeight;
    drawLine(doc, left, right);
  }

  // Totals block
  if (doc.y > doc.page.height - 240) {
    doc.addPage();
    doc.y = 60;
  }
  doc.moveDown(0.4);
  const totalsX = 330;
  const totalsWidth = right - totalsX;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(bold ? '#111827' : '#4b5563');
    const y = doc.y;
    doc.text(label, totalsX, y, { width: 140, align: 'left' });
    doc.text(value, totalsX + 140, y, { width: totalsWidth - 140, align: 'right' });
    doc.y = y + (bold ? 20 : 15);
  };

  totalRow('Subtotal', money(invoice.totals?.subtotalLkr));
  for (const adjustment of invoice.adjustments ?? []) {
    totalRow(adjustment.description, money(adjustment.amountLkr));
  }
  if ((invoice.totals?.adjustmentsTotalLkr ?? 0) !== 0 && (invoice.adjustments ?? []).length === 0) {
    totalRow('Adjustments', money(invoice.totals.adjustmentsTotalLkr));
  }
  if ((invoice.totals?.taxRatePercent ?? 0) > 0) {
    totalRow(
      `${invoice.totals.taxLabel || 'Tax'} (${invoice.totals.taxRatePercent}%)`,
      money(invoice.totals.taxAmountLkr),
    );
  }
  doc.save();
  doc.rect(totalsX, doc.y, totalsWidth, 30).fill('#f3f4f6');
  doc.restore();
  const totalY = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('TOTAL PAYABLE', totalsX + 8, totalY, { width: 150 });
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(money(invoice.totals?.totalLkr), totalsX + 158, totalY - 2, {
    width: totalsWidth - 166,
    align: 'right',
  });
  doc.y = totalY + 34;

  if (invoice.revisionReason) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#92400e').text(`Revision note: ${invoice.revisionReason}`);
    doc.moveDown(0.4);
  }
  if ((invoice.totals?.unpricedQuantity ?? 0) > 0) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#b91c1c')
      .text(`Warning: ${invoice.totals.unpricedQuantity} unit(s) remain unpriced.`);
  }

  // Payment information
  const payment = invoice.payment ?? {};
  const hasPaymentDetails = payment.bankName || payment.accountNumber || payment.accountName;
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Payment information');
  doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563');
  if (hasPaymentDetails) {
    if (payment.bankName) doc.text(`Bank: ${payment.bankName}`);
    if (payment.branch) doc.text(`Branch: ${payment.branch}`);
    if (payment.accountName) doc.text(`Account name: ${payment.accountName}`);
    if (payment.accountNumber) doc.text(`Account number: ${payment.accountNumber}`);
    if (payment.swiftCode) doc.text(`SWIFT: ${payment.swiftCode}`);
  } else {
    doc.text('Payment details will be provided separately. Please quote the invoice number on payment.');
  }
  if (payment.terms) doc.text(payment.terms);
  if (invoice.notes) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Notes');
    doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text(invoice.notes);
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#9ca3af')
      .text(
        `${invoice.invoiceNumber} · Generated ${new Date().toISOString().slice(0, 10)} · Page ${i + 1} of ${range.count}`,
        48,
        doc.page.height - 30,
        { width: doc.page.width - 96, align: 'center' },
      );
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on('end', () => resolve()));
  return Buffer.concat(chunks);
}

export async function buildInvoiceExcel(invoice: AnyInvoice): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Camelot Beach Hotel Laundry Reporting';
  const sheet = workbook.addWorksheet('Invoice');
  sheet.columns = [{ width: 38 }, { width: 14 }, { width: 14 }, { width: 18 }];
  sheet.addRow([invoice.serviceProviderSnapshot?.name || 'Love Laundry']).font = { bold: true, size: 14 };
  sheet.addRow([invoice.serviceProviderSnapshot?.address ?? '']);
  sheet.addRow([]);
  sheet.addRow(['INVOICE', '', '', invoice.invoiceNumber]);
  sheet.addRow(['Customer', '', '', invoice.customerName]);
  sheet.addRow(['Invoice date', '', '', invoice.invoiceDate]);
  sheet.addRow(['Service period', '', '', `${invoice.periodStart} — ${invoice.periodEnd}`]);
  sheet.addRow(['Status', '', '', invoice.status]);
  sheet.addRow([]);
  sheet.addRow(['Description', 'Quantity', 'Avg. rate (LKR)', 'Amount (LKR)']);
  sheet.getRow(sheet.lastRow!.number).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  });
  for (const line of invoice.lines ?? []) {
    const row = sheet.addRow([
      line.description,
      line.quantity,
      line.unitRateLkr,
      line.subtotalLkr,
    ]);
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(4).numFmt = '#,##0.00';
  }
  sheet.addRow([]);
  sheet.addRow(['Subtotal', '', '', invoice.totals?.subtotalLkr]);
  for (const adjustment of invoice.adjustments ?? []) {
    sheet.addRow([adjustment.description, '', '', adjustment.amountLkr]);
  }
  if ((invoice.totals?.taxRatePercent ?? 0) > 0) {
    sheet.addRow([`${invoice.totals.taxLabel} (${invoice.totals.taxRatePercent}%)`, '', '', invoice.totals.taxAmountLkr]);
  }
  const totalRow = sheet.addRow(['TOTAL PAYABLE (LKR)', '', '', invoice.totals?.totalLkr]);
  totalRow.font = { bold: true };
  [totalRow.getCell(4), sheet.getRow(sheet.rowCount - 1).getCell(4)].forEach((c) => (c.numFmt = '#,##0.00'));

  const breakdown = workbook.addWorksheet('Item Breakdown');
  breakdown.columns = [
    { header: 'Billing Category', key: 'category', width: 26 },
    { header: 'Item Code', key: 'code', width: 18 },
    { header: 'Item', key: 'name', width: 30 },
    { header: 'Quantity', key: 'qty', width: 12 },
    { header: 'Avg. Rate (LKR)', key: 'rate', width: 16 },
    { header: 'Amount (LKR)', key: 'amount', width: 16 },
  ];
  breakdown.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  });
  for (const line of invoice.lines ?? []) {
    for (const item of line.itemBreakdown ?? []) {
      const row = breakdown.addRow({
        category: line.billingCategoryName,
        code: item.itemCode,
        name: item.itemName,
        qty: item.quantity,
        rate: item.unitRateLkr,
        amount: item.amountLkr,
      });
      row.getCell('rate').numFmt = '#,##0.00';
      row.getCell('amount').numFmt = '#,##0.00';
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
