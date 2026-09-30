import type {
  CSSProperties,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react'

/* ─────────────────────────────────────────────────────────────
   Shared primitives for the Camelot gatepass (printable receipt)
   templates. The receipt is rendered as a white A4 sheet with an
   exact black-grid table structure. Quantities/notes are entered
   into inline editable cells that print as plain values.
   ───────────────────────────────────────────────────────────── */

export const RECEIPT_PRINT_STYLE = `
  .gp-cell-input:focus { border-bottom-color: #DC2626 !important; }
  .gp-cell-input::placeholder { color: #B6BEC7; }
  @media print {
    @page { size: A4; margin: 7mm; }
    @page :first { size: A4; margin: 7mm; }
    @page :left { size: A4; margin: 7mm; }
    @page :right { size: A4; margin: 7mm; }
    .gp-page-bg { background: #fff !important; padding: 0 !important; }
    .gp-sheet {
      width: 100% !important; max-width: none !important;
      min-height: auto !important; margin: 0 !important; padding: 0 !important;
      box-shadow: none !important; border-radius: 0 !important;
    }
    .gp-cell-input {
      border-bottom: none !important; background: transparent !important;
      padding: 0 !important; color: #000 !important;
    }
    .gp-hairline { border-bottom-color: #fff !important; }
  }
`

interface EditableCellProps {
  value: string
  onChange: (value: string) => void
  width?: number | string
  align?: 'left' | 'center' | 'right'
  placeholder?: string
  fontSize?: number
  bold?: boolean
  onKeyDown?: (e: ReactKeyboardEvent<HTMLInputElement>) => void
  onPaste?: (e: ReactClipboardEvent<HTMLInputElement>) => void
  className?: string
  style?: CSSProperties
}

export function EditableCell({ value, onChange, width, align = 'center', placeholder, fontSize = 11, bold, onKeyDown, onPaste, className, style }: EditableCellProps) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      className={className ? `gp-cell-input ${className}` : 'gp-cell-input'}
      style={{
        width: width ?? '100%',
        textAlign: align,
        padding: '0 2px',
        background: 'transparent',
        border: 0,
        borderBottom: '1px dashed #9CA3AF',
        outline: 0,
        fontSize,
        lineHeight: '1.2',
        fontWeight: bold ? 700 : 400,
        color: '#111827',
        fontFamily: 'inherit',
        minWidth: 0,
        ...style,
      }}
    />
  )
}

/* Printable A4 sheet wrapper — centered white sheet on screen,
   full-bleed with an @page margin when printed. */
