import { useMemo, useState } from 'react'
import { Truck, Plus, X, MapPin, User, CalendarDays } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { EmptyState } from '../../../components/ui/empty-state'
import { formatDate } from '../../../lib/utils'
import {
  useDispatchJobs,
  useCreateDispatch,
  useUpdateDispatch,
  useDeleteDispatch,
  useOptimizeRoute,
} from '../hooks/useDispatch'
import type { DispatchJob, DispatchStatus, RoutePlan } from '../../../types/operations'

const STATUS_STYLE: Record<DispatchStatus, string> = {
  SCHEDULED: 'bg-[#EFF4FF] text-[#3538CD] border-[#C7D7FE]',
  ASSIGNED: 'bg-[#F2F4F7] text-[#475467] border-[#E4E7EC]',
  EN_ROUTE: 'bg-[#FEF6E7] text-[#B54708] border-[#FCE7C0]',
  COMPLETED: 'bg-[#ECFDF3] text-[#027A48] border-[#ABEFC6]',
  CANCELLED: 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]',
}

const NEXT_STATUS: Partial<Record<DispatchStatus, DispatchStatus>> = {
  SCHEDULED: 'ASSIGNED',
  ASSIGNED: 'EN_ROUTE',
  EN_ROUTE: 'COMPLETED',
}

const STATUS_LABEL: Record<DispatchStatus, string> = {
  SCHEDULED: 'Scheduled',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En Route',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export default function DispatchPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [open, setOpen] = useState(false)

  const params = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { job_type: typeFilter } : {}),
    }),
    [statusFilter, typeFilter],
  )

  const { data: jobs = [], isLoading } = useDispatchJobs(params)
  const createJob = useCreateDispatch()
  const updateJob = useUpdateDispatch()
  const deleteJob = useDeleteDispatch()
  const optimize = useOptimizeRoute()
  const [routeOpen, setRouteOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#101828]">
            <Truck className="h-5 w-5 text-[#E01E31]" />
            Dispatch &amp; Pickups
          </h1>
          <p className="text-[13px] text-[#667085]">
            Schedule customer pickups and deliveries, assign drivers and track each job.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRouteOpen(true)}>
            Plan Route
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Job
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['', 'pickup', 'delivery'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
              typeFilter === t
                ? 'border-[#E01E31] bg-[#FEF2F2] text-[#E01E31]'
                : 'border-[#E5E5E5] text-[#475467]'
            }`}
          >
            {t === '' ? 'All types' : t === 'pickup' ? 'Pickups' : 'Deliveries'}
          </button>
        ))}
        {(['', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                statusFilter === s
                  ? 'border-[#E01E31] bg-[#FEF2F2] text-[#E01E31]'
                  : 'border-[#E5E5E5] text-[#475467]'
              }`}
            >
              {s === '' ? 'All statuses' : STATUS_LABEL[s]}
            </button>
          ),
        )}
      </div>

      {isLoading ? (
        <p className="text-[13px] text-[#98A2B3]">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No dispatch jobs"
          description="Schedule a pickup or delivery to get started."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job: DispatchJob) => (
            <JobCard
              key={job.id}
              job={job}
              onAdvance={(s) => updateJob.mutate({ id: job.id, data: { status: s } })}
              onAssign={(driver) =>
                updateJob.mutate({ id: job.id, data: { assigned_to: driver } })
              }
              onCancel={() =>
                updateJob.mutate({ id: job.id, data: { status: 'CANCELLED' } })
              }
              onDelete={() => deleteJob.mutate(job.id)}
            />
          ))}
        </div>
      )}

      {open && (
        <NewJobModal
          onClose={() => setOpen(false)}
          onCreate={(data) =>
            createJob.mutate(data, { onSuccess: () => setOpen(false) })
          }
          creating={createJob.isPending}
        />
      )}

      {routeOpen && (
        <RoutePlannerModal
          onClose={() => setRouteOpen(false)}
          onPlan={(d, dt) =>
            optimize.mutate({ assigned_to: d, date: dt })
          }
          planning={optimize.isPending}
          plan={optimize.data}
        />
      )}
    </div>
  )
}

