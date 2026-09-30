import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importApi } from '../api/management-api'
import { toast } from 'sonner'
import { Upload, Download, CheckCircle2, XCircle, FileSpreadsheet, ArrowRight, AlertTriangle } from 'lucide-react'

type Step = 'upload' | 'preview' | 'result'

export default function ImportWizard() {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const previewMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return importApi.preview(fd).then(r => r.data)
    },
    onSuccess: (data) => {
      setPreviewData(data)
      setStep('preview')
    },
    onError: () => toast.error('Failed to preview file'),
  })

  const executeMut = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData()
      fd.append('file', f)
      return importApi.execute(fd).then(r => r.data)
    },
    onSuccess: (data) => {
      setResult(data)
      setStep('result')
      qc.invalidateQueries({ queryKey: ['mgmt-transactions'] })
      qc.invalidateQueries({ queryKey: ['mgmt-dashboard'] })
    },
    onError: () => toast.error('Import failed'),
  })

  const downloadTemplate = async () => {
    try {
      const res = await importApi.downloadTemplate()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'laundry_import_template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download template')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      previewMut.mutate(f)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Historical Data Import Wizard</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
              step === s ? 'bg-red-600 text-white' :
              (['upload', 'preview', 'result'].indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700')
            }`}>
              {['upload', 'preview', 'result'].indexOf(step) > i ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            <span className="capitalize">{s === 'result' ? 'Complete' : s}</span>
            {i < 2 && <ArrowRight size={16} className="text-gray-400 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-8 space-y-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Download the template, fill in your historical data, then upload the completed file.
            </p>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Download size={16} /> Download Excel Template
            </button>
          </div>

          <div className="border-2 border-dashed rounded-xl p-12 text-center hover:border-red-400 transition-colors">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} className="hidden" />
            <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {file ? file.name : 'Click to select file or drag & drop'}
            </p>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              <Upload size={16} className="inline mr-2" /> Select File
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Required columns:</p>
            <p className="text-gray-600 dark:text-gray-300">
              Date, Customer Name, Invoice Number, Item Name, Qty Received, Qty Washed, Qty Delivered, Qty Rejected, Qty Damaged, Rate, Cost, Notes
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && previewData && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Preview ({previewData.total_rows} rows)</h2>
            <div className="flex gap-2">
              <button onClick={() => { setStep('upload'); setFile(null); setPreviewData(null) }}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200">
                Back
              </button>
              <button onClick={() => file && executeMut.mutate(file)} disabled={executeMut.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {executeMut.isPending ? 'Importing...' : `Confirm Import (${previewData.total_rows} rows)`}
              </button>
            </div>
          </div>

          {previewData.errors.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="font-medium">{previewData.errors.length} validation errors found</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {previewData.errors.map((e: any, i: number) => (
                  <p key={i} className="text-red-600 text-xs">Row {e.row}: {e.errors.join(', ')}</p>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">Row</th>
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Customer</th>
                  <th className="px-2 py-2 text-left">Invoice</th>
                  <th className="px-2 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Rate</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewData.preview.map((row: any, i: number) => (
                  <tr key={i} className={`border-t ${row.valid ? '' : 'bg-red-50 dark:bg-red-900/10'}`}>
                    <td className="px-2 py-1.5">{row.row}</td>
                    <td className="px-2 py-1.5">{row.date}</td>
                    <td className="px-2 py-1.5">{row.customer_name}</td>
                    <td className="px-2 py-1.5">{row.invoice_number}</td>
                    <td className="px-2 py-1.5">{row.item_name}</td>
                    <td className="px-2 py-1.5 text-right">{row.qty_washed || row.qty_received}</td>
                    <td className="px-2 py-1.5 text-right">{row.rate}</td>
                    <td className="px-2 py-1.5 text-right">{((row.qty_washed || row.qty_received) * row.rate).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {row.valid ? <CheckCircle2 size={16} className="text-green-500 inline" /> : <XCircle size={16} className="text-red-500 inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 'result' && result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border p-8 text-center space-y-4">
          <CheckCircle2 size={64} className="mx-auto text-green-500" />
          <h2 className="text-xl font-bold">Import Complete!</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-2xl font-bold">{result.total_rows}</p>
              <p className="text-sm text-gray-500">Total Rows</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600">{result.success_rows}</p>
              <p className="text-sm text-gray-500">Imported</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-red-600">{result.error_rows}</p>
              <p className="text-sm text-gray-500">Errors</p>
            </div>
          </div>
          <button onClick={() => { setStep('upload'); setFile(null); setPreviewData(null); setResult(null) }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
