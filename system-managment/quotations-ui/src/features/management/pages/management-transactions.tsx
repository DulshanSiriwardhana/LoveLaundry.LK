import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi, customersApi } from '../api/management-api'
import { toast } from 'sonner'
import { Eye, Trash2, X, Search, ListChecks, Banknote, TrendingUp } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
import { Badge } from '../../../components/ui/badge'
import { DataTable } from '../../../components/ui/data-table'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { ExportButton } from '../../../components/ui/export-button'
import { Pagination } from '../../../components/ui/pagination'
import { invalidateResource } from '../../../cache/invalidation'

const PAGE_SIZE = 20

const LIST_LIMIT = 500

export default function ManagementTransactions() {
  const qc = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [search, setSearch] = useState('')
  const [viewTxn, setViewTxn] = useState<any>(null)
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE

  useEffect(() => {
    setOffset(0)
  }, [startDate, endDate, customerId, search])

  const { data: customersData = { items: [] } } = useQuery({
    queryKey: ['mgmt-customers-list'],
    queryFn: () => customersApi.list('', LIST_LIMIT, 0).then(r => r.data),
  })

  const customers = customersData.items

  const { data: transactions = { items: [], total: 0 }, isLoading: _isLoading } = useQuery({
    queryKey: ['mgmt-transactions', startDate, endDate, customerId, search, offset, limit],
    queryFn: () => transactionsApi.list({ start_date: startDate, end_date: endDate, customer_id: customerId, search, limit, offset }).then(r => r.data),
  })

  const pageTransactions = transactions.items

  const deleteMut = useMutation({
    mutationFn: (id: string) => transactionsApi.remove(id),
    onSuccess: () => { toast.success('Transaction deleted'); invalidateResource(qc, 'transactions') },
  })

  const totalAmount = pageTransactions.reduce((s: number, t: any) => s + t.total_amount, 0)
  const totalProfit = pageTransactions.reduce((s: number, t: any) => s + t.total_profit, 0)

  const txnColumns = [
    { key: 'transaction_date', header: 'Date', render: (t: any) => t.transaction_date },
    { key: 'customer_name', header: 'Customer', render: (t: any) => <span className="font-medium">{t.customer_name}</span> },
    { key: 'invoice_number', header: 'Invoice', render: (t: any) => <span className="text-gray-500">{t.invoice_number || '—'}</span> },
    { key: 'total_quantity', header: 'Qty', align: 'right' as const, render: (t: any) => t.total_quantity },
    { key: 'total_amount', header: 'Amount', align: 'right' as const, render: (t: any) => `LKR ${t.total_amount.toLocaleString()}` },
    { key: 'total_cost', header: 'Cost', align: 'right' as const, render: (t: any) => `LKR ${t.total_cost.toLocaleString()}` },
    { key: 'total_profit', header: 'Profit', align: 'right' as const, render: (t: any) => <span className="text-green-600">LKR {t.total_profit.toLocaleString()}</span> },
    {
      key: 'source', header: 'Source', align: 'center' as const,
      render: (t: any) => <Badge variant={t.source === 'IMPORT' ? 'info' : 'neutral'}>{t.source}</Badge>,
    },
    {
      key: 'actions', header: 'Actions', align: 'center' as const,
      render: (t: any) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => setViewTxn(t)} className="p-1 hover:bg-gray-100 rounded"><Eye size={14} /></button>
          <button onClick={() => { if (confirm('Delete this transaction?')) deleteMut.mutate(t.id) }} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  const exportCols = [
    { key: 'transaction_date', label: 'Date' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'invoice_number', label: 'Invoice' },
    { key: 'total_quantity', label: 'Qty' },
    { key: 'total_amount', label: 'Amount' },
    { key: 'total_cost', label: 'Cost' },
    { key: 'total_profit', label: 'Profit' },
    { key: 'source', label: 'Source' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Transactions"
        subtitle={`${transactions.total} transactions`}
        actions={<ExportButton data={pageTransactions} filename="transactions" columns={exportCols} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Transactions" value={transactions.total} icon={<ListChecks size={20} />} color="blue" />
        <StatCard label="Total Amount" value={`LKR ${totalAmount.toLocaleString()}`} icon={<Banknote size={20} />} color="amber" />
        <StatCard label="Total Profit" value={`LKR ${totalProfit.toLocaleString()}`} icon={<TrendingUp size={20} />} color="green" />
      </div>

      <FilterBar>
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block px-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Customers</option>
          {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </FilterBar>

      {_isLoading ? (
        <LoadingSpinner label="Loading transactions..." className="py-12" />
      ) : (
        <>
          <DataTable
            columns={txnColumns}
            data={pageTransactions}
            emptyState={<EmptyState title="No transactions found" description="No transactions match your filters." />}
          />
          <Pagination total={transactions.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {viewTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Transaction Details</h2>
              <button onClick={() => setViewTxn(null)} aria-label="Close details"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div><p className="text-gray-500">Date</p><p className="font-medium">{viewTxn.transaction_date}</p></div>
              <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewTxn.customer_name}</p></div>
              <div><p className="text-gray-500">Invoice</p><p className="font-medium">{viewTxn.invoice_number || '—'}</p></div>
              <div><p className="text-gray-500">Source</p><p className="font-medium">{viewTxn.source}</p></div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-2 py-1.5 text-left">Item</th>
                  <th className="px-2 py-1.5 text-left">Category</th>
                  <th className="px-2 py-1.5 text-right">Recv</th>
                  <th className="px-2 py-1.5 text-right">Washed</th>
                  <th className="px-2 py-1.5 text-right">Rate</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(viewTxn.items ?? []).map((item: any) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-2 py-1.5">{item.item_name}</td>
                    <td className="px-2 py-1.5"><span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 rounded">{item.category_name}</span></td>
                    <td className="px-2 py-1.5 text-right">{item.quantity_received}</td>
                    <td className="px-2 py-1.5 text-right">{item.quantity_washed}</td>
                    <td className="px-2 py-1.5 text-right">LKR {item.rate}</td>
                    <td className="px-2 py-1.5 text-right font-medium">LKR {item.line_total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 text-sm font-semibold border-t pt-3">
              <span>Total: LKR {viewTxn.total_amount.toLocaleString()}</span>
              <span>Cost: LKR {viewTxn.total_cost.toLocaleString()}</span>
              <span className="text-green-600">Profit: LKR {viewTxn.total_profit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