export function ReceiptSheet({ children }: { children: ReactNode }) {
  return (
    <div className="gp-page-bg" style={{ minHeight: '100vh', background: '#E7EAED', padding: '28px 12px 44px', boxSizing: 'border-box' }}>
      <div
        className="gp-sheet"
        style={{
          width: '210mm',
          maxWidth: '100%',
          minHeight: '280mm',
          margin: '0 auto',
          padding: '8mm 7mm',
          background: '#fff',
          boxShadow: '0 2px 18px rgba(17,24,39,0.18)',
          boxSizing: 'border-box',
          color: '#111827',
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface ReceiptHeaderProps {
  title: string
  subtitle: string
  receiptNo: string
  onReceiptNo: (v: string) => void
  date: string
  onDate: (v: string) => void
}

export function ReceiptHeader({ title, subtitle, receiptNo, onReceiptNo, date, onDate }: ReceiptHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        borderBottom: '2px solid #DC2626',
        paddingBottom: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ whiteSpace: 'nowrap', paddingTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>RECEIPT NUMBER: </span>
        <EditableCell value={receiptNo} onChange={onReceiptNo} width={84} bold />
      </div>
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1, lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#DC2626', marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ whiteSpace: 'nowrap', paddingTop: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>DATE: </span>
        <EditableCell value={date} onChange={onDate} width={76} bold />
      </div>
    </div>
  )
}

export interface ReceiptColumn {
  key: string
  label: string
  kind?: 'qty' | 'item'
}

export interface ReceiptRow {
  key: string
  name?: string
  trailing?: boolean
}

export interface RecipSection {
  id: string
  heading?: string
  columns: ReceiptColumn[]
  rows: ReceiptRow[]
}

interface SectionTableProps {
  section: RecipSection
  sectionIndex: number
  cells: Record<string, string>
  setCell: (key: string, value: string) => void
  nameWidth?: string
}

const cellKey = (sectionId: string, rowKey: string, colKey: string) => `${sectionId}.${rowKey}:${colKey}`

export function SectionTable({ section, sectionIndex, cells, setCell, nameWidth = '34%' }: SectionTableProps) {
  const columns = section.columns
  const dataColumns = columns.slice(1)

  return (
    <div style={{ marginBottom: 6 }}>
      <table
        className="gp-table"
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          tableLayout: 'fixed',
          borderTop: sectionIndex === 0 ? '1px solid #000' : '3px double #000',
          fontFamily: 'inherit',
        }}
      >
        <colgroup>
          <col style={{ width: nameWidth }} />
          {dataColumns.map((_c, i) => <col key={i} />)}
        </colgroup>
        <thead>
          {section.heading && (
            <tr>
              <th
                colSpan={columns.length}
                style={{
                  border: '1px solid #000',
                  padding: '4px 6px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  textAlign: 'left',
                  background: '#fff',
                }}
              >
                {section.heading}
              </th>
            </tr>
          )}
          <tr>
            <th
              style={{
                border: '1px solid #000',
                padding: '4px 4px',
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: 0.4,
                textAlign: 'center',
                background: '#fff',
              }}
            >
              {columns[0].label}
            </th>
            {dataColumns.map(c => (
              <th
                key={c.key}
                style={{
                  border: '1px solid #000',
                  padding: '4px 4px',
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  textAlign: 'center',
                  background: '#fff',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map(row => (
            <tr key={row.key}>
              {row.name !== undefined ? (
                <td
                  style={{
                    border: '1px solid #000',
                    padding: '3px 6px',
                    fontSize: 10.5,
                    fontWeight: 500,
                    textAlign: 'left',
                    height: 22,
                  }}
                >
                  <span>{row.name}</span>
                  {row.trailing && (
                    <EditableCell
                      value={cells[cellKey(section.id, row.key, 'name')] ?? ''}
                      onChange={v => setCell(cellKey(section.id, row.key, 'name'), v)}
                      width={64}
                      align="left"
                      placeholder="…"
                    />
                  )}
                </td>
              ) : (
                <td style={{ border: '1px solid #000', padding: 0, height: 22 }}>
                  <EditableCell
                    value={cells[cellKey(section.id, row.key, columns[0].key)] ?? ''}
                    onChange={v => setCell(cellKey(section.id, row.key, columns[0].key), v)}
                    align="left"
                    placeholder=" "
                  />
                </td>
              )}
              {dataColumns.map(c => (
                <td key={c.key} style={{ border: '1px solid #000', padding: 0, height: 22 }}>
                  <EditableCell
                    value={cells[cellKey(section.id, row.key, c.key)] ?? ''}
                    onChange={v => setCell(cellKey(section.id, row.key, c.key), v)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SignatureSection() {
  const rows: { label: string }[] = [
    { label: 'Linen Supervisor' },
    { label: 'Security' },
    { label: 'B. Cloth' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 24,
        marginTop: 26,
        paddingTop: 10,
      }}
    >
      {rows.map(r => (
        <div key={r.label} style={{ flex: 1, textAlign: 'center' }}>
          <div
            className="gp-hairline"
            style={{ height: 30, borderBottom: '1px dashed #9CA3AF' }}
          />
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 5 }}>........................</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{r.label}</div>
        </div>
      ))}
    </div>
  )
}

export function collectCellKeys(sections: RecipSection[]): string[] {
  const keys: string[] = []
  for (const s of sections) {
    for (const row of s.rows) {
      if (row.name !== undefined) {
        if (row.trailing) keys.push(cellKey(s.id, row.key, 'name'))
      } else {
        keys.push(cellKey(s.id, row.key, s.columns[0].key))
      }
      for (const c of s.columns.slice(1)) {
        keys.push(cellKey(s.id, row.key, c.key))
      }
    }
  }
  return keys
}

/* shared small text styles to keep markup readable */
export const thStyle: CSSProperties = {
  border: '1px solid #000',
  padding: '4px 4px',
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textAlign: 'center' as const,
  background: '#fff',
}

export const tdStyle: CSSProperties = {
  border: '1px solid #000',
  padding: 0,
  height: 22,
}

export const nameTdStyle: CSSProperties = {
  border: '1px solid #000',
  padding: '3px 6px',
  fontSize: 10.5,
  fontWeight: 500,
  textAlign: 'left',
  height: 22,
}