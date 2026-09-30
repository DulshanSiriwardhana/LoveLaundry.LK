import { useState, useRef } from 'react'
import { useBulkScan } from '../hooks/useLinen'
import { SCAN_ACTIONS } from '../../../types/linen'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Zap, CheckCircle, AlertTriangle, Trash2, X, Loader2, ArrowRight } from 'lucide-react'

export default function LinenBulkScan() {
  const [codes, setCodes] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [action, setAction] = useState('receive')
  const [location, setLocation] = useState('')
  const [skipped, setSkipped] = useState(0)
  const [sessionTotal, setSessionTotal] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bulkMutation = useBulkScan()
  const selectedAction = SCAN_ACTIONS.find(a => a.value === action)

  const addCode = () => {
    const raw = input.trim().toUpperCase()
    if (!raw) return
    const parts = raw.split(/[\n\s]+/).filter(Boolean)
    const fresh = parts.filter(c => !codes.includes(c))
    setCodes(prev => [...prev, ...fresh])
    setSkipped(parts.length - fresh.length)
    setInput('')
    inputRef.current?.focus()
  }

  const removeCode = (code: string) => setCodes(prev => prev.filter(c => c !== code))
  const clearAll = () => { setCodes([]); setInput(''); setSkipped(0) }

  const handleBulkScan = () => {
    if (!codes.length) return
    setSessionTotal(codes.length)
    bulkMutation.mutate(
      { codes, action, location: location || undefined },
      { onSuccess: () => { setCodes([]); setSkipped(0) } }
    )
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Linen' }, { label: 'Bulk Scan' }]} />

      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: '"Spectral", Georgia, serif' }}>
          Bulk Scan
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Process multiple linens with a single action</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left — input */}
        <div className="flex-1 space-y-4">
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Action</label>
                <div className="flex gap-3 items-center">
                  <select
                    value={action}
                    onChange={e => setAction(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors"
                  >
                    {SCAN_ACTIONS.map(sa => <option key={sa.value} value={sa.value}>{sa.label}</option>)}
                  </select>
                  {selectedAction && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ color: selectedAction.color, backgroundColor: selectedAction.color + '14' }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedAction.color }} />
                      {selectedAction.label}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">Location (optional)</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Hotel Floor 3, Room 301"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5 block">
                  Linen IDs ({codes.length} added)
                </label>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCode() }
                  }}
                  placeholder={"Enter linen IDs, one per line or space-separated...\ne.g. LL-7K4P92 LL-82M7QF"}
                  rows={4}
                  className="w-full px-3 py-2 text-sm font-mono border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-colors"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={addCode} disabled={!input.trim()}>Add</Button>
                  <Button variant="outline" size="sm" onClick={clearAll} disabled={!codes.length}><Trash2 size={12} className="mr-1" />Clear All</Button>
                  {skipped > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <AlertTriangle size={12} /> {skipped} duplicate(s) skipped
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleBulkScan}
            disabled={codes.length === 0 || bulkMutation.isPending}
            className="w-full h-11"
            size="lg"
          >
            {bulkMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
            {bulkMutation.isPending ? `Processing ${sessionTotal} Items...` : `Process ${codes.length} Items`}
          </Button>
        </div>

        {/* Right — queue + results */}
        <div className="lg:w-80 space-y-4">
          {/* Queued codes */}
          <Card className="border border-[var(--border)] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Queued ({codes.length})</p>
                {selectedAction && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: selectedAction.color }}>{selectedAction.label}</span>
                )}
              </div>
              {codes.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No codes queued yet</p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mb-2">Press Enter while typing to add codes quickly</p>
              )}
              {codes.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {codes.map((code) => (
                    <div key={code} className="flex items-center justify-between text-xs font-mono py-1.5 px-2 rounded bg-[var(--surface)] border border-[var(--border)]">
                      <span className="text-[var(--text-primary)]">{code}</span>
                      <button onClick={() => removeCode(code)} className="text-[var(--text-muted)] hover:text-red-500 transition-colors"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {bulkMutation.data && (
            <Card className="border border-[var(--border)] shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Last Result</p>
                  <span className="text-[10px] text-[var(--text-muted)]">{sessionTotal} submitted</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle size={12} /> {bulkMutation.data.total_processed} processed
                  </span>
                  {bulkMutation.data.total_errors > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                      <AlertTriangle size={12} /> {bulkMutation.data.total_errors} errors
                    </span>
                  )}
                </div>
                {bulkMutation.data.processed?.length > 0 && (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Processed</p>
                    {bulkMutation.data.processed.map((p: any) => (
                      <div key={p.linen_id} className="flex items-center gap-2 text-xs font-mono py-1.5 px-2 rounded bg-[var(--surface)] border border-[var(--border)]">
                        <CheckCircle size={13} className="text-green-600 flex-shrink-0" />
                        <span className="text-[var(--text-primary)] font-semibold">{p.linen_id}</span>
                        <span className="ml-auto text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          {p.from_status}<ArrowRight size={10} />{p.to_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {bulkMutation.data.errors?.length > 0 && (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Errors</p>
                    {bulkMutation.data.errors.map((e: any) => (
                      <div key={e.linen_id} className="flex items-start gap-2 text-xs font-mono py-1.5 px-2 rounded bg-red-50 border border-red-100">
                        <AlertTriangle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[var(--text-primary)] font-semibold">{e.linen_id}</p>
                          <p className="text-[10px] text-red-600">{e.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}