function JobCard({
  job,
  onAdvance,
  onAssign,
  onCancel,
  onDelete,
}: {
  job: DispatchJob
  onAdvance: (s: DispatchStatus) => void
  onAssign: (driver: string) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [driver, setDriver] = useState(job.assigned_to ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const next = NEXT_STATUS[job.status]

  return (
    <>
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold text-[#101828]">{job.client_name}</p>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
              {job.job_type === 'pickup' ? 'Pickup' : 'Delivery'}
            </span>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_STYLE[job.status]
            }`}
          >
            {STATUS_LABEL[job.status]}
          </span>
        </div>

        {job.address && (
          <p className="flex items-start gap-1.5 text-[12px] text-[#475467]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#98A2B3]" />
            {job.address}
          </p>
        )}
        {job.scheduled_at && (
          <p className="flex items-center gap-1.5 text-[12px] text-[#475467]">
            <CalendarDays className="h-3.5 w-3.5 text-[#98A2B3]" />
            {formatDate(job.scheduled_at)}
          </p>
        )}
        {job.contact_name && (
          <p className="flex items-center gap-1.5 text-[12px] text-[#475467]">
            <User className="h-3.5 w-3.5 text-[#98A2B3]" />
            {job.contact_name}
            {job.contact_phone ? ` · ${job.contact_phone}` : ''}
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            placeholder="Assign driver"
            className="flex-1 rounded-lg border border-[#E5E5E5] px-2.5 py-1.5 text-[12px] outline-none focus:border-[#E01E31]"
          />
          <Button size="sm" variant="outline" onClick={() => onAssign(driver)}>
            Assign
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {next && (
            <Button size="sm" onClick={() => onAdvance(next)}>
              Mark {STATUS_LABEL[next]}
            </Button>
          )}
          {job.status !== 'CANCELLED' && job.status !== 'COMPLETED' && (
            <Button size="sm" variant="outline" onClick={() => setShowCancelConfirm(true)}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-[#B42318]"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>

    <ConfirmDialog
      open={showDeleteConfirm}
      title="Delete Dispatch Job"
      description={`Delete this ${job.job_type} job for ${job.client_name}? This cannot be undone.`}
      confirmLabel="Delete"
      variant="danger"
      onConfirm={() => { setShowDeleteConfirm(false); onDelete() }}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    <ConfirmDialog
      open={showCancelConfirm}
      title="Cancel Dispatch Job"
      description={`Cancel this ${job.job_type} job for ${job.client_name}?`}
      confirmLabel="Cancel Job"
      variant="warning"
      onConfirm={() => { setShowCancelConfirm(false); onCancel() }}
      onCancel={() => setShowCancelConfirm(false)}
    />
    </>
  )
}

function NewJobModal({
  onClose,
  onCreate,
  creating,
}: {
  onClose: () => void
  onCreate: (data: any) => void
  creating: boolean
}) {
  const [form, setForm] = useState({
    job_type: 'delivery',
    client_name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    scheduled_at: '',
    assigned_to: '',
    latitude: '',
    longitude: '',
    notes: '',
  })

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F2F2F2] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[#101828]">New Dispatch Job</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[#F5F5F5]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <div className="flex gap-2">
            {(['pickup', 'delivery'] as const).map((t) => (
              <button
                key={t}
                onClick={() => set('job_type', t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold capitalize ${
                  form.job_type === t
                    ? 'border-[#E01E31] bg-[#FEF2F2] text-[#E01E31]'
                    : 'border-[#E5E5E5] text-[#475467]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Field label="Client name">
            <input
              value={form.client_name}
              onChange={(e) => set('client_name', e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name">
              <input
                value={form.contact_name}
                onChange={(e) => set('contact_name', e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
              />
            </Field>
            <Field label="Contact phone">
              <input
                value={form.contact_phone}
                onChange={(e) => set('contact_phone', e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
              />
            </Field>
          </div>
          <Field label="Scheduled at">
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => set('scheduled_at', e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
          <Field label="Assign driver">
            <input
              value={form.assigned_to}
              onChange={(e) => set('assigned_to', e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude (optional)">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => set('latitude', e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
              />
            </Field>
            <Field label="Longitude (optional)">
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => set('longitude', e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F2F2] px-5 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={creating || !form.client_name}
            onClick={() =>
              onCreate({
                ...form,
                latitude: form.latitude === '' ? undefined : Number(form.latitude),
                longitude: form.longitude === '' ? undefined : Number(form.longitude),
                scheduled_at: form.scheduled_at
                  ? new Date(form.scheduled_at).toISOString()
                  : undefined,
              })
            }
          >
            {creating ? 'Creating…' : 'Create Job'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RoutePlannerModal({
  onClose,
  onPlan,
  planning,
  plan,
}: {
  onClose: () => void
  onPlan: (driver: string, date?: string) => void
  planning: boolean
  plan?: RoutePlan | null
}) {
  const [driver, setDriver] = useState('')
  const [date, setDate] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F2F2F2] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[#101828]">Plan Driver Route</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[#F5F5F5]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <Field label="Driver">
            <input
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Driver name"
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>
          <Field label="Date (optional)">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-[13px] outline-none focus:border-[#E01E31]"
            />
          </Field>

          {plan && plan.stops.length > 0 && (
            <ol className="space-y-2 rounded-xl border border-[#EEF0F3] p-3">
              {plan.stops.map((stop, i) => (
                <li key={stop.id} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E01E31] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#101828]">
                      {stop.client_name}
                    </p>
                    <p className="text-[11px] text-[#667085]">
                      {stop.job_type === 'pickup' ? 'Pickup' : 'Delivery'}
                      {stop.address ? ` · ${stop.address}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {plan && plan.stops.length === 0 && (
            <p className="text-[12px] text-[#98A2B3]">
              No active jobs found for this driver{date ? ` on ${date}` : ''}.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F2F2F2] px-5 py-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={planning || !driver}
            onClick={() => onPlan(driver, date || undefined)}
          >
            {planning ? 'Planning…' : 'Optimize'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[#475467]">{label}</span>
      {children}
    </label>
  )
}
