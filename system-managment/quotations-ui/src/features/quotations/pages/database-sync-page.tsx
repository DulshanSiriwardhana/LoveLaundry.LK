import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RiDatabase2Line, RiRefreshLine, RiCheckLine, RiErrorWarningLine, RiTimeLine } from 'react-icons/ri'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import billsApi from '../../../api/bills-api'

interface DatabaseStatus {
  main: { status: string }
  secondary: { status: string; sync_status: string }
  local: { status: string; last_sync?: string | null; last_sync_status?: string | null }
}

interface SyncReport {
  status: string
  started_at: string
  completed_at: string
  duration_seconds: number
  stats: {
    records_checked: number
    records_inserted: number
    records_updated: number
    records_deleted: number
    records_unchanged: number
    errors: number
  }
  entities: Array<{ entity: string; inserted: number; updated: number; deleted: number; unchanged: number }>
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
    />
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function DatabaseSyncPage() {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)

  const { data: status, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['database-status'],
    queryFn: async () => {
      const res = await billsApi.get<DatabaseStatus>('/admin/database/status')
      return res.data
    },
    retry: 0,
  })

  const syncLocal = useMutation({
    mutationFn: async () => {
      setSyncing(true)
      try {
        const res = await billsApi.post<SyncReport>('/admin/database/sync-local')
        return res.data
      } finally {
        setSyncing(false)
      }
    },
    onSuccess: (report) => {
      qc.invalidateQueries({ queryKey: ['database-status'] })
      if (report.status === 'SUCCESS') {
        toast.success('Local database synchronized')
      } else {
        toast.warning('Local sync completed with errors')
      }
    },
    onError: () => toast.error('Synchronization failed'),
  })

  const syncSecondary = useMutation({
    mutationFn: async () => {
      const res = await billsApi.post('/admin/database/sync-secondary')
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['database-status'] })
      toast.success('Secondary sync triggered')
    },
    onError: () => toast.error('Failed to trigger secondary sync'),
  })

  return (
    <div className="space-y-6 pb-10">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Database Sync' }]} />
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
            <RiDatabase2Line className="h-4 w-4 text-[#2563EB]" />
          </div>
          <div>
            <h1 className="text-dashboard-title">Database Synchronization</h1>
            <p className="text-[13px] mt-0.5 text-[#98A2B3]">
              Monitor and manage Main, Secondary, and Local database sync
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4 flex items-start gap-3">
          <RiErrorWarningLine className="h-5 w-5 text-[#DC2626] mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-[#DC2626]">Failed to load database status</p>
            <p className="text-[12px] text-[#B91C1C] mt-0.5">
              {(error as Error)?.message || 'Could not reach the bill service. Check that the service is running and that JWT_SECRET matches between user-service and bill-service on Vercel.'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-[12px] font-medium text-[#DC2626] underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Main DB */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiDatabase2Line className="h-4 w-4 text-[#2563EB]" />
                  <span className="text-[13px] font-semibold text-[#101828]">Main Database</span>
                </div>
                <StatusDot online={status?.main?.status === 'ONLINE'} />
              </div>
              <p className="mt-2 text-[12px] text-[#98A2B3]">
                {status?.main?.status === 'ONLINE' ? '● Online' : '● Offline'}
              </p>
            </CardContent>
          </Card>

          {/* Secondary DB */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiRefreshLine className="h-4 w-4 text-[#16A34A]" />
                  <span className="text-[13px] font-semibold text-[#101828]">Secondary Database</span>
                </div>
                <StatusDot online={status?.secondary?.status === 'ONLINE'} />
              </div>
              <p className="mt-2 text-[12px] text-[#98A2B3]">
                {status?.secondary?.status === 'ONLINE' ? '● Online' : '● Offline'}
              </p>
              <p className="mt-1 text-[12px] font-medium text-[#101828]">
                Sync: {status?.secondary?.sync_status || 'UNKNOWN'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => syncSecondary.mutate()}
                disabled={syncSecondary.isPending}
              >
                <RiRefreshLine className="h-3.5 w-3.5 mr-1" />
                {syncSecondary.isPending ? 'Syncing...' : 'Sync Now'}
              </Button>
            </CardContent>
          </Card>

          {/* Local DB */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiTimeLine className="h-4 w-4 text-[#D97706]" />
                  <span className="text-[13px] font-semibold text-[#101828]">Local Database</span>
                </div>
                <StatusDot online={status?.local?.status === 'ONLINE'} />
              </div>
              <p className="mt-2 text-[12px] text-[#98A2B3]">
                {status?.local?.status === 'ONLINE' ? '● Online' : '● Offline'}
              </p>
              <p className="mt-1 text-[12px] text-[#98A2B3]">
                Last synced: {formatDate(status?.local?.last_sync)}
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => syncLocal.mutate()}
                disabled={syncing || syncLocal.isPending}
              >
                {syncing || syncLocal.isPending ? (
                  <>
                    <RiRefreshLine className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <RiDatabase2Line className="h-3.5 w-3.5 mr-1" />
                    Sync Local Database
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sync Report */}
      {syncLocal.data && (
        <Card>
          <CardHeader className="border-b border-[#F2F4F7] pb-4">
            <CardTitle>Last Sync Report</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-4">
              {syncLocal.data.status === 'SUCCESS' ? (
                <RiCheckLine className="h-4 w-4 text-[#16A34A]" />
              ) : (
                <RiErrorWarningLine className="h-4 w-4 text-[#D97706]" />
              )}
              <span className="text-[13px] font-semibold text-[#101828]">
                {syncLocal.data.status === 'SUCCESS' ? '✓ Local database synchronized' : '⚠ Synchronization completed with errors'}
              </span>
              <span className="text-[12px] text-[#98A2B3]">
                ({syncLocal.data.duration_seconds}s)
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Checked', value: syncLocal.data.stats.records_checked },
                { label: 'Inserted', value: syncLocal.data.stats.records_inserted },
                { label: 'Updated', value: syncLocal.data.stats.records_updated },
                { label: 'Deleted', value: syncLocal.data.stats.records_deleted },
                { label: 'Unchanged', value: syncLocal.data.stats.records_unchanged },
                { label: 'Errors', value: syncLocal.data.stats.errors },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#E4E7EC] bg-[#FAFAFA] p-3">
                  <p className="text-[11px] text-[#98A2B3]">{item.label}</p>
                  <p className="text-[16px] font-bold text-[#101828]">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RiRefreshLine className="h-3.5 w-3.5 mr-1" />
          Refresh Status
        </Button>
      </div>
    </div>
  )
}