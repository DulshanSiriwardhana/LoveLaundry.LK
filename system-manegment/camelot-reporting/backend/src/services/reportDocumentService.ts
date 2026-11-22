import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { monthLabel } from '../lib/dates';
import { formatLkr } from '../lib/money';
import { buildMatrixRows } from './matrixService';
import { loadReportContext, resolveSettings } from './reportService';

const HEADER_FILL = 'FF1F2937';
const LIGHT_FILL = 'FFF3F4F6';
const BORDER_COLOR = 'FFE5E7EB';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER_COLOR } } };
  });
}

function applyTableBorders(sheet: ExcelJS.Worksheet) {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.border) cell.border = { bottom: { style: 'hair', color: { argb: BORDER_COLOR } } };
    });
  });
}

async function getData(monthKey: string) {
  const context = await loadReportContext(monthKey);
  const settings = await resolveSettings();
  const items = context.items;
  const entries = context.entries;
  const matrix = buildMatrixRows({
    monthKey,
    entries: entries.map((e) => ({
      itemId: e.itemId,
      serviceDate: e.serviceDate,
      dayOfMonth: e.dayOfMonth,
      quantity: e.quantity,
      unitRateLkr: e.unitRateLkr,
      lineAmountLkr: e.lineAmountLkr ?? 0,
      pricingStatus: e.pricingStatus,
      billingCategoryCode: e.billingCategoryCode,
      sectionCode: e.sectionCode,
      itemCode: e.itemCode,
      itemName: e.itemName,
      sectionName: e.sectionName,
      billingCategoryName: e.billingCategoryName ?? undefined,
    })),
    items: items as never,
    daysInMonth: new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate(),
  });
  return { context, settings, matrix };
}

