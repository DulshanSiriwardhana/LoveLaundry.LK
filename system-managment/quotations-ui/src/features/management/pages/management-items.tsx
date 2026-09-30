import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { itemsApi } from '../api/management-api'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, X, Tag, Package } from 'lucide-react'
import { TableEmptyRow } from '../../../components/ui/empty-state'
import { Pagination } from '../../../components/ui/pagination'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'

const PAGE_SIZE = 20

export default function ManagementItems() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<any>(null)
  const [deleteCatTarget, setDeleteCatTarget] = useState<any>(null)
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = PAGE_SIZE
  const itemFlow = useEnterFlow()
  const catFlow = useEnterFlow()

  useEffect(() => {
    setOffset(0)
  }, [catFilter, search])

  useEscape(showForm, useCallback(() => { setShowForm(false); setEditing(null) }, []))

  const { data: categories = [] } = useQuery({
    queryKey: ['mgmt-categories'],
    queryFn: () => itemsApi.categories().then(r => r.data),
  })

  const { data: itemsData = { items: [], total: 0 }, isLoading: _isLoading } = useQuery({
    queryKey: ['mgmt-items', catFilter, search, offset, limit],
    queryFn: () => itemsApi.list({ category_id: catFilter, search, limit, offset }).then(r => r.data),
  })

  const createItemMut = useMutation({
    mutationFn: (data: any) => itemsApi.create(data),
    onSuccess: () => { toast.success('Item created'); qc.invalidateQueries({ queryKey: ['mgmt-items'] }); setShowForm(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const updateItemMut = useMutation({
    mutationFn: ({ id, data }: any) => itemsApi.update(id, data),
    onSuccess: () => { toast.success('Item updated'); qc.invalidateQueries({ queryKey: ['mgmt-items'] }); setEditing(null) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => { toast.success('Item deactivated'); qc.invalidateQueries({ queryKey: ['mgmt-items'] }); setDeleteItemTarget(null) },
  })

  const createCatMut = useMutation({
    mutationFn: (data: any) => itemsApi.createCategory(data),
    onSuccess: () => { toast.success('Category created'); qc.invalidateQueries({ queryKey: ['mgmt-categories'] }); setShowForm(false) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteCatMut = useMutation({
    mutationFn: (id: string) => itemsApi.removeCategory(id),
    onSuccess: () => { toast.success('Category deactivated'); qc.invalidateQueries({ queryKey: ['mgmt-categories'] }); setDeleteCatTarget(null) },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Items & Categories</h1>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
          <Plus size={16} /> {tab === 'items' ? 'Add Item' : 'Add Category'}
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('items')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'items' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}>
          <Package size={14} className="inline mr-1" /> Items ({itemsData.total})
        </button>
        <button onClick={() => setTab('categories')} className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === 'categories' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}>
          <Tag size={14} className="inline mr-1" /> Categories ({categories.length})
        </button>
      </div>

      {tab === 'items' && (
        <>
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
              className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">All Categories</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2.5 text-left">Item Name</th>
                  <th className="px-3 py-2.5 text-left">Category</th>
                  <th className="px-3 py-2.5 text-right">Rate</th>
                  <th className="px-3 py-2.5 text-right">Cost</th>
                  <th className="px-3 py-2.5 text-right">Total Qty</th>
                  <th className="px-3 py-2.5 text-right">Revenue</th>
                  <th className="px-3 py-2.5 text-right">Profit</th>
                  <th className="px-3 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(itemsData.items ?? []).map((item: any) => (
                  <tr key={item.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">{item.category_name}</span></td>
                    <td className="px-3 py-2 text-right">LKR {item.default_rate}</td>
                    <td className="px-3 py-2 text-right">LKR {item.standard_cost}</td>
                    <td className="px-3 py-2 text-right">{(item.total_quantity || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">LKR {(item.total_revenue || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-600">LKR {((item.total_revenue || 0) - (item.total_cost || 0)).toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setEditing(item); setShowForm(true) }} className="p-1 hover:bg-gray-100 rounded"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteItemTarget(item)} className="p-1 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
                {itemsData.items.length === 0 && (
                  <TableEmptyRow colSpan={8} title="No items found" description="Add an item to start pricing work." />
                )}
              </tbody>
            </table>
          </div>
          <Pagination total={itemsData.total} limit={limit} offset={offset} onChange={setOffset} className="px-1" />
        </>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat: any) => (
            <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{cat.name}</p>
                <p className="text-sm text-gray-400">{cat.description || 'No description'}</p>
              </div>
              <button onClick={() => setDeleteCatTarget(cat)} className="p-1.5 hover:bg-red-100 text-red-500 rounded"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit' : 'Add'} {tab === 'items' ? 'Item' : 'Category'}</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }}><X size={20} /></button>
            </div>
            {tab === 'items' ? (
              <form onSubmit={e => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const data = Object.fromEntries(fd)
                data.standard_cost = String(parseFloat(data.standard_cost as string) || 0)
                data.default_rate = String(parseFloat(data.default_rate as string) || 0)
                if (editing) updateItemMut.mutate({ id: editing.id, data })
                else createItemMut.mutate(data)
              }} ref={itemFlow.ref} onKeyDown={itemFlow.handleKeyDown} className="space-y-3">
                <input name="name" defaultValue={editing?.name} placeholder="Item Name *" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" />
                <select name="category_id" defaultValue={editing?.category_id || ''} required className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Category *</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Default Rate (LKR)</label>
                    <input name="default_rate" type="number" step="0.01" defaultValue={editing?.default_rate} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Washing Cost (LKR)</label>
                    <input name="standard_cost" type="number" step="0.01" defaultValue={editing?.standard_cost} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <select name="unit" defaultValue={editing?.unit || 'PIECE'} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="PIECE">Per Piece</option>
                  <option value="KG">Per Kg</option>
                  <option value="LOAD">Per Load</option>
                </select>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={createItemMut.isPending || updateItemMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">{createItemMut.isPending || updateItemMut.isPending ? 'Saving…' : (editing ? 'Update' : 'Create')}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={e => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                createCatMut.mutate(Object.fromEntries(fd))
              }} ref={catFlow.ref} onKeyDown={catFlow.handleKeyDown} className="space-y-3">
                <input name="name" defaultValue={editing?.name} placeholder="Category Name *" required autoFocus className="w-full px-3 py-2 border rounded-lg text-sm" />
                <textarea name="description" defaultValue={editing?.description} placeholder="Description" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="px-4 py-2 text-sm bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={createCatMut.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">{createCatMut.isPending ? 'Saving…' : 'Create'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteItemTarget}
        title="Deactivate Item"
        message={`Deactivate ${deleteItemTarget?.name}?`}
        confirmLabel="Deactivate"
        loading={deleteItemMut.isPending}
        onConfirm={() => deleteItemTarget && deleteItemMut.mutate(deleteItemTarget.id)}
        onCancel={() => setDeleteItemTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteCatTarget}
        title="Deactivate Category"
        message={`Deactivate ${deleteCatTarget?.name}?`}
        confirmLabel="Deactivate"
        loading={deleteCatMut.isPending}
        onConfirm={() => deleteCatTarget && deleteCatMut.mutate(deleteCatTarget.id)}
        onCancel={() => setDeleteCatTarget(null)}
      />
    </div>
  )
}
