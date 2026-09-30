import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, RotateCcw, ArrowLeft, AlertTriangle } from 'lucide-react'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Button } from '../../../components/ui/button'
import {
  RECEIPT_PRINT_STYLE,
  ReceiptSheet,
  ReceiptHeader,
  SectionTable,
  SignatureSection,
  collectCellKeys,
  type RecipSection,
} from '../components/receipt-core'

/* ⚠️  DEPARTMENT ROWS ARE A DRAFT — confirm against the printed form.
   These are the only "invented" rows; everything else follows the
   printed structure exactly. Replace with the transcriptions and the
   template locks to the original. */

const UNIFORM_DEPARTMENTS = [
  { key: 'd1', name: 'Waiters' },
  { key: 'd2', name: 'Restaurant' },
  { key: 'd3', name: 'Kitchen' },
  { key: 'd4', name: 'Kitchen Steward' },
  { key: 'd5', name: 'Guest Floor' },
  { key: 'd6', name: 'Housekeeping' },
  { key: 'd7', name: 'Front Office' },
  { key: 'd8', name: 'Laundry / Linen' },
  { key: 'd9', name: 'Banquet' },
  { key: 'd10', name: 'Maintenance' },
  { key: 'd11', name: 'Security' },
  { key: 'd12', name: 'Uniform Store' },
]

const KITCHEN_ITEMS = [
  { key: 'k1', name: 'Chef Jacket' },
  { key: 'k2', name: 'Chef Trousers' },
  { key: 'k3', name: 'Chef Cap' },
]

const SECTIONS: RecipSection[] = [
  {
    id: 'main',
    columns: [
      { key: 'name', label: 'ITEM' },
      { key: 'tshirt', label: 'T SHIRT' },
      { key: 'shirt', label: 'SHIRT' },
      { key: 'trouser', label: 'TROUSER' },
      { key: 'skirt', label: 'SKIRT' },
      { key: 'short', label: 'SHORT' },
    ],
    rows: UNIFORM_DEPARTMENTS,
  },
  {
    id: 'kitchen',
    heading: 'KITCHEN',
    columns: [
      { key: 'name', label: 'ITEM' },
      { key: 'tshirt', label: 'T SHIRT' },
      { key: 'shirt', label: 'SHIRT' },
      { key: 'trouser', label: 'TROUSER' },
      { key: 'skirt', label: 'SKIRT' },
      { key: 'short', label: 'SHORT' },
    ],
    rows: KITCHEN_ITEMS,
  },
  {
    id: 'apron',
    heading: 'APRON',
    columns: [
      { key: 'name', label: 'ITEM' },
      { key: 'black', label: 'BLACK' },
      { key: 'white', label: 'WHITE' },
    ],
    rows: [
      { key: 'a1', name: 'Apron' },
      { key: 'a2' },
    ],
  },
  {
    id: 'misc',
    columns: [
      { key: 'it1', label: 'ITEM', kind: 'item' },
      { key: 'q1', label: 'QTY' },
      { key: 'it2', label: 'ITEM', kind: 'item' },
      { key: 'q2', label: 'QTY' },
      { key: 'it3', label: 'ITEM', kind: 'item' },
      { key: 'q3', label: 'QTY' },
    ],
    rows: [
      { key: 'm1' },
      { key: 'm2' },
      { key: 'm3' },
      { key: 'm4' },
    ],
  },
]

export default function CamelotUniformReceipt() {
  const flow = useEnterFlow<HTMLDivElement>()
  const [receiptNo, setReceiptNo] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-GB'))
  const [cells, setCells] = useState<Record<string, string>>({})
  const allKeys = useMemo(() => collectCellKeys(SECTIONS), [])

  const setCell = (key: string, value: string) =>
    setCells(prev => (prev[key] === value ? prev : { ...prev, [key]: value }))

  const clearAll = () => {
    setCells(Object.fromEntries(allKeys.map(k => [k, ''])))
    setReceiptNo('')
  }

  return (
    <div ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-5">
      <div className="no-print space-y-4">
        <Breadcrumb items={[
          { label: 'Linen', href: '/linen' },
          { label: 'Gate Pass', href: '/linen/gate-pass' },
          { label: 'Uniform Receipt' },
        ]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
              Camelot Uniform Receipt
            </h1>
            <p className="text-sm text-[var(--text-muted)]">Click any cell to type the quantity — print the filled receipt</p>
          </div>
          <div className="flex gap-2">
            <Link to="/linen/gate-pass"><Button variant="outline" size="sm"><ArrowLeft size={14} className="mr-1" />Back</Button></Link>
            <Button variant="outline" size="sm" onClick={clearAll} disabled={!receiptNo && allKeys.every(k => !cells[k])}>
              <RotateCcw size={14} className="mr-1" />Clear
            </Button>
            <Button size="sm" onClick={() => window.print()}><Printer size={14} className="mr-1" />Print</Button>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">DRAFT department rows — needs confirmation</p>
              <p className="text-[13px] mt-0.5">
                I can't view the printed images, so the ITEM column depends on the exact rows you transcribe.
                The rows shown here are placeholders: edit the <span className="font-mono text-xs">UNIFORM_DEPARTMENTS</span> and{' '}
                <span className="font-mono text-xs">KITCHEN_ITEMS</span> arrays in{' '}
                <span className="font-mono text-xs">uniform-receipt.tsx</span>, or send me the printed rows and I'll lock them in.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ReceiptSheet>
        <style>{RECEIPT_PRINT_STYLE}</style>
        <ReceiptHeader
          title="CAMELOT UNIFORM LAUNDRY RECEIPT"
          subtitle="KIMBERLEY HOTELS & RESORTS PVT LTD"
          receiptNo={receiptNo}
          onReceiptNo={setReceiptNo}
          date={date}
          onDate={setDate}
        />

        {SECTIONS.map((section, i) => (
          <SectionTable
            key={section.id}
            section={section}
            sectionIndex={i}
            cells={cells}
            setCell={setCell}
          />
        ))}

        <SignatureSection />
      </ReceiptSheet>
    </div>
  )
}