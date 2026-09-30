import { useState, useRef, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import JsBarcode from 'jsbarcode'
import { useGenerateTags } from '../hooks/useLinen'
import { LINEN_CATEGORIES } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Printer, Plus, Loader2, CheckCircle } from 'lucide-react'

interface TagItem {
  linen_id: string
  category: string
  item_type: string
  client_name: string
}

function generateBarcodeSvgString(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, { format: 'CODE128', width: 1.5, height: 30, displayValue: false, margin: 0 })
  return svg.outerHTML
}

function TagCard({ tag, onReady }: { tag: TagItem; onReady?: (linenId: string, qrSvg: string) => void }) {
  const barcodeRef = useRef<SVGSVGElement>(null)
  const qrRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, tag.linen_id, {
        format: 'CODE128',
        width: 1.5,
        height: 30,
        displayValue: false,
        margin: 0,
      })
    }
  }, [tag.linen_id])

  useEffect(() => {
    if (qrRef.current && onReady) {
      const svgEl = qrRef.current.querySelector('svg')
      if (svgEl) {
        onReady(tag.linen_id, svgEl.outerHTML)
      }
    }
  }, [tag.linen_id, onReady])

  return (
    <div className="border-2 border-black p-3 flex flex-col items-center gap-1 bg-white" style={{ width: '70mm', height: '38mm', pageBreakInside: 'avoid' }}>
      <p className="text-[8px] font-bold uppercase tracking-widest">Love Laundry</p>
      <div ref={qrRef}><QRCodeSVG value={tag.linen_id} size={50} level="M" /></div>
      <svg ref={barcodeRef} style={{ width: '80%', height: 20 }} />
      <p className="text-[9px] font-bold font-mono tracking-wider">{tag.linen_id}</p>
    </div>
  )
}

export default function LinenTagGenerator() {
  const [category, setCategory] = useState('BEDSHEET')
  const [itemType, setItemType] = useState('')
  const [clientName, setClientName] = useState('')
  const [quantity, setQuantity] = useState(10)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [department, setDepartment] = useState('')
  const [generatedTags, setGeneratedTags] = useState<TagItem[]>([])
  const [qrSvgs, setQrSvgs] = useState<Record<string, string>>({})
  const generateMutation = useGenerateTags()

  const handleQrReady = useCallback((linenId: string, svg: string) => {
    setQrSvgs(prev => {
      if (prev[linenId] === svg) return prev
      return { ...prev, [linenId]: svg }
    })
  }, [])

  const handleGenerate = () => {
    if (!itemType || !clientName || quantity <= 0) return
    setQrSvgs({})
    generateMutation.mutate(
      { category, item_type: itemType, client_name: clientName, quantity, size: size || undefined, color: color || undefined, department: department || undefined },
      {
        onSuccess: (data) => {
          setGeneratedTags(data.items.map(i => ({
            linen_id: i.linen_id,
            category: i.category,
            item_type: i.item_type,
            client_name: i.client_name,
          })))
        },
      }
    )
  }

  const allQrReady = generatedTags.length > 0 && generatedTags.every(t => qrSvgs[t.linen_id])

  const handlePrint = useCallback(() => {
    if (!allQrReady) return

    const tagCards = generatedTags.map(tag => {
      const qrSvg = qrSvgs[tag.linen_id] || ''
      const barcodeSvg = generateBarcodeSvgString(tag.linen_id)
      return `
        <div class="tag-card">
          <div class="tag-brand">LOVE LAUNDRY</div>
          <div class="tag-qr">${qrSvg}</div>
          <div class="tag-barcode">${barcodeSvg}</div>
          <div class="tag-id">${tag.linen_id}</div>
        </div>
      `
    }).join('')

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printDate = new Date().toLocaleDateString()

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Linen Tags</title>
<style>
  @page { size: A4; margin: 8mm; }
  body { margin: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; }
  .print-header {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid #000; padding-bottom: 2mm; margin-bottom: 4mm;
    font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
  }
  .print-header .muted { font-weight: normal; color: #4B5563; letter-spacing: 0; text-transform: none; }
  .tags-grid { display: flex; flex-wrap: wrap; gap: 2.5mm; }
  .tag-card {
    border: 2px solid #000; padding: 2.5mm; width: 63mm; height: 33mm;
    display: flex; flex-direction: column; align-items: center; gap: 1mm;
    box-sizing: border-box; page-break-inside: avoid; background: #fff;
  }
  .tag-brand { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; font-family: 'Courier New', monospace; }
  .tag-qr { display: flex; justify-content: center; }
  .tag-qr svg { display: block; }
  .tag-barcode { width: 80%; }
  .tag-barcode svg { width: 100%; height: 22px; }
  .tag-id { font-size: 9px; font-weight: bold; letter-spacing: 1px; font-family: 'Courier New', monospace; }
</style></head><body>
<div class="print-header"><span>LOVE LAUNDRY — Linen Tags</span><span class="muted">Printed ${printDate}</span></div>
<div class="tags-grid">${tagCards}</div>
<script>
  setTimeout(function() { window.print(); }, 300);
<\/script></body></html>`)
    printWindow.document.close()
  }, [generatedTags, qrSvgs, allQrReady])

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Tag Generator' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>Generate Linen Tags</h1>
          <p className="text-sm text-[var(--text-muted)]">Create linen IDs and preview printable tags</p>
        </div>
        {generatedTags.length > 0 && (
          <Button onClick={handlePrint} disabled={!allQrReady}>
            <Printer size={16} className="mr-2" />
            {allQrReady ? `Print ${generatedTags.length} Tags` : 'Loading...'}
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Form */}
        <Card className="lg:w-96 border border-[var(--border)] shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors">
                {LINEN_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Item Type *</label>
              <input value={itemType} onChange={e => setItemType(e.target.value)} placeholder="e.g. King Bedsheet"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Client / Hotel *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Hotel Riu"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Quantity *</label>
              <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} max={10000}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Size</label>
                <input value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. King"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Color</label>
                <input value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. White"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Department</label>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Housekeeping"
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors" />
            </div>
            <Button onClick={handleGenerate} disabled={!itemType || !clientName || quantity <= 0 || generateMutation.isPending} className="w-full">
              <Plus size={16} className="mr-2" />
              {generateMutation.isPending ? 'Generating...' : `Generate ${quantity} Tags`}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="flex-1">
          {generatedTags.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {allQrReady ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-semibold">
                    <CheckCircle size={12} /> {generatedTags.length} tags ready to print
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                    <Loader2 size={12} className="animate-spin" /> Preparing preview...
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {generatedTags.map(tag => <TagCard key={tag.linen_id} tag={tag} onReady={handleQrReady} />)}
              </div>
            </div>
          ) : (
            <Card className="border border-[var(--border)] shadow-sm">
              <CardContent className="p-12 text-center">
                <Printer size={40} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
                <p className="text-sm text-[var(--text-muted)]">Fill in the form and click Generate to preview tags</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
