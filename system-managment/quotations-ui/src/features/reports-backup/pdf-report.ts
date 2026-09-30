import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import {
  money,
  dataTable,
  sectionTitle,
  noData,
  sourceFailed,
  statusCell,
  miniHeading,
  kpiGrid,
  groupedBars,
  segmentedBar,
  breakdownBars,
  pct,
  RED,
  DARK,
  GRAY,
  GREEN,
  AMBER,
  BLUE,
  INDIGO,
  TEAL,
  sourceOk,
} from './pdf-drawing'
import type { DailyReportSnapshot } from './types'

installVfs()

function installVfs() {
  const pdf = pdfMake as unknown as { vfs?: Record<string, string> }
  const mod = pdfFonts as unknown as {
    pdfMake?: { vfs?: Record<string, string> }
    vfs?: Record<string, string>
  }
  const vfs = mod.pdfMake?.vfs ?? mod.vfs
  if (vfs) pdf.vfs = vfs
}

let loadedLogo: string | null = null

async function loadLogo(): Promise<string | null> {
  if (loadedLogo) return loadedLogo
  try {
    const res = await fetch('/icon.png')
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('logo read failed'))
      reader.readAsDataURL(blob)
    })
    loadedLogo = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

function attendanceCounts(records: DailyReportSnapshot['attendance']) {
  const present = records.filter(r => ['PRESENT', 'HALF_DAY', 'HALFDAY', 'HALF'].includes(r.status)).length
  const leave = records.filter(r => r.status.includes('LEAVE')).length
  const holiday = records.filter(r => r.status === 'HOLIDAY').length
  const other = Math.max(0, records.length - present - leave - holiday)
  return { present, leave, holiday, other }
}

function residencyMonths(date: string): string {
  const [y, m] = date.split('-').map(Number)
  const monthName = new Date(y, (m || 1) - 1, 1).toLocaleString('en-GB', { month: 'long' })
  return `${monthName} ${y}`
}

function totalsRow(label: string, share: string, cells: (string | number)[]): (string | number)[] {
  return [label, ...cells, share]
}

export async function generateReportPdf(snapshot: DailyReportSnapshot): Promise<Blob> {
  const logo = await loadLogo()
  const { company, totals, meta } = snapshot
  const date = meta.report_date
  const att = attendanceCounts(snapshot.attendance)
  const failedSources = snapshot.sources.filter(s => !s.ok)

  const billsTotal = snapshot.bills.reduce((sum, b) => sum + b.total, 0)
  const billsBalance = snapshot.bills.reduce((sum, b) => sum + b.balance, 0)
  const paymentsTotal = snapshot.payments.reduce((sum, p) => sum + p.amount, 0)
  const salaryTotal = snapshot.salary_slips.reduce((sum, s) => sum + s.net, 0)
  const gpPieces = snapshot.gatepasses.reduce((sum, g) => sum + g.total_pieces, 0)
  const recordedByGp = new Map<string, number>()
  for (const d of snapshot.deliveries) recordedByGp.set(d.gp_id ?? '', (recordedByGp.get(d.gp_id ?? '') ?? 0) + d.total_pieces)
  const delPieces =
    snapshot.deliveries.reduce((sum, d) => sum + d.total_pieces, 0) +
    snapshot.gatepasses.reduce((sum, g) => sum + (g.marked_delivered ? Math.max(0, g.total_pieces - (recordedByGp.get(g.gp_id ?? '') ?? 0)) : 0), 0)
  const netMargin = pct(totals.net, totals.income)
  const expenseRatio = pct(totals.expenses, totals.income)
  const collectedPct = pct(billsTotal - billsBalance, billsTotal)
  const deliveredPct = pct(delPieces, gpPieces)
  const attTotal = att.present + att.leave + att.holiday + att.other
  const attendanceRate = pct(att.present, attTotal)

  const content: unknown[] = [
    // ── Header ────────────────────────────────────────────────────────────
    {
      table: {
        widths: ['auto', '*', 'auto'],
        body: [
          [
            {
              stack: [
                logo ? { image: logo, width: 44, height: 44, fit: [44, 44] } : {},
                logo ? { text: '', fontSize: 1 } : {},
              ],
              alignment: 'left',
            },
            {
              stack: [
                { text: company.name.toUpperCase(), fontSize: 19, bold: true, color: RED, characterSpacing: 1.5 },
                { text: company.tagline ?? '', fontSize: 10.5, color: GRAY, italic: true },
                { text: company.address ?? '', fontSize: 9.5, color: DARK, margin: [0, 3, 0, 0] },
                {
                  text: `${company.phone ?? ''}${company.email ? `   •   ${company.email}` : ''}`,
                  fontSize: 9.5,
                  color: DARK,
                },
                company.registration_no
                  ? { text: `Reg No: ${company.registration_no}`, fontSize: 9.5, color: GRAY }
                  : {},
              ],
              alignment: 'left',
            },
            {
              stack: [
                { text: 'DAILY REPORT', fontSize: 14, bold: true, color: '#FFFFFF', alignment: 'center' },
                { text: date, fontSize: 14, bold: true, color: '#FFFFFF', alignment: 'center' },
                { text: residencyMonths(date), fontSize: 14, color: '#FFFFFF', alignment: 'center' },
                { text: `Generated ${meta.generated_at.slice(0, 19).replace('T', ' ')}`, fontSize: 10.5, color: '#FFFFFF', alignment: 'center' },
                { text: `Backup v${meta.backup_version ?? 2}`, fontSize: 10.5, color: '#FFFFFF', alignment: 'center', margin: [0, 4, 0, 0] },
              ],
              fillColor: RED,
              margin: [0, 0, 0, 0],
            },
          ],
        ],
      },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => RED, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 2, paddingBottom: () => 2 },
      margin: [0, 0, 0, 8],
    },

    { text: 'EXECUTIVE SUMMARY', fontSize: 14, bold: true, color: RED, margin: [0, 4, 0, 4] },
    kpiGrid([
      { label: 'INCOME', value: money(totals.income), sub: 'Ledger', tone: 'green' },
      { label: 'EXPENSES', value: money(totals.expenses), sub: 'Ledger', tone: 'red' },
      { label: 'NET', value: money(totals.net), sub: `${netMargin} margin`, tone: totals.net >= 0 ? 'green' : 'red' },
      { label: 'SPEND RATE', value: expenseRatio, sub: 'of income', tone: 'amber' },
    ]),
    kpiGrid([
      { label: 'BILLS RAISED', value: money(billsTotal), sub: `${snapshot.bills.length} bill(s)`, tone: 'blue' },
      { label: 'OUTSTANDING', value: money(billsBalance), sub: `${collectedPct} collected`, tone: 'amber' },
      { label: 'PAYMENTS IN', value: money(paymentsTotal), sub: `${snapshot.payments.length} payment(s)`, tone: 'green' },
      { label: 'SALARY PAID', value: money(salaryTotal), sub: `${snapshot.salary_slips.length} slip(s)`, tone: 'indigo' },
    ]),
    kpiGrid([
      { label: 'GP PIECES IN', value: String(gpPieces), sub: `${snapshot.gatepasses.length} gate pass(es)`, tone: 'blue' },
      { label: 'PIECES OUT', value: String(delPieces), sub: `${deliveredPct} delivered`, tone: 'teal' },
      { label: 'PRESENT', value: String(att.present), sub: `${attendanceRate} of ${attTotal}`, tone: 'green' },
      { label: 'LEAVE / HOLIDAY', value: `${att.leave} / ${att.holiday}`, sub: 'staff', tone: 'amber' },
    ]),
    { text: 'Net = ledger income − ledger expenses. Bill / payment / salary / linen figures are operational activity and are not added to the accounting net. Percentages are of the daily totals shown.', fontSize: 14, color: GRAY, italics: true, margin: [0, 3, 0, 8] },

    // ── Charts ─────────────────────────────────────────────────────────────
    miniHeading('FINANCIAL PERFORMANCE TODAY'),
    ...(totals.income + totals.expenses > 0
      ? groupedBars({
          series: [
            { name: 'Income', color: GREEN, values: [totals.income] },
            { name: 'Expenses', color: RED, values: [totals.expenses] },
            { name: 'Net', color: DARK, values: [totals.net] },
          ],
          labels: ['Today'],
        })
      : [noData('No ledger activity today.')]),

    ...(billsTotal + paymentsTotal > 0
      ? [
          miniHeading('BILLING & COLLECTIONS'),
          ...groupedBars({
            series: [
              { name: 'Bills raised', color: BLUE, values: [billsTotal] },
              { name: 'Payments received', color: GREEN, values: [paymentsTotal] },
            ],
            labels: ['Today'],
          }),
          { text: `Collected so far ${collectedPct} of bills raised today (outstanding ${money(billsBalance)}).`, fontSize: 14, color: GRAY, margin: [0, 2, 0, 4] },
        ]
      : []),

    ...(gpPieces + delPieces > 0
      ? [
          miniHeading('LINEN FLOW'),
          ...groupedBars({
            series: [
              { name: 'Received (gate passes)', color: BLUE, values: [gpPieces] },
              { name: 'Delivered', color: TEAL, values: [delPieces] },
            ],
            labels: ['Today'],
          }),
          { text: `Delivery completion ${deliveredPct} of received pieces.`, fontSize: 14, color: GRAY, margin: [0, 2, 0, 4] },
        ]
      : []),

    ...(attTotal > 0
      ? [
          miniHeading('STAFF PRESENCE'),
          ...segmentedBar([
            { name: 'Present', value: att.present, color: GREEN },
            { name: 'Leave', value: att.leave, color: AMBER },
            { name: 'Holiday', value: att.holiday, color: GRAY },
            ...(att.other > 0 ? [{ name: 'Other', value: att.other, color: RED }] : []),
          ]),
        ]
      : []),
  ]

  // ── Income ───────────────────────────────────────────────────────────────
  content.push(sectionTitle(2, 'Income (Ledger)', `${snapshot.income.length} entries • ${money(totals.income)}`))
  const incomeSource = snapshot.sources.find(s => s.key === 'income')
  if (!sourceOk(snapshot, 'income')) {
    content.push(sourceFailed(incomeSource?.error))
  } else if (snapshot.income.length === 0) {
    content.push(noData('No income recorded for this date.'))
  } else {
    const byMethod = new Map<string, number>()
    const bySourceIn = new Map<string, number>()
    for (const r of snapshot.income) {
      byMethod.set(r.payment_method ?? 'Other', (byMethod.get(r.payment_method ?? 'Other') ?? 0) + r.amount)
      bySourceIn.set(r.source ?? 'Other', (bySourceIn.get(r.source ?? 'Other') ?? 0) + r.amount)
    }
    content.push(
      dataTable({
        header: ['No', 'Customer', 'Description', 'Source', 'Method', 'Amount', '% of income'],
        widths: [22, '*', '*', 52, 52, 66, 44],
        alignments: ['left', 'left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.income.map((r, i) => [
          String(i + 1),
          r.customer ?? '—',
          r.description ?? '—',
          r.source ?? '—',
          r.payment_method ?? '—',
          money(r.amount),
          pct(r.amount, totals.income),
        ]),
        totals: totalsRow('Total', '100%', ['', '', '', '', money(totals.income)]),
      }),
      breakdownBars('By source', [...bySourceIn.entries()].map(([label, value]) => ({ label, value, color: BLUE })), { maxBars: 6 }),
      breakdownBars('By method', [...byMethod.entries()].map(([label, value]) => ({ label, value, color: INDIGO })), { maxBars: 6 })
    )
  }

  // ── Expenses ─────────────────────────────────────────────────────────────
  content.push(sectionTitle(3, 'Expenses', `${snapshot.expenses.length} entries • ${money(totals.expenses)}`))
  const expenseSource = snapshot.sources.find(s => s.key === 'expenses')
  if (!sourceOk(snapshot, 'expenses')) {
    content.push(sourceFailed(expenseSource?.error))
  } else if (snapshot.expenses.length === 0) {
    content.push(noData('No expenses recorded for this date.'))
  } else {
    const byCat = new Map<string, number>()
    for (const r of snapshot.expenses) byCat.set(r.category ?? 'Other', (byCat.get(r.category ?? 'Other') ?? 0) + r.amount)
    content.push(
      dataTable({
        header: ['No', 'Category', 'Description', 'Payee', 'Method', 'Amount', '% of expenses'],
        widths: [22, 70, '*', 66, 52, 66, 44],
        alignments: ['left', 'left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.expenses.map((r, i) => [
          String(i + 1),
          r.category ?? '—',
          r.description ?? '—',
          r.payee ?? '—',
          r.payment_method ?? '—',
          money(r.amount),
          pct(r.amount, totals.expenses),
        ]),
        totals: totalsRow('Total', '100%', ['', '', '', '', money(totals.expenses)]),
      }),
      breakdownBars('By category', [...byCat.entries()].map(([label, value]) => ({ label, value, color: RED })), { maxBars: 8 })
    )
  }

  // ── Attendance ───────────────────────────────────────────────────────────
  content.push(sectionTitle(4, 'Attendance', `${attTotal} record(s) • ${attendanceRate} present`))
  if (!sourceOk(snapshot, 'attendance')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'attendance')?.error))
  } else if (snapshot.attendance.length === 0) {
    content.push(noData('No attendance recorded for this date.'))
  } else {
    content.push(
      segmentedBar(
        [
          { name: 'Present', value: att.present, color: GREEN },
          { name: 'Leave', value: att.leave, color: AMBER },
          { name: 'Holiday', value: att.holiday, color: GRAY },
          ...(att.other > 0 ? [{ name: 'Other', value: att.other, color: RED }] : []),
        ],
        'Today'
      ),
      dataTable({
        header: ['#', 'Employee', 'Status', 'OT (hrs)'],
        widths: [24, '*', 130, 70],
        alignments: ['left', 'left', 'center', 'right'],
        body: snapshot.attendance.map((r, i) => [String(i + 1), r.employee_name, r.status, r.overtime_hours ? String(r.overtime_hours) : '—']),
      })
    )
  }

  // ── Payroll ──────────────────────────────────────────────────────────────
  content.push(sectionTitle(5, 'Payroll — salary slips paid / raised', `${snapshot.salary_slips.length} slip(s) • ${money(salaryTotal)}`))
  if (!sourceOk(snapshot, 'salary')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'salary')?.error))
  } else if (snapshot.salary_slips.length === 0) {
    content.push(noData('No salary slips for this date.'))
  } else {
    const grossSum = snapshot.salary_slips.reduce((sum, s) => sum + s.gross, 0)
    const dedSum = snapshot.salary_slips.reduce((sum, s) => sum + s.deductions, 0)
    content.push(
      dataTable({
        header: ['No', 'Employee', 'Period', 'Gross', 'Deductions', 'Net', 'Status'],
        widths: [22, '*', 130, 64, 64, 64, 70],
        alignments: ['left', 'left', 'left', 'right', 'right', 'right', 'center'],
        body: snapshot.salary_slips.map((r, i) => [
          String(i + 1),
          r.employee_name,
          r.period_start && r.period_end ? `${r.period_start} → ${r.period_end}` : '—',
          money(r.gross),
          money(r.deductions),
          money(r.net),
          r.status,
        ]),
        totals: totalsRow('Total', '', ['', money(grossSum), money(dedSum), money(salaryTotal), '']),
      })
    )
  }

  // ── Bills ────────────────────────────────────────────────────────────────
  content.push(sectionTitle(6, 'Bills', `${snapshot.bills.length} bill(s) • ${money(billsTotal)} • ${collectedPct} collected`))
  if (!sourceOk(snapshot, 'bills')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'bills')?.error))
  } else if (snapshot.bills.length === 0) {
    content.push(noData('No bills raised for this date.'))
  } else {
    const itemsTotal = snapshot.bills.reduce((sum, b) => sum + b.items_count, 0)
    const byClient = new Map<string, number>()
    for (const b of snapshot.bills) byClient.set(b.client_name, (byClient.get(b.client_name) ?? 0) + b.balance)
    content.push(
      dataTable({
        header: ['Bill No', 'Client', 'Items', 'Total', 'Balance', 'Status'],
        widths: ['*', '*', 40, 66, 66, 78],
        alignments: ['left', 'left', 'right', 'right', 'right', 'center'],
        body: snapshot.bills.map(b => [b.bill_id || '—', b.client_name, String(b.items_count), money(b.total), money(b.balance), statusCell(b.payment_status || '—')]),
        totals: totalsRow('Total', `${collectedPct} collected`, [String(itemsTotal), money(billsTotal), money(billsBalance), '']),
      }),
      breakdownBars('Outstanding by client', [...byClient.entries()].filter(([, v]) => v > 0).map(([label, value]) => ({ label, value, color: AMBER })), { maxBars: 8 })
    )
  }

  // ── Payments received (mgmt) ─────────────────────────────────────────────
  content.push(sectionTitle(7, 'Payments Received', `${snapshot.payments.length} payment(s) • ${money(paymentsTotal)}`))
  if (!sourceOk(snapshot, 'payments')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'payments')?.error))
  } else if (snapshot.payments.length === 0) {
    content.push(noData('No payments received for this date.'))
  } else {
    const byMethod = new Map<string, number>()
    for (const p of snapshot.payments) byMethod.set(p.method ?? 'Other', (byMethod.get(p.method ?? 'Other') ?? 0) + p.amount)
    content.push(
      dataTable({
        header: ['No', 'Customer', 'Method', 'Reference', 'Amount', '% of payments'],
        widths: [22, '*', 70, 90, 66, 44],
        alignments: ['left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.payments.map((p, i) => [String(i + 1), p.customer ?? '—', p.method ?? '—', p.ref ?? '—', money(p.amount), pct(p.amount, paymentsTotal)]),
        totals: totalsRow('Total', '100%', ['', '', money(paymentsTotal)]),
      }),
      breakdownBars('By method', [...byMethod.entries()].map(([label, value]) => ({ label, value, color: TEAL })), { maxBars: 6 })
    )
  }

  // ── Shop bills ───────────────────────────────────────────────────────────
  content.push(sectionTitle(8, 'Shop Bills', `${snapshot.shop_bills.length} bill(s)`))
  if (!sourceOk(snapshot, 'shop_bills')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'shop_bills')?.error))
  } else if (snapshot.shop_bills.length === 0) {
    content.push(noData('No shop bills for this date.'))
  } else {
    const shopTotal = snapshot.shop_bills.reduce((sum, b) => sum + b.total, 0)
    const shopBal = snapshot.shop_bills.reduce((sum, b) => sum + b.balance, 0)
    content.push(
      dataTable({
        header: ['Bill No', 'Client', 'Total', 'Balance', 'Status'],
        widths: ['*', '*', 66, 66, 74],
        alignments: ['left', 'left', 'right', 'right', 'center'],
        body: snapshot.shop_bills.map(b => [b.bill_id || '—', b.client_name, money(b.total), money(b.balance), statusCell(b.status || '—')]),
        totals: totalsRow('Total', '', ['', money(shopTotal), money(shopBal), '']),
      })
    )
  }

  // ── Legacy invoices ──────────────────────────────────────────────────────
  content.push(sectionTitle(9, 'Legacy Invoices', `${snapshot.legacy_invoices.length} invoice(s)`))
  if (!sourceOk(snapshot, 'legacy_invoices')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'legacy_invoices')?.error))
  } else if (snapshot.legacy_invoices.length === 0) {
    content.push(noData('No legacy invoices for this date.'))
  } else {
    const legacyTotal = snapshot.legacy_invoices.reduce((sum, b) => sum + b.total, 0)
    content.push(
      dataTable({
        header: ['Invoice No', 'Client', 'Total', 'Status'],
        widths: ['*', '*', 70, 80],
        alignments: ['left', 'left', 'right', 'center'],
        body: snapshot.legacy_invoices.map(b => [b.invoice_id || '—', b.client_name, money(b.total), b.status ?? '—']),
        totals: totalsRow('Total', '', ['', money(legacyTotal), '']),
      })
    )
  }

  // ── Linen activity ───────────────────────────────────────────────────────
  content.push(sectionTitle(10, 'Linen Activity', `${gpPieces} received • ${delPieces} delivered • ${deliveredPct} completion`))
  content.push(miniHeading('GATE PASSES RECEIVED'))
  if (!sourceOk(snapshot, 'gatepasses')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'gatepasses')?.error))
  } else if (snapshot.gatepasses.length === 0) {
    content.push(noData('—'))
  } else {
    content.push(
      dataTable({
        header: ['GP No', 'Customer', 'Pieces', 'Delivered'],
        widths: ['*', '*', 60, 80],
        alignments: ['left', 'left', 'right', 'center'],
        body: snapshot.gatepasses.map(g => [g.gp_id || '—', g.customer, String(g.total_pieces), g.delivered ? 'Yes' : 'No']),
        totals: totalsRow('Total', '', [String(gpPieces), '']),
      })
    )
  }

  content.push(miniHeading('DELIVERIES'))
  if (!sourceOk(snapshot, 'deliveries')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'deliveries')?.error))
  } else if (snapshot.deliveries.length === 0) {
    content.push(noData('—'))
  } else {
    content.push(
      dataTable({
        header: ['Delivery No', 'Gate Pass', 'Customer', 'Pieces'],
        widths: ['*', 85, '*', 60],
        alignments: ['left', 'left', 'left', 'right'],
        body: snapshot.deliveries.map(d => [d.delivery_id || '—', d.gp_id ?? '—', d.customer, String(d.total_pieces)]),
        totals: totalsRow('Total', '', [String(snapshot.deliveries.reduce((sum, d) => sum + d.total_pieces, 0)), '']),
      })
    )
  }

  content.push(miniHeading('RETURNS'))
  if (!sourceOk(snapshot, 'returns')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'returns')?.error))
  } else if (snapshot.returns.length === 0) {
    content.push(noData('—'))
  } else {
    const retItems = snapshot.returns.reduce((sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0), 0)
    content.push(
      dataTable({
        header: ['Return No', 'Gate Pass', 'Customer', 'Items'],
        widths: ['*', 85, '*', '*'],
        alignments: ['left', 'left', 'left', 'left'],
        body: snapshot.returns.map(r => [r.return_id || '—', r.gp_id ?? '—', r.customer, r.items.map(i => `${i.name} ×${i.quantity}`).join(', ') || '—']),
        totals: totalsRow('Total', '', [String(retItems), '']),
      })
    )
  }

  // ── Linen status ─────────────────────────────────────────────────────────
  content.push(sectionTitle(11, 'Linen Stock Status'))
  if (!sourceOk(snapshot, 'linen_status')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'linen_status')?.error))
  } else if (!snapshot.linen_status) {
    content.push(noData('—'))
  } else {
    const ls = snapshot.linen_status
    content.push(
      segmentedBar([
        { name: 'In stock', value: ls.in_stock, color: GREEN },
        { name: 'In use', value: ls.in_use, color: BLUE },
        { name: 'In wash', value: ls.in_wash, color: TEAL },
        { name: 'Retired', value: ls.retired, color: GRAY },
        ...(ls.lost > 0 ? [{ name: 'Lost', value: ls.lost, color: RED }] : []),
      ]),
      dataTable({
        header: ['In Stock', 'In Use', 'In Wash', 'Retired', 'Lost', 'Total'],
        widths: ['*', '*', '*', '*', '*', '*'],
        alignments: ['center', 'center', 'center', 'center', 'center', 'center'],
        body: [[String(ls.in_stock), String(ls.in_use), String(ls.in_wash), String(ls.retired), String(ls.lost), String(ls.total)]],
      }),
      ls.truncated
        ? { text: 'Snapshot limited to the first 5,000 linen records.', fontSize: 14, color: AMBER, margin: [0, 3, 0, 0] }
        : {}
    )
  }

  // ── Source health ────────────────────────────────────────────────────────
  if (failedSources.length > 0) {
    content.push(sectionTitle(12, 'Data Sources With Issues'))
    content.push(
      {
        text: failedSources.map(s => `• ${s.label}: ${s.error ?? 'failed'}`).join('\n'),
        fontSize: 9.5,
        color: AMBER,
        margin: [0, 0, 0, 6],
      }
    )
  }

  const doc: Record<string, unknown> = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 30, 36, 48],
    defaultStyle: { font: 'Roboto', fontSize: 14, color: DARK },
    content: content as unknown[],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: `${company.name}  •  Daily Report ${date}`,
          fontSize: 9.5,
          color: GRAY,
          alignment: 'left',
          margin: [36, 0, 0, 0],
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          fontSize: 9.5,
          color: GRAY,
          alignment: 'right',
          margin: [0, 0, 36, 0],
        },
      ],
      margin: [0, 12, 0, 0],
    }),
  }

  return new Promise<Blob>((resolve, reject) => {
    const pdf = pdfMake.createPdf(doc as unknown as Parameters<typeof pdfMake.createPdf>[0])
    pdf.getBlob(blob => {
      if (blob && blob.size > 0) resolve(blob)
      else reject(new Error('PDF generation returned an empty blob'))
    })
  })
}