import type { DailyReportSnapshot, MonthlyReportSnapshot } from './types'

// ── Brand palette ─────────────────────────────────────────────────────────────
export const RED = '#C42127'
export const DARK = '#1F2937'
export const GRAY = '#6B7280'
export const LIGHT = '#F3F4F6'
export const BORDER = '#E5E7EB'
export const GREEN = '#15803D'
export const AMBER = '#B45309'
export const BLUE = '#2563EB'
export const INDIGO = '#5B21B6'
export const TEAL = '#0D9488'
export const SKY = '#0284C7'
export const FADED = '#CBD5E1'

const TONES: Record<string, string> = {
  red: RED,
  green: GREEN,
  amber: AMBER,
  blue: BLUE,
  gray: GRAY,
  indigo: INDIGO,
  teal: TEAL,
  sky: SKY,
  dark: DARK,
  white: '#FFFFFF',
}

export function tone(color: string | undefined): string {
  return (color && TONES[color]) || color || DARK
}

// ── Number helpers ────────────────────────────────────────────────────────────
export function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  const sign = v < 0 ? '-' : ''
  return `${sign}LKR ${Math.abs(v).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function count(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return v.toLocaleString('en-LK', { maximumFractionDigits: 1 })
}

export function pctVal(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0
}

export function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  const v = Math.round((part / whole) * 1000) / 10
  return `${v}%`
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

// ── Table builder (with optional totals row) ──────────────────────────────────
interface TableOptions {
  header: string[]
  widths: (string | number)[]
  body: (string | number | { text: string; bold?: boolean; color?: string; alignment?: string })[][]
  alignments?: string[]
  totals?: (string | number)[]
}

export function dataTable(opts: TableOptions) {
  const body = [
    opts.header.map(text => ({
      text,
      bold: true,
      fontSize: 9.5,
      color: '#FFFFFF',
      fillColor: RED,
      margin: [5, 5, 5, 5] as [number, number, number, number],
    })),
    ...opts.body.map(row =>
      row.map((cell, c) => ({
        text: cell,
        fontSize: 9.5,
        color: DARK,
        alignment: (opts.alignments?.[c] ?? 'left') as 'left' | 'right' | 'center',
        margin: [5, 4, 5, 4] as [number, number, number, number],
      }))
    ),
  ]
  if (opts.totals) {
    body.push(
      opts.totals.map((cell, c) => ({
        text: cell,
        fontSize: 9.5,
        bold: true,
        color: DARK,
        fillColor: LIGHT,
        alignment: (opts.alignments?.[c] ?? 'left') as 'left' | 'right' | 'center',
        margin: [5, 4, 5, 4] as [number, number, number, number],
      }))
    )
  }
  return {
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === body.length - 1 ? 1 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => BORDER,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
    table: {
      headerRows: 1,
      widths: opts.widths,
      body,
      dontBreakRows: true,
    },
  }
}

// ── Section helpers ───────────────────────────────────────────────────────────
export function sectionTitle(index: number, title: string, subtitle?: string) {
  return {
    columns: [
      { text: [`${index}  `, { text: title.toUpperCase(), bold: true }], fontSize: 13, color: RED, bold: true },
      ...(subtitle
        ? [{ text: subtitle, alignment: 'right' as const, fontSize: 10, color: GRAY, margin: [0, 3, 0, 0] }]
        : []),
    ],
    margin: [0, 12, 0, 5] as [number, number, number, number],
  }
}

export function noData(text: string) {
  return { text, italic: true, fontSize: 10, color: GRAY, margin: [0, 3, 0, 8] }
}

export function sourceFailed(error?: string) {
  return {
    text: `Source unavailable — ${error ?? 'request failed'}`,
    fontSize: 9.5,
    color: AMBER,
    margin: [0, 3, 0, 8] as [number, number, number, number],
  }
}

export function statusCell(value: string | number) {
  return { text: String(value), alignment: 'center' as const }
}

export function miniHeading(text: string) {
  return { text, bold: true, fontSize: 10.5, color: DARK, characterSpacing: 1, margin: [0, 10, 0, 5] }
}

export function note(text: string, color: string = GRAY, bold = false) {
  return { text, fontSize: 7.5, color, bold, margin: [0, 3, 0, 0] }
}

// ── KPI grid ──────────────────────────────────────────────────────────────────
export interface Kpi {
  value: string
  label: string
  sub?: string
  tone?: string
}

export function kpiGrid(kpis: Kpi[], cols = 4) {
  const rows: Kpi[][] = []
  for (let i = 0; i < kpis.length; i += cols) rows.push(kpis.slice(i, i + cols))
  const body = rows.map(row =>
    row.map(k => {
      const color = tone(k.tone ?? 'dark')
      return {
        stack: [
          { text: k.value, bold: true, fontSize: 13, color, alignment: 'center' },
          { text: k.sub && k.sub !== '' ? k.sub : '\u200B', fontSize: 6.8, color: GRAY, alignment: 'center', margin: [0, 1, 0, 0], bold: true, characterSpacing: 0.5 },
          { text: k.label, fontSize: 7.5, color: GRAY, alignment: 'center', bold: true, characterSpacing: 1, margin: [0, 1, 0, 0] },
        ],
        fillColor: LIGHT,
        margin: [3, 6, 3, 6],
      }
    })
  )
  return {
    table: {
      widths: Array.from({ length: cols }, () => '*'),
      body,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: [0, 2, 0, 4],
  }
}

// ── Legend ────────────────────────────────────────────────────────────────────
export interface LegendItem {
  name: string
  color: string
  total?: number
  pctOf?: number
}

export function legend(items: LegendItem[]) {
  return {
    table: {
      widths: items.map(() => '*'),
      body: [
        items.map(it => ({
          columns: [
            { text: '  ', color: it.color, fontSize: 8, width: 7 },
            {
              stack: [
                { text: it.name, fontSize: 7, color: GRAY },
                { text: it.total !== undefined ? money(it.total) : it.pctOf !== undefined ? pct(it.pctOf, items.reduce((s, x) => s + (x.total ?? 0), 0)) : '', fontSize: 6.5, color: DARK, bold: true, margin: [0, 1, 0, 0] },
              ],
              margin: [1, 0, 0, 0],
            },
          ],
          margin: [0, 2, 0, 2],
        })),
      ],
    },
    layout: 'noBorders',
    margin: [4, 4, 4, 0],
  }
}

// ── Bar charts (canvas) ───────────────────────────────────────────────────────
const CHART_W = 505
const PAD_X = 14

function niceCeil(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / pow
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return m * pow
}

export interface ChartSeries {
  name: string
  color: string
  values: number[]
}

export interface BarChartOpts {
  series: ChartSeries[]
  labels: string[]
  plotHeight?: number
  showTotals?: boolean
  valueFormatter?: (n: number) => string
}

export function groupedBars(opts: BarChartOpts): unknown[] {
  const n = opts.labels.length
  if (n === 0 || opts.series.length === 0) return []

  const plotHeight = opts.plotHeight ?? 140
  const maxV = niceCeil(Math.max(...opts.series.flatMap(s => s.values), 1))
  const top = 4
  const bottom = top + plotHeight
  const plotW = CHART_W - PAD_X * 2

  const draw: unknown[] = []
  const impact = 4
  for (let g = 1; g < impact; g++) {
    const y = bottom - (plotHeight * g) / impact
    draw.push({ type: 'line', x1: PAD_X, y1: y, x2: PAD_X + plotW, y2: y, lineColor: '#EEF2F7', lineWidth: 0.5 })
  }

  const groupW = plotW / n
  const slotBarW = Math.max(14, Math.min(30, (groupW * 0.62) / opts.series.length))

  opts.series.forEach((s, si) => {
    s.values.forEach((v, i) => {
      const h = Math.max(0, (Math.max(0, v) / maxV) * plotHeight)
      const base = bottom - h
      const gx = PAD_X + groupW * i
      const off = Math.max(0, (groupW - opts.series.length * slotBarW) / 2)
      const x = gx + off + si * slotBarW
      const rounded = Math.min(3, slotBarW / 2)
      draw.push({
        type: 'rect',
        x: x + 1,
        y: base,
        w: Math.max(2, slotBarW - 2.5),
        h: Math.max(1.5, h),
        color: s.color,
        lineColor: s.color,
        rx: rounded,
        ry: rounded,
      })
    })
  })
  draw.push({ type: 'line', x1: PAD_X, y1: bottom, x2: PAD_X + plotW, y2: bottom, lineColor: FADED, lineWidth: 1 })

  const out: unknown[] = [{ canvas: draw, margin: [0, 2, 0, 0] }]

  out.push({
    table: {
      widths: opts.labels.map(() => `${100 / n}%`),
      body: [opts.labels.map(l => ({ text: l, alignment: 'center' as const, fontSize: 7, color: GRAY }))],
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 1 },
    margin: [PAD_X + 6, 0, PAD_X + 6, 0],
  })

  if (opts.showTotals !== false) {
    out.push(
      legend(
        opts.series.map(s => ({
          name: s.name,
          color: s.color,
          total: s.values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0),
        }))
      )
    )
  }
  return out
}

// ── Single-row segmented bar (attendance, linen status…) ──────────────────────
export interface Segment {
  name: string
  value: number
  color: string
}

export function segmentedBar(segments: Segment[], labelBefore?: string) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total <= 0) return []
  const widths = segments.map(s => {
    const p = pctVal(s.value, total)
    return p < 1 ? 1.5 : p
  })
  const totalW = widths.reduce((s, w) => s + w, 0)
  const bodyRow = [
    ...(labelBefore
      ? [{ text: labelBefore, bold: true, fontSize: 7.5, color: DARK, alignment: 'left' as const }]
      : []),
    ...segments.map((s, i) => ({
      stack: [
        { text: count(s.value), bold: true, fontSize: 8, color: '#FFFFFF', alignment: 'center' as const },
        { text: `${Math.round((widths[i] / Math.max(totalW, 1)) * 10000) / 100}%`, fontSize: 6.5, color: 'rgba(255,255,255,0.9)', alignment: 'center' as const },
      ],
      fillColor: s.color,
      margin: [4, 4, 4, 4],
    })),
  ]
  const widthsArr = labelBefore
    ? [70, ...segments.map((_, i) => `${(widths[i] / Math.max(totalW, 1)) * 100}%`)]
    : segments.map((_, i) => `${(widths[i] / Math.max(totalW, 1)) * 100}%`)

  return [
    {
      table: {
        widths: widthsArr.map(w => w),
        body: [bodyRow],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 2, 0, 2],
    },
    {
      columns: segments.map(s => ({
        text: `${s.name} ${count(s.value)} · ${pct(s.value, total)}`,
        fontSize: 6.8,
        color: tone(colorOf(s.color)),
        alignment: 'center' as const,
        margin: [0, 1, 0, 0],
      })),
      margin: [0, 1, 0, 4],
    } as unknown,
  ]
}

function colorOf(color: string): string {
  const map: Record<string, string> = {
    '#15803D': 'green',
    '#B45309': 'amber',
    '#6B7280': 'gray',
    '#C42127': 'red',
    '#2563EB': 'blue',
    '#5B21B6': 'indigo',
    '#0D9488': 'teal',
    '#0284C7': 'sky',
    '#1F2937': 'dark',
  }
  return map[color] ?? color
}

// ── Horizontal breakdown bars ─────────────────────────────────────────────────
export interface BreakdownItem {
  label: string
  value: number
  color: string
}

export function breakdownBars(title: string, items: BreakdownItem[], opts?: { maxBars?: number }) {
  if (items.length === 0) return [noData('—')]
  const total = items.reduce((s, i) => s + i.value, 0)
  const list = [...items].sort((a, b) => b.value - a.value).slice(0, opts?.maxBars ?? 8)
  const maxW = 200

  const out: unknown[] = [
    { text: title, bold: true, fontSize: 8.5, color: DARK, margin: [0, 6, 0, 1] },
    {
      table: {
        widths: [138, maxW, 78, 42],
        body: [[
          { text: '', fontSize: 7.5 },
          { text: '', fontSize: 7.5 },
          { text: 'Amount', fontSize: 7, bold: true, color: GRAY, alignment: 'right' },
          { text: 'Share', fontSize: 7, bold: true, color: GRAY, alignment: 'right' },
        ]],
      },
      layout: {
        hLineWidth: () => 0.4,
        vLineWidth: () => 0,
        hLineColor: () => BORDER,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
      margin: [0, 0, 0, 1],
    },
  ]

  for (const it of list) {
    const p = pctVal(it.value, total)
    const barW = total > 0 ? Math.max(4, Math.round((p / 100) * maxW)) : 0
    out.push({
      table: {
        widths: [138, barW, 78, 42],
        body: [[
          { text: it.label, fontSize: 8, color: DARK },
          { text: '\u200B', fontSize: 8, fillColor: it.color, margin: [0, 4, 0, 4] },
          { text: money(it.value), fontSize: 8, color: DARK, alignment: 'right' },
          { text: `${round1(p)}%`, fontSize: 8, color: GRAY, alignment: 'right' },
        ]],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingTop: () => 1.5,
        paddingBottom: () => 1.5,
      },
    })
  }

  out.push({ text: `Total ${money(total)}`, bold: true, fontSize: 8, color: DARK, alignment: 'right', margin: [0, 2, 0, 6] })
  return out
}

// ── Week bucketing for monthly reports ────────────────────────────────────────
export function weekBuckets(daily: MonthlyReportSnapshot['daily'], pick: (d: MonthlyReportSnapshot['daily'][number]) => number): { labels: string[]; values: number[] } {
  const buckets = new Map<number, number>()
  for (const d of daily) {
    const day = Number((d.date ?? '').slice(8, 10))
    if (!day) continue
    const wk = Math.min(Math.floor((day - 1) / 7), 4)
    const cur = buckets.get(wk) ?? 0
    buckets.set(wk, cur + (Number.isFinite(pick(d)) ? pick(d) : 0))
  }
  const labels = Array.from({ length: Math.max(1, buckets.size) }, (_, i) => `W${i + 1}`)
  const values = Array.from({ length: labels.length }, (_, i) => buckets.get(i) ?? 0)
  return { labels, values }
}

// ── Source helpers -------------------------------------------------------------
export function sourceOk(snapshot: { sources: { key: string; ok: boolean }[] }, key: string): boolean {
  return snapshot.sources.find(s => s.key === key)?.ok ?? true
}

export function sourceError(snapshot: { sources: { key: string; ok: boolean; error?: string }[] }, key: string): unknown[] {
  return [sourceFailed(snapshot.sources.find(s => s.key === key)?.error)]
}

export function specificTotals<T extends { amount: number }>(rows: T[]): number {
  return rows.reduce((s, r) => s + r.amount, 0)
}

export type AnySnapshot = DailyReportSnapshot | MonthlyReportSnapshot