export async function buildReportExcel(monthKey: string): Promise<Buffer> {
  const { context, matrix } = await getData(monthKey);
  const calc = context.calculation;
  const meta = context.report;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Camelot Beach Hotel Laundry Reporting';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 2 }] });
  summary.columns = [{ width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }];
  summary.addRow([`${monthLabel(monthKey)} — Monthly Laundry Report`]);
  summary.getRow(1).font = { bold: true, size: 15 };
  summary.addRow(['Camelot Beach Hotel']);
  summary.getRow(2).font = { color: { argb: 'FF6B7280' } };
  summary.addRow([]);
  summary.addRow(['Metric', 'Value']).eachCell((c) => (c.font = { bold: true }));
  summary.addRow(['Total quantity', calc.totals.totalQuantity]);
  summary.addRow(['Total service cost (LKR)', calc.totals.totalAmountLkr]).getCell(2).numFmt = '#,##0.00';
  summary.addRow(['Recorded days', calc.totals.recordedDayCount]);
  summary.addRow(['Incomplete days', calc.totals.incompleteDayCount]);
  summary.addRow(['Unpriced quantity', calc.totals.unpricedQuantity]);
  summary.addRow(['Invoice ready', calc.invoiceReady ? 'Yes' : 'No — resolve blocking issues']);

  summary.addRow([]);
  summary.addRow(['Section', 'Quantity', 'Cost (LKR)', 'Items']);
  styleHeaderRow(summary.lastRow!);
  for (const section of calc.sectionTotals) {
    const r = summary.addRow([section.sectionName, section.totalQuantity, section.totalAmountLkr, section.itemCount]);
    r.getCell(3).numFmt = '#,##0.00';
  }
  const totalRow = summary.addRow([
    'TOTAL',
    calc.totals.totalQuantity,
    calc.totals.totalAmountLkr,
    context.items.length,
  ]);
  totalRow.font = { bold: true };
  totalRow.getCell(3).numFmt = '#,##0.00';

  const full = workbook.addWorksheet('Inventory Matrix', {
    views: [{ state: 'frozen', xSplit: 4, ySplit: 1 }],
  });
  const dayColumns = matrix.rows[0]?.days.length ?? 31;
  full.columns = [
    { header: 'Item Code', key: 'code', width: 16 },
    { header: 'Item', key: 'name', width: 30 },
    { header: 'Section', key: 'section', width: 18 },
    { header: 'Category', key: 'category', width: 18 },
    ...Array.from({ length: dayColumns }, (_, i) => ({ header: String(i + 1), key: `d${i + 1}`, width: 5 })),
    { header: 'Month Qty', key: 'qty', width: 11 },
    { header: 'Rate (LKR)', key: 'rate', width: 11 },
    { header: 'Cost (LKR)', key: 'cost', width: 14 },
  ];
  styleHeaderRow(full.getRow(1));
  for (const row of matrix.rows) {
    const values: Record<string, unknown> = {
      code: row.itemCode,
      name: row.itemName,
      section: row.sectionName,
      category: row.billingCategoryName,
      qty: row.totalQuantity,
      rate: row.weightedAverageRateLkr ?? row.unitRateLkr,
      cost: row.totalAmountLkr,
    };
    row.days.forEach((qty, index) => {
      values[`d${index + 1}`] = qty;
    });
    const r = full.addRow(values);
    r.getCell('rate').numFmt = '#,##0.00';
    r.getCell('cost').numFmt = '#,##0.00';
  }
  full.autoFilter = { from: 'A1', to: `D1` };

  const daily = workbook.addWorksheet('Daily Summary');
  daily.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Total Quantity', key: 'qty', width: 16 },
    { header: 'Total Cost (LKR)', key: 'cost', width: 18 },
    { header: 'Unpriced Qty', key: 'unpriced', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
  ];
  styleHeaderRow(daily.getRow(1));
  for (const day of calc.dailyTotals) {
    const r = daily.addRow({
      date: day.serviceDate,
      qty: day.totalQuantity,
      cost: day.totalAmountLkr,
      unpriced: day.unpricedQuantity,
      status: day.status,
    });
    r.getCell('cost').numFmt = '#,##0.00';
  }

  const sections = workbook.addWorksheet('Section Summary');
  sections.columns = [
    { header: 'Section', key: 'name', width: 24 },
    { header: 'Items', key: 'items', width: 10 },
    { header: 'Quantity', key: 'qty', width: 14 },
    { header: 'Cost (LKR)', key: 'cost', width: 16 },
    { header: 'Unpriced Qty', key: 'unpriced', width: 14 },
  ];
  styleHeaderRow(sections.getRow(1));
  for (const s of calc.sectionTotals) {
    const r = sections.addRow({
      name: s.sectionName,
      items: s.itemCount,
      qty: s.totalQuantity,
      cost: s.totalAmountLkr,
      unpriced: s.unpricedQuantity,
    });
    r.getCell('cost').numFmt = '#,##0.00';
  }

  const billing = workbook.addWorksheet('Billing Summary');
  billing.columns = [
    { header: 'Billing Category', key: 'name', width: 26 },
    { header: 'Items', key: 'items', width: 10 },
    { header: 'Quantity', key: 'qty', width: 14 },
    { header: 'Avg. Rate (LKR)', key: 'rate', width: 16 },
    { header: 'Subtotal (LKR)', key: 'amount', width: 18 },
    { header: 'Unpriced Qty', key: 'unpriced', width: 14 },
  ];
  styleHeaderRow(billing.getRow(1));
  for (const c of calc.categoryTotals.filter((x) => x.totalQuantity > 0)) {
    const r = billing.addRow({
      name: c.billingCategoryName,
      items: c.itemCount,
      qty: c.totalQuantity,
      rate: c.weightedAverageRateLkr,
      amount: c.totalAmountLkr,
      unpriced: c.unpricedQuantity,
    });
    r.getCell('rate').numFmt = '#,##0.00';
    r.getCell('amount').numFmt = '#,##0.00';
  }

  const financial = workbook.addWorksheet('Financial Summary');
  financial.columns = [{ width: 34 }, { width: 20 }];
  financial.addRow(['Financial Summary', '']).font = { bold: true, size: 13 };
  financial.addRow(['Reporting period', `${meta.periodStart} to ${meta.periodEnd}`]);
  financial.addRow(['Total billable quantity', calc.totals.pricedQuantity]);
  financial.addRow(['Total service cost (LKR)', calc.totals.totalAmountLkr]).getCell(2).numFmt = '#,##0.00';
  financial.addRow(['Unpriced quantity', calc.totals.unpricedQuantity]);
  financial.addRow(['Invoice ready', calc.invoiceReady ? 'Yes' : 'No']);
  financial.addRow([
    'Blocking issues',
    calc.blockingIssues.length ? calc.blockingIssues.map((i) => i.message).join('\n') : 'None',
  ]).getCell(2).alignment = { wrapText: true, vertical: 'top' };

  if (calc.issues.length > 0) {
    const validation = workbook.addWorksheet('Validation');
    validation.columns = [
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Code', key: 'code', width: 28 },
      { header: 'Message', key: 'message', width: 90 },
    ];
    styleHeaderRow(validation.getRow(1));
    for (const issue of calc.issues) {
      validation.addRow({ severity: issue.severity, code: issue.code, message: issue.message });
    }
  }

  for (const sheet of workbook.worksheets) applyTableBorders(sheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

interface PdfTableColumn {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown) => string;
}

function drawPdfTable(
  doc: PDFKit.PDFDocument,
  columns: PdfTableColumn[],
  rows: Array<Record<string, unknown>>,
  options: { startX?: number; fontSize?: number; headerFill?: string } = {},
): number {
  const startX = options.startX ?? 40;
  const fontSize = options.fontSize ?? 8;
  const rowHeight = fontSize + 6;
  const totalWidth = columns.reduce((s, c) => s + c.width, 0);
  let y = doc.y;

  const drawHeader = () => {
    doc.save();
    doc.rect(startX, y, totalWidth, rowHeight).fill(options.headerFill ?? '#1f2937');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fontSize);
    let x = startX;
    for (const col of columns) {
      doc.text(col.header, x + 3, y + 4, { width: col.width - 6, align: col.align ?? 'left', lineBreak: false });
      x += col.width;
    }
    doc.restore();
    y += rowHeight;
  };

  doc.font('Helvetica').fontSize(fontSize);
  drawHeader();
  rows.forEach((row, index) => {
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
      drawHeader();
      doc.font('Helvetica').fontSize(fontSize);
    }
    if (index % 2 === 1) {
      doc.save();
      doc.rect(startX, y, totalWidth, rowHeight).fill('#f9fafb');
      doc.restore();
    }
    doc.fillColor('#111827').font('Helvetica').fontSize(fontSize);
    let x = startX;
    for (const col of columns) {
      const raw = row[col.key];
      const text = col.format ? col.format(raw) : raw === null || raw === undefined ? '—' : String(raw);
      doc.text(text, x + 3, y + 4, { width: col.width - 6, align: col.align ?? 'left', lineBreak: false });
      x += col.width;
    }
    doc
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + totalWidth, y + rowHeight)
      .strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .stroke();
    y += rowHeight;
  });
  doc.y = y + 10;
  return y;
}

export async function buildReportPdf(monthKey: string): Promise<Buffer> {
  const { context, settings } = await getData(monthKey);
  const calc = context.calculation;
  const report = context.report;
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk as Buffer));

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(settings.serviceProvider?.name || 'Love Laundry');
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  if (settings.serviceProvider?.address) doc.text(settings.serviceProvider.address);
  const contact = [settings.serviceProvider?.phone, settings.serviceProvider?.email].filter(Boolean).join(' · ');
  if (contact) doc.text(contact);
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text(`${monthLabel(monthKey)} Inventory Report`);
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text(`Customer: ${report.customerName || 'Camelot Beach Hotel'}`);
  doc.text(`Period: ${report.periodStart} to ${report.periodEnd}`);
  doc.text(`Status: ${report.status} · Invoice: ${report.invoiceStatus}`);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Financial summary');
  doc.moveDown(0.3);
  const summaryRows = [
    { label: 'Total quantity (all items)', value: calc.totals.totalQuantity.toLocaleString() },
    { label: 'Total service cost', value: formatLkr(calc.totals.totalAmountLkr) },
    { label: 'Recorded days', value: String(calc.totals.recordedDayCount) },
    { label: 'Incomplete days', value: String(calc.totals.incompleteDayCount) },
    { label: 'Unpriced quantity', value: String(calc.totals.unpricedQuantity) },
    { label: 'Invoice ready', value: calc.invoiceReady ? 'Yes' : 'No — blocking issues present' },
  ];
  drawPdfTable(
    doc,
    [
      { header: 'Metric', key: 'label', width: 300 },
      { header: 'Value', key: 'value', width: 215, align: 'right' },
    ],
    summaryRows,
  );

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Section summary');
  doc.moveDown(0.3);
  drawPdfTable(
    doc,
    [
      { header: 'Section', key: 'sectionName', width: 180 },
      { header: 'Items', key: 'itemCount', width: 60, align: 'right' },
      { header: 'Quantity', key: 'totalQuantity', width: 110, align: 'right' },
      { header: 'Cost (LKR)', key: 'totalAmountLkr', width: 165, align: 'right', format: (v) => formatLkr(Number(v)) },
    ],
    calc.sectionTotals as unknown as Array<Record<string, unknown>>,
  );

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Daily summary');
  doc.moveDown(0.3);
  drawPdfTable(
    doc,
    [
      { header: 'Date', key: 'serviceDate', width: 100 },
      { header: 'Quantity', key: 'totalQuantity', width: 90, align: 'right' },
      { header: 'Cost (LKR)', key: 'totalAmountLkr', width: 130, align: 'right', format: (v) => formatLkr(Number(v)) },
      { header: 'Unpriced', key: 'unpricedQuantity', width: 80, align: 'right' },
      { header: 'Status', key: 'status', width: 115 },
    ],
    calc.dailyTotals as unknown as Array<Record<string, unknown>>,
  );

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Billing category summary');
  doc.moveDown(0.3);
  drawPdfTable(
    doc,
    [
      { header: 'Category', key: 'billingCategoryName', width: 165 },
      { header: 'Quantity', key: 'totalQuantity', width: 80, align: 'right' },
      { header: 'Avg. rate', key: 'weightedAverageRateLkr', width: 90, align: 'right', format: (v) => (v == null ? '—' : formatLkr(Number(v))) },
      { header: 'Subtotal (LKR)', key: 'totalAmountLkr', width: 180, align: 'right', format: (v) => formatLkr(Number(v)) },
    ],
    calc.categoryTotals.filter((c) => c.totalQuantity > 0) as unknown as Array<Record<string, unknown>>,
  );

  if (calc.issues.length > 0) {
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#b91c1c').text('Validation issues');
    doc.moveDown(0.3);
    drawPdfTable(
      doc,
      [
        { header: 'Severity', key: 'severity', width: 70 },
        { header: 'Code', key: 'code', width: 130 },
        { header: 'Message', key: 'message', width: 315 },
      ],
      calc.issues as unknown as Array<Record<string, unknown>>,
    );
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor('#9ca3af')
      .text(
        `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 19)} · Page ${i + 1} of ${range.count}`,
        40,
        doc.page.height - 32,
        { width: doc.page.width - 80, align: 'center' },
      );
  }
  doc.end();
  await new Promise<void>((resolve) => doc.on('end', () => resolve()));
  return Buffer.concat(chunks);
}
