import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, RotateCcw, ArrowLeft } from 'lucide-react'
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

const SECTIONS: RecipSection[] = [
  {
    id: 's1',
    columns: [
      { key: 'name', label: '' },
      { key: 'single', label: 'SINGLE' },
      { key: 'double', label: 'DOUBLE' },
      { key: 'orange', label: 'ORANGE' },
      { key: 'blue', label: 'BLUE' },
      { key: 'red', label: 'RED' },
    ],
    rows: [
      { key: '1a', name: 'Bed Sheet' },
      { key: '1b', name: 'Duvet Cover' },
      { key: '1c', name: 'Duvet Cover' },
      { key: '1d', name: 'Blanket' },
      { key: '1e', name: 'Pillow' },
      { key: '1f', name: 'Mattress Protector' },
      { key: '1g', name: 'Pillow Protector' },
      { key: '1h', name: 'Bed Runner - CDX' },
      { key: '1i', name: 'Bed Runner - DBX' },
      { key: '1j', name: 'Bed Runner - SUITE' },
      { key: '1k', name: 'Cushion Cover - Bolster' },
      { key: '1l', name: 'Cushion Cover - Square' },
    ],
  },
  {
    id: 's2',
    columns: [
      { key: 'name', label: '' },
      { key: 'face', label: 'FACE' },
      { key: 'bath', label: 'BATH' },
      { key: 'bathmat', label: 'BATH MAT' },
      { key: 'pool', label: 'POOL' },
      { key: 'hand', label: 'HAND' },
    ],
    rows: [
      { key: '2a', name: 'Towels' },
      { key: '2b', name: 'Spa' },
    ],
  },
  {
    id: 's3',
    columns: [
      { key: 'name', label: '' },
      { key: 'thick', label: 'THICK' },
      { key: 'sheer', label: 'SHEER' },
      { key: 'shower', label: 'SHOWER' },
      { key: 'spa', label: 'SPA' },
    ],
    rows: [{ key: '3a', name: 'Curtain' }],
  },
  {
    id: 's4',
    columns: [
      { key: 'name', label: '' },
      { key: 'grey', label: 'GREY' },
      { key: 'orange', label: 'ORANGE' },
      { key: 'blue', label: 'BLUE' },
      { key: 'red', label: 'RED' },
    ],
    rows: [
      { key: '4a', name: 'Bath robes' },
      { key: '4b', name: 'CDX - Bed side - Cushion cover' },
      { key: '4c', name: 'CDX - Day bed - Back rest cover' },
      { key: '4d', name: 'CDX - Day bed - Mattress cover' },
      { key: '4e', name: 'Cushion Cover - Balcony Chair' },
      { key: '4f', name: 'Cushion Cover - Balcony Sofa' },
      { key: '4g', name: 'Cushion Cover - Chair' },
      { key: '4h', name: 'Cushion Cover - Square pillow' },
      { key: '4i', name: 'Extra bed - Mattress Cover' },
      { key: '4j', name: 'Trolley Bag' },
    ],
  },
  {
    id: 's5',
    columns: [
      { key: 'name', label: '' },
      { key: 'white', label: 'WHITE' },
      { key: 'black', label: 'BLACK' },
      { key: 'red', label: 'RED' },
      { key: 'maroon', label: 'MAROON/GOLD' },
      { key: 'silver', label: 'SILVER' },
      { key: 'blue', label: 'BLUE' },
      { key: 'ash', label: 'ASH' },
    ],
    rows: [
      { key: '5a', name: 'Table Cloth - New' },
      { key: '5b', name: 'Table Cloth - old' },
      { key: '5c', name: 'Table Cloth -', trailing: true },
      { key: '5d', name: 'Serviette' },
      { key: '5e', name: 'Serviette' },
      { key: '5f', name: 'Banquet Chair cover -', trailing: true },
      { key: '5g', name: 'Table Runner' },
      { key: '5h', name: 'Chair Band' },
      { key: '5i', name: 'Frill Cloth -', trailing: true },
      { key: '5j', name: 'Frill Cloth -', trailing: true },
      { key: '5k', name: 'Satin Cloth -', trailing: true },
      { key: '5l', name: 'Slip Cloth -', trailing: true },
    ],
  },
  {
    id: 's6',
    columns: [
      { key: 'name', label: '' },
      { key: 'kit', label: 'KIT' },
      { key: 'fb', label: 'F&B' },
      { key: 'wiping', label: '[WIPING]' },
      { key: 'mop', label: 'MOP' },
      { key: 'dot', label: '.' },
    ],
    rows: [
      { key: '6a', name: 'Cloth' },
      { key: '6b', name: 'Duster' },
    ],
  },
]

export default function CamelotLinenReceipt() {
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
          { label: 'Linen Receipt' },
        ]} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
              Camelot Linen Receipt
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
      </div>

      <ReceiptSheet>
        <style>{RECEIPT_PRINT_STYLE}</style>
        <ReceiptHeader
          title="CAMELOT LINEN LAUNDRY RECEIPT"
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