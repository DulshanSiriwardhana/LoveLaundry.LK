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
  weekBuckets,
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
import type { MonthlyReportSnapshot } from './types'

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

function attendanceCounts(records: MonthlyReportSnapshot['attendance']) {
  const present = records.filter(r => ['PRESENT', 'HALF_DAY', 'HALFDAY', 'HALF'].includes(r.status)).length
  const leave = records.filter(r => r.status.includes('LEAVE')).length
  const holiday = records.filter(r => r.status === 'HOLIDAY').length
  const other = Math.max(0, records.length - present - leave - holiday)
  return { present, leave, holiday, other }
}

function totalsRow(label: string, share: string, cells: (string | number)[]): (string | number)[] {
  return [label, ...cells, share]
}

export async function generateMonthReportPdf(snapshot: MonthlyReportSnapshot): Promise<Blob> {
  const logo = await loadLogo()
  const { company, totals, meta, daily } = snapshot
  const period = meta.period
  const failedSources = snapshot.sources.filter(s => !s.ok)
  const att = attendanceCounts(snapshot.attendance)
  const attTotal = att.present + att.leave + att.holiday + att.other
  const attRate = pct(att.present, attTotal)

  const workDays = totals.work_days || daily.length || 0
  const avgIncome = workDays > 0 ? totals.income / workDays : 0
  const avgNet = workDays > 0 ? totals.net / workDays : 0
  const netMargin = pct(totals.net, totals.income)
  const expenseRatio = pct(totals.expenses, totals.income)
  const collectedPct = pct(totals.bills - totals.bill_balance, totals.bills)
  const deliveredPct = pct(totals.deliveries_pieces, totals.gatepass_pieces)
  const salaryTotal = snapshot.salary_slips.reduce((sum, s) => sum + s.net, 0)
  const paymentsTotal = snapshot.payments.reduce((sum, p) => sum + p.amount, 0)

  const finWeek = weekBuckets(daily, d => d.income)
  const expWeek = weekBuckets(daily, d => d.expenses)
  const netWeek = weekBuckets(daily, d => d.income - d.expenses)
  const weekLabels = finWeek.labels
  const billWeek = weekBuckets(daily, d => d.bills)
  const payWeek = weekBuckets(daily, d => d.payments)
  const gpWeek = weekBuckets(daily, d => d.gatepass_pieces)
  const delWeek = weekBuckets(daily, d => d.deliveries_pieces)

  const content: unknown[] = [
    // ── Header ────────────────────────────────────────────────────────────
    {
      table: {
        widths: ['auto', '*', 'auto'],
        body: [
          [
            {
              stack: [logo ? { image: logo, width: 44, height: 44, fit: [44, 44] } : {}],
              alignment: 'left',
            },
            {
              stack: [
                { text: company.name.toUpperCase(), fontSize: 17, bold: true, color: RED, characterSpacing: 1.5 },
                { text: company.tagline ?? '', fontSize: 9, color: GRAY, italic: true },
                { text: company.address ?? '', fontSize: 8, color: DARK, margin: [0, 3, 0, 0] },
                {
                  text: `${company.phone ?? ''}${company.email ? `   •   ${company.email}` : ''}`,
                  fontSize: 8,
                  color: DARK,
                },
                company.registration_no ? { text: `Reg No: ${company.registration_no}`, fontSize: 8, color: GRAY } : {},
              ],
              alignment: 'left',
            },
            {
              stack: [
                { text: 'MONTHLY REPORT', fontSize: 11, bold: true, color: '#FFFFFF', alignment: 'center' },
                { text: meta.month_name.toUpperCase(), fontSize: 11, bold: true, color: '#FFFFFF', alignment: 'center' },
                { text: period, fontSize: 12, bold: true, color: '#FFFFFF', alignment: 'center' },
                { text: `Generated ${meta.generated_at.slice(0, 19).replace('T', ' ')}`, fontSize: 7.5, color: '#FFFFFF', alignment: 'center' },
                { text: `Backup v${meta.backup_version ?? 2}`, fontSize: 7.5, color: '#FFFFFF', alignment: 'center', margin: [0, 4, 0, 0] },
              ],
              fillColor: RED,
            },
          ],
        ],
      },
      layout: { hLineWidth: () => 0.6, vLineWidth: () => 0, hLineColor: () => RED, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 2, paddingBottom: () => 2 },
      margin: [0, 0, 0, 8],
    },

    { text: 'EXECUTIVE SUMMARY', fontSize: 11, bold: true, color: RED, margin: [0, 4, 0, 4] },
    kpiGrid([
      { label: 'INCOME', value: money(totals.income), sub: `${workDays} active day(s)`, tone: 'green' },
      { label: 'EXPENSES', value: money(totals.expenses), sub: `${expenseRatio} of income`, tone: 'red' },
      { label: 'NET', value: money(totals.net), sub: `${netMargin} margin`, tone: totals.net >= 0 ? 'green' : 'red' },
      { label: 'AVG / DAY', value: money(avgIncome), sub: `net ${money(avgNet)}/day`, tone: 'blue' },
    ]),
    kpiGrid([
      { label: 'BILLS RAISED', value: money(totals.bills), sub: `${snapshot.bills.length} bill(s)`, tone: 'blue' },
      { label: 'OUTSTANDING', value: money(totals.bill_balance), sub: `${collectedPct} collected`, tone: 'amber' },
      { label: 'PAYMENTS IN', value: money(paymentsTotal), sub: `totals ${money(totals.payments)}`, tone: 'green' },
      { label: 'SALARY PAID', value: money(salaryTotal), sub: `${snapshot.salary_slips.length} slip(s)`, tone: 'indigo' },
    ]),
    kpiGrid([
      { label: 'GP PIECES IN', value: String(totals.gatepass_pieces), sub: `${snapshot.gatepasses.length} gate pass(es)`, tone: 'blue' },
      { label: 'PIECES OUT', value: String(totals.deliveries_pieces), sub: `${deliveredPct} delivered`, tone: 'teal' },
      { label: 'PRESENT', value: String(att.present), sub: `${attRate} of ${attTotal}`, tone: 'green' },
      { label: 'LEAVE / HOLIDAY', value: `${att.leave} / ${att.holiday}`, sub: 'staff days', tone: 'amber' },
    ]),
    { text: 'Net = ledger income − ledger expenses. Bill / payment / salary / linen figures are operational activity and are not added to the accounting net. Percentages are of the month totals shown; weekly charts sum the per-day aggregates.', fontSize: 7, color: GRAY, italics: true, margin: [0, 3, 0, 8] },

    // ── Charts ─────────────────────────────────────────────────────────────
    miniHeading('FINANCIAL TREND BY WEEK'),
    groupedBars({
      series: [
        { name: 'Income', color: GREEN, values: finWeek.values },
        { name: 'Expenses', color: RED, values: expWeek.values },
        { name: 'Net', color: DARK, values: netWeek.values },
      ],
      labels: weekLabels,
    }),

    miniHeading('BILLING & COLLECTIONS BY WEEK'),
    groupedBars({
      series: [
        { name: 'Bills raised', color: BLUE, values: billWeek.values },
        { name: 'Payments received', color: GREEN, values: payWeek.values },
      ],
      labels: weekLabels,
    }),
    { text: `Collected ${collectedPct} of bills raised in the month (outstanding ${money(totals.bill_balance)}).`, fontSize: 7, color: GRAY, margin: [0, 2, 0, 4] },

    miniHeading('LINEN FLOW BY WEEK'),
    groupedBars({
      series: [
        { name: 'Received (gate passes)', color: BLUE, values: gpWeek.values },
        { name: 'Delivered', color: TEAL, values: delWeek.values },
      ],
      labels: weekLabels,
    }),
    { text: `Delivery completion ${deliveredPct} of received pieces for the month.`, fontSize: 7, color: GRAY, margin: [0, 2, 0, 4] },
  ]

  // ── Day-by-day ───────────────────────────────────────────────────────────
  content.push(sectionTitle(2, 'Day-by-Day Activity', `${daily.length} active day(s) • ${money(totals.income)} income`))
  if (daily.length === 0) {
    content.push(noData('No activity recorded for this month.'))
  } else {
    const sumOf = (k: keyof (typeof daily)[number]) => daily.reduce((s, d) => s + (Number(d[k]) || 0), 0)
    content.push(
      dataTable({
        header: ['Date', 'Income', 'Expenses', 'Net', 'Bills', 'Payments', 'GP Pcs', 'Del Pcs', 'Present'],
        widths: [58, 60, 60, 58, 60, 60, 50, 50, 44],
        alignments: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'center'],
        body: daily.map(d => [
          d.date,
          money(d.income),
          money(d.expenses),
          money(d.income - d.expenses),
          money(d.bills),
          money(d.payments),
          String(d.gatepass_pieces),
          String(d.deliveries_pieces),
          String(d.present),
        ]),
        totals: [
          'Total',
          money(sumOf('income')),
          money(sumOf('expenses')),
          money(sumOf('income') - sumOf('expenses')),
          money(sumOf('bills')),
          money(sumOf('payments')),
          String(sumOf('gatepass_pieces')),
          String(sumOf('deliveries_pieces')),
          String(sumOf('present')),
        ],
      }),
      { text: `Month totals track the ledger & operational activity above. Peak income day ${String(daily.reduce((a, b) => (b.income > a.income ? b : a)).date)}.`, fontSize: 7, color: GRAY, margin: [0, 4, 0, 0] }
    )
  }

  // ── Income ──────────────────────────────────────────────────────────────
  content.push(sectionTitle(3, 'Income (Ledger)', `${snapshot.income.length} entries • ${money(totals.income)}`))
  if (!sourceOk(snapshot, 'income')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'income')?.error))
  } else if (snapshot.income.length === 0) {
    content.push(noData('No income recorded this month.'))
  } else {
    const byCustomer = new Map<string, number>()
    const bySource = new Map<string, number>()
    for (const r of snapshot.income) {
      byCustomer.set(r.customer ?? 'Other', (byCustomer.get(r.customer ?? 'Other') ?? 0) + r.amount)
      bySource.set(r.source ?? 'Other', (bySource.get(r.source ?? 'Other') ?? 0) + r.amount)
    }
    content.push(
      dataTable({
        header: ['No', 'Date', 'Customer', 'Description', 'Source', 'Amount', '% of income'],
        widths: [22, 52, '*', '*', 50, 64, 42],
        alignments: ['left', 'left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.income.map((r, i) => [
          String(i + 1),
          r.date,
          r.customer ?? '—',
          r.description ?? '—',
          r.source ?? '—',
          money(r.amount),
          pct(r.amount, totals.income),
        ]),
        totals: totalsRow('Total', '100%', ['', '', '', '', money(totals.income)]),
      }),
      breakdownBars('By customer', [...byCustomer.entries()].map(([label, value]) => ({ label, value, color: BLUE })), { maxBars: 8 }),
      breakdownBars('By source', [...bySource.entries()].map(([label, value]) => ({ label, value, color: INDIGO })), { maxBars: 6 })
    )
  }

  // ── Expenses ────────────────────────────────────────────────────────────
  content.push(sectionTitle(4, 'Expenses', `${snapshot.expenses.length} entries • ${money(totals.expenses)}`))
  if (!sourceOk(snapshot, 'expenses')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'expenses')?.error))
  } else if (snapshot.expenses.length === 0) {
    content.push(noData('No expenses recorded this month.'))
  } else {
    const byCat = new Map<string, number>()
    for (const r of snapshot.expenses) byCat.set(r.category ?? 'Other', (byCat.get(r.category ?? 'Other') ?? 0) + r.amount)
    content.push(
      dataTable({
        header: ['No', 'Date', 'Category', 'Description', 'Payee', 'Amount', '% of expenses'],
        widths: [22, 52, 70, '*', 58, 64, 42],
        alignments: ['left', 'left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.expenses.map((r, i) => [
          String(i + 1),
          r.date,
          r.category ?? '—',
          r.description ?? '—',
          r.payee ?? '—',
          money(r.amount),
          pct(r.amount, totals.expenses),
        ]),
        totals: totalsRow('Total', '100%', ['', '', '', '', money(totals.expenses)]),
      }),
      breakdownBars('By category', [...byCat.entries()].map(([label, value]) => ({ label, value, color: RED })), { maxBars: 8 })
    )
  }

  // ── Attendance ───────────────────────────────────────────────────────────
  content.push(sectionTitle(5, 'Attendance', `${attTotal} record(s) • ${attRate} present`))
  if (!sourceOk(snapshot, 'attendance')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'attendance')?.error))
  } else if (snapshot.attendance.length === 0) {
    content.push(noData('No attendance recorded this month.'))
  } else {
    content.push(
      segmentedBar(
        [
          { name: 'Present', value: att.present, color: GREEN },
          { name: 'Leave', value: att.leave, color: AMBER },
          { name: 'Holiday', value: att.holiday, color: GRAY },
          ...(att.other > 0 ? [{ name: 'Other', value: att.other, color: RED }] : []),
        ],
        'Month'
      ),
      dataTable({
        header: ['Date', 'Employee', 'Status', 'OT (hrs)'],
        widths: [58, '*', 120, 56],
        alignments: ['left', 'left', 'center', 'right'],
        body: snapshot.attendance.map(r => [
          r.date,
          r.employee_name,
          r.status,
          r.overtime_hours ? String(r.overtime_hours) : '—',
        ]),
      })
    )
  }

  // ── Payroll ─────────────────────────────────────────────────────────────
  content.push(sectionTitle(6, 'Payroll — salary slips paid in month', `${snapshot.salary_slips.length} slip(s) • ${money(salaryTotal)}`))
  if (!sourceOk(snapshot, 'salary')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'salary')?.error))
  } else if (snapshot.salary_slips.length === 0) {
    content.push(noData('No salary slips paid in this month.'))
  } else {
    const grossSum = snapshot.salary_slips.reduce((sum, s) => sum + s.gross, 0)
    const dedSum = snapshot.salary_slips.reduce((sum, s) => sum + s.deductions, 0)
    content.push(
      dataTable({
        header: ['No', 'Employee', 'Period', 'Gross', 'Deductions', 'Net', 'Paid'],
        widths: [22, '*', 120, 56, 56, 56, 60],
        alignments: ['left', 'left', 'left', 'right', 'right', 'right', 'left'],
        body: snapshot.salary_slips.map((r, i) => [
          String(i + 1),
          r.employee_name,
          r.period_start && r.period_end ? `${r.period_start} → ${r.period_end}` : '—',
          money(r.gross),
          money(r.deductions),
          money(r.net),
          r.paid_date ?? '—',
        ]),
        totals: totalsRow('Total', '', ['', money(grossSum), money(dedSum), money(salaryTotal), '']),
      })
    )
  }

  // ── Bills ────────────────────────────────────────────────────────────────
  content.push(sectionTitle(7, 'Bills', `${snapshot.bills.length} bill(s) • ${money(totals.bills)} • ${collectedPct} collected`))
  if (!sourceOk(snapshot, 'bills')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'bills')?.error))
  } else if (snapshot.bills.length === 0) {
    content.push(noData('No bills raised this month.'))
  } else {
    const itemsTotal = snapshot.bills.reduce((sum, b) => sum + b.items_count, 0)
    const byClient = new Map<string, number>()
    for (const b of snapshot.bills) byClient.set(b.client_name, (byClient.get(b.client_name) ?? 0) + b.balance)
    content.push(
      dataTable({
        header: ['Date', 'Bill No', 'Client', 'Items', 'Total', 'Balance', 'Status'],
        widths: [54, '*', '*', 34, 56, 56, 62],
        alignments: ['left', 'left', 'left', 'right', 'right', 'right', 'center'],
        body: snapshot.bills.map(b => [b.date, b.bill_id || '—', b.client_name, String(b.items_count), money(b.total), money(b.balance), statusCell(b.payment_status || '—')]),
        totals: totalsRow('Total', `${collectedPct} collected`, [String(itemsTotal), money(totals.bills), money(totals.bill_balance), '']),
      }),
      breakdownBars('Outstanding by client', [...byClient.entries()].filter(([, v]) => v > 0).map(([label, value]) => ({ label, value, color: AMBER })), { maxBars: 8 })
    )
  }

  // ── Payments received ───────────────────────────────────────────────────
  content.push(sectionTitle(8, 'Payments Received', `${snapshot.payments.length} payment(s) • ${money(paymentsTotal)}`))
  if (!sourceOk(snapshot, 'payments')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'payments')?.error))
  } else if (snapshot.payments.length === 0) {
    content.push(noData('No payments received this month.'))
  } else {
    const byMethod = new Map<string, number>()
    for (const p of snapshot.payments) byMethod.set(p.method ?? 'Other', (byMethod.get(p.method ?? 'Other') ?? 0) + p.amount)
    content.push(
      dataTable({
        header: ['Date', 'Customer', 'Method', 'Reference', 'Amount', '% of payments'],
        widths: [54, '*', 64, 90, 60, 42],
        alignments: ['left', 'left', 'left', 'left', 'right', 'right'],
        body: snapshot.payments.map(p => [p.date, p.customer ?? '—', p.method ?? '—', p.ref ?? '—', money(p.amount), pct(p.amount, paymentsTotal)]),
        totals: totalsRow('Total', '100%', ['', '', money(paymentsTotal)]),
      }),
      breakdownBars('By method', [...byMethod.entries()].map(([label, value]) => ({ label, value, color: TEAL })), { maxBars: 6 })
    )
  }

  // ── Shop bills ──────────────────────────────────────────────────────────
  content.push(sectionTitle(9, 'Shop Bills', `${snapshot.shop_bills.length} bill(s)`))
  if (!sourceOk(snapshot, 'shop_bills')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'shop_bills')?.error))
  } else if (snapshot.shop_bills.length === 0) {
    content.push(noData('No shop bills this month.'))
  } else {
    const shopTotal = snapshot.shop_bills.reduce((s, b) => s + b.total, 0)
    const shopBal = snapshot.shop_bills.reduce((s, b) => s + b.balance, 0)
    const shopCol = pct(shopTotal - shopBal, shopTotal)
    content.push(
      dataTable({
        header: ['Date', 'Bill No', 'Client', 'Total', 'Balance', 'Status'],
        widths: [54, '*', '*', 56, 56, 66],
        alignments: ['left', 'left', 'left', 'right', 'right', 'center'],
        body: snapshot.shop_bills.map(b => [b.date, b.bill_id || '—', b.client_name, money(b.total), money(b.balance), statusCell(b.status || '—')]),
        totals: totalsRow('Total', `${shopCol} collected`, ['', money(shopTotal), money(shopBal), '']),
      })
    )
  }

  // ── Legacy invoices ─────────────────────────────────────────────────────
  content.push(sectionTitle(10, 'Legacy Invoices', `${snapshot.legacy_invoices.length} invoice(s)`))
  if (!sourceOk(snapshot, 'legacy_invoices')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'legacy_invoices')?.error))
  } else if (snapshot.legacy_invoices.length === 0) {
    content.push(noData('No legacy invoices this month.'))
  } else {
    const legacyTotal = snapshot.legacy_invoices.reduce((s, b) => s + b.total, 0)
    content.push(
      dataTable({
        header: ['Date', 'Invoice No', 'Shop', 'Total', 'Status'],
        widths: [54, '*', '*', 62, 62],
        alignments: ['left', 'left', 'left', 'right', 'center'],
        body: snapshot.legacy_invoices.map(b => [b.date, b.invoice_id || '—', b.client_name, money(b.total), b.status ?? '—']),
        totals: totalsRow('Total', '', ['', money(legacyTotal), '']),
      })
    )
  }

  // ── Linen activity ──────────────────────────────────────────────────────
  content.push(sectionTitle(11, 'Linen Activity', `${totals.gatepass_pieces} received • ${totals.deliveries_pieces} delivered • ${deliveredPct} completion`))
  content.push(miniHeading('GATE PASSES RECEIVED'))
  if (!sourceOk(snapshot, 'gatepasses')) {
    content.push(sourceFailed(snapshot.sources.find(s => s.key === 'gatepasses')?.error))
  } else if (snapshot.gatepasses.length === 0) {
    content.push(noData('—'))
  } else {
    content.push(
      dataTable({
        header: ['Date', 'GP No', 'Customer', 'Pieces', 'Delivered'],
        widths: [54, '*', '*', 56, 60],
        alignments: ['left', 'left', 'left', 'right', 'center'],
        body: snapshot.gatepasses.map(g => [g.receiving_date, g.gp_id || '—', g.customer, String(g.total_pieces), g.delivered ? 'Yes' : 'No']),
        totals: totalsRow('Total', '', [String(totals.gatepass_pieces), '']),
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
        header: ['Date', 'Delivery No', 'Gate Pass', 'Customer', 'Pieces'],
        widths: [54, '*', 70, '*', 56],
        alignments: ['left', 'left', 'left', 'left', 'right'],
        body: snapshot.deliveries.map(d => [d.delivery_date, d.delivery_id || '—', d.gp_id ?? '—', d.customer, String(d.total_pieces)]),
        totals: totalsRow('Total', '', [String(snapshot.deliveries.reduce((s, d) => s + d.total_pieces, 0)), '']),
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
        header: ['Date', 'Return No', 'Gate Pass', 'Customer', 'Items'],
        widths: [54, '*', 70, '*', '*'],
        alignments: ['left', 'left', 'left', 'left', 'left'],
        body: snapshot.returns.map(r => [r.date, r.return_id || '—', r.gp_id ?? '—', r.customer, r.items.map(i => `${i.name} ×${i.quantity}`).join(', ') || '—']),
        totals: totalsRow('Total', '', [String(retItems), '']),
      })
    )
  }

  // ── Linen status ────────────────────────────────────────────────────────
  content.push(sectionTitle(12, 'Linen Stock Status'))
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
        ? { text: 'Snapshot limited to the first 5,000 linen records.', fontSize: 7, color: AMBER, margin: [0, 3, 0, 0] }
        : {}
    )
  }

  // ── Source health ───────────────────────────────────────────────────────
  if (failedSources.length > 0) {
    content.push(sectionTitle(13, 'Data Sources With Issues'))
    content.push({
      text: failedSources.map(s => `• ${s.label}: ${s.error ?? 'failed'}`).join('\n'),
      fontSize: 8,
      color: AMBER,
      margin: [0, 0, 0, 6],
    })
  }

  const doc: Record<string, unknown> = {
    pageSize: 'A4',
    pageMargins: [32, 30, 32, 44],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: DARK },
    content: content as unknown[],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `${company.name}  •  Monthly Report ${period}`, fontSize: 7, color: GRAY, alignment: 'left', margin: [32, 0, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, fontSize: 7, color: GRAY, alignment: 'right', margin: [0, 0, 32, 0] },
      ],
      margin: [0, 10, 0, 0],
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