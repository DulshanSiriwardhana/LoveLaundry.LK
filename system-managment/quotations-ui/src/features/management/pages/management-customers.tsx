import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Eye, Phone, Mail, MapPin, Users, AlertTriangle } from 'lucide-react'
import { PageHeader } from '../../../components/ui/page-header'
import { StatCard } from '../../../components/ui/stat-card'
import { FilterBar } from '../../../components/ui/filter-bar'
import { EmptyState } from '../../../components/ui/empty-state'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { ExportButton } from '../../../components/ui/export-button'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'
import { invalidateResource } from '../../../cache/invalidation'

const PAGE_SIZE = 12
const TYPES = ['HOTEL', 'SHOP', 'INDIVIDUAL', 'RESTAURANT']
const BILLING = ['PER_ITEM', 'PER_KG', 'FIXED_MONTHLY']
const PAYMENT_TERMS = ['NET_15', 'NET_30', 'NET_60', 'CASH_ON_DELIVERY', 'PREPAID']

export default function ManagementCustomers() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [_viewCustomer, setViewCustomer] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const flow = useEnterFlow()

  useEscape(showForm, useCallback(() => { setShowForm(false); setEditing(null) }, []))

  useEffect(() => {
    setOffset(0)
  }, [search])

  const { data: customers = { items: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['mgmt-customers', search, offset, limit],
    queryFn: () => customersApi.list(search, limit, offset).then(r => r.data),
  })

  const pageCustomers = customers.items
  const totalCustomers = customers.total

  const { data: summaries = [] } = useQuery({
    queryKey: ['mgmt-customer-summary'],
    queryFn: () => customersApi.summary().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess: () => { toast.success('Customer created'); invalidateResource(qc, 'customers'); setShowForm(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => customersApi.update(id, data),
    onSuccess: () => { toast.success('Customer updated'); invalidateResource(qc, 'customers'); setEditing(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => { toast.success('Customer deactivated'); invalidateResource(qc, 'customers'); setDeleteTarget(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const totalOutstanding = summaries.reduce((s: number, sum: any) => s + (sum.outstanding_payments || 0), 0)

  const exportCols = [
    { key: 'name', label: 'Name' },
    { key: 'customer_type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'address', label: 'Address' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers / Hotels / Shops"
        subtitle={`${totalCustomers} total customers`}
        actions={
          <>
            <ExportButton data={pageCustomers} filename="customers" columns={exportCols} />
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              <Plus size={16} /> Add Customer
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Customers" value={totalCustomers} icon={<Users size={20} />} color="blue" />
        <StatCard label="Outstanding" value={`LKR ${totalOutstanding.toLocaleString()}`} icon={<AlertTriangle size={20} />} color="amber" />
        <StatCard label="Active" value={pageCustomers.filter((c: any) => c.is_active !== false).length} icon={<Users size={20} />} color="green" />
        <StatCard label="Inactive" value={pageCustomers.filter((c: any) => c.is_active === false).length} icon={<Users size={20} />} color="gray" />
      </div>

      <FilterBar>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
          className="w-full md:w-80 px-3 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-red-500" />
      </FilterBar>

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner label="Loading customers..." /></div> : pageCustomers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description={search ? 'Try a different search term.' : 'Add your first customer to get started.'}
          action={
            !search && (
              <button onClick={() => { setEditing(null); setShowForm(true) }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                <Plus size={16} /> Add Customer
              </button>
            )
          }
        />
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageCustomers.map((c: any) => {
            const sum = summaries.find((s: any) => s.id === c.id) || {}
            return (
              <div key={c.id} className={`bg-white dark:bg-gray-800 rounded-xl border p-5 space-y-3 ${!c.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{c.customer_type}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setViewCustomer(c)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Eye size={14} /></button>
                    <button onClick={() => { setEditing(c); setShowForm(true) }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteTarget(c)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-500">
                  {c.phone && <p className="flex items-center gap-1"><Phone size={12} /> {c.phone}</p>}
                  {c.email && <p className="flex items-center gap-1"><Mail size={12} /> {c.email}</p>}
                  {c.address && <p className="flex items-center gap-1"><MapPin size={12} /> {c.address}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-sm">
                  <div>
                    <p className="text-gray-400">Transactions</p>
                    <p className="font-medium">{sum.total_transactions || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Revenue</p>
                    <p className="font-medium">LKR {(sum.total_revenue || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Items</p>
                    <p className="font-medium">{(sum.total_items || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Outstanding</p>
                    <p className="font-medium text-red-600">LKR {(sum.outstanding_payments || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <Pagination total={totalCustomers} limit={limit} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} aria-label="Close form"><X size={20} /></button>
            </div>
            <form onSubmit={e => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const data = Object.fromEntries(fd)
              if (editing) updateMut.mutate({ id: editing.id, data })
              else createMut.mutate(data)
            }} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="space-y-3">
              <input name="name" defaultValue={editing?.name} placeholder="Customer Name *" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select name="customer_type" defaultValue={editing?.customer_type || 'HOTEL'} className="px-3 py-2 border rounded-lg text-sm">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select name="billing_method" defaultValue={editing?.billing_method || 'PER_ITEM'} className="px-3 py-2 border rounded-lg text-sm">
                  {BILLING.map(b => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
                </select>
              </div>
              <input name="contact_person" defaultValue={editing?.contact_person} placeholder="Contact Person" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input name="phone" defaultValue={editing?.phone} placeholder="Phone" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input name="email" defaultValue={editing?.email} placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <input name="address" defaultValue={editing?.address} placeholder="Address" className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select name="payment_terms" defaultValue={editing?.payment_terms || 'NET_30'} className="w-full px-3 py-2 border rounded-lg text-sm">
                {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <textarea name="notes" defaultValue={editing?.notes} placeholder="Notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">
                  {createMut.isPending || updateMut.isPending ? 'Saving…' : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate Customer"
        message={`Deactivate ${deleteTarget?.name}?`}
        confirmLabel="Deactivate"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}