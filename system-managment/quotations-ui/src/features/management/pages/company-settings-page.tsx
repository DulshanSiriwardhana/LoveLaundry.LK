import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companySettingsApi } from '../api/management-api'
import { toast } from 'sonner'
import { Save, Settings } from 'lucide-react'
import { invalidateResource } from '../../../cache/invalidation'

// Order follows JS Date.getDay(): 0=Sunday ... 6=Saturday.
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Backend uses Python weekday(): 0=Monday ... 6=Sunday.
const pyToJs = (py: number) => (py + 1) % 7
const jsToPy = (js: number) => (js + 6) % 7

export default function CompanySettingsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<any>(null)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get().then(r => r.data),
  })

  useEffect(() => {
    if (settings && !form) {
      setForm({
        company_name: settings.company_name || 'Love Laundry',
        salary_basis_days: settings.salary_basis_days ?? 30,
        working_days_per_week: settings.working_days_per_week ?? 6,
        working_days_pattern: (settings.working_days_pattern || [0, 1, 2, 3, 4, 5]).map(pyToJs),
        default_overtime_rate: settings.default_overtime_rate ?? 0,
      })
    }
  }, [settings, form])

  const saveMut = useMutation({
    mutationFn: (data: any) => companySettingsApi.update(data),
    onSuccess: () => {
      toast.success('Company settings saved')
      invalidateResource(qc, 'settings')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save settings'),
  })

  const toggleDow = (i: number) => {
    if (!form) return
    const pattern = form.working_days_pattern.includes(i)
      ? form.working_days_pattern.filter((x: number) => x !== i)
      : [...form.working_days_pattern, i].sort((a: number, b: number) => a - b)
    setForm({ ...form, working_days_pattern: pattern, working_days_per_week: pattern.length })
  }

  const handleSave = () => {
    saveMut.mutate({
      ...form,
      working_days_pattern: (form.working_days_pattern || []).map(jsToPy),
    })
  }

  if (isLoading || !form) {
    return <div className="text-center py-12 text-gray-400">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company Settings</h1>
        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
        >
          <Save size={16} /> {saveMut.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={20} /> Payroll Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company Name</label>
            <input
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Salary Basis Days (per month)</label>
            <input
              type="number"
              min="1"
              value={form.salary_basis_days}
              onChange={e => setForm({ ...form, salary_basis_days: Number(e.target.value) || 30 })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Monthly salary is divided by this to get the per-day rate.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Default Overtime Rate (LKR/hr)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.default_overtime_rate}
              onChange={e => setForm({ ...form, default_overtime_rate: Number(e.target.value) || 0 })}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Working Days ({form.working_days_per_week} of 7)
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {DOW_LABELS.map((label, i) => {
              const active = form.working_days_pattern.includes(i)
              return (
                <button
                  key={i}
                  onClick={() => toggleDow(i)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    active
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">Non-working days are skipped in salary calculation. Sundays and Saturdays follow your selection.</p>
        </div>
      </div>
    </div>
  )
}