import { FilePlus, Eye, PencilSimple, Trash, FileText } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/button'
import { ConfirmDialog } from '../../../components/ui/confirm-dialog'
import { EmptyState, ErrorState } from '../../../components/ui/empty-state'
import { SkeletonTable } from '../../../components/ui/skeleton'
import { PageHeader } from '../../../components/ui/page-header'
import { FilterBar, FilterChip } from '../../../components/ui/filter-bar'
import { Toolbar, ToolbarGroup, SearchInput } from '../../../components/ui/toolbar'
import { DataTable, type Column } from '../../../components/ui/data-table'
import { RowActions, type MenuGroup } from '../../../components/ui/dropdown-menu'
import { Badge, type BadgeTone } from '../../../components/ui/badge'
import { formatDate } from '../../../lib/utils'
import { useDeleteQuotation, useQuotations } from '../hooks/useQuotations'
import { QuotationPreviewDialog } from '../components/quotation-preview-dialog'
import { ORDER_STATUSES } from '../../../types/quotation'
import type { OrderStatus, Quotation } from '../../../types/quotation'

/** Order status → badge tone. Grouped by meaning, not by hue: in-progress
 *  states are all `info`, finished states `success`, blocked `danger`. */
const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'info',
  accepted: 'success',
  archived: 'neutral',
  received: 'info',
  washing: 'info',
  pressing: 'info',
  folding: 'info',
  packing: 'info',
  ready: 'success',
  out_for_delivery: 'info',
  delivered: 'success',
  cancelled: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  out_for_delivery: 'Out for delivery',
}

const label = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ')

export default function QuotationsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error } = useQuotations()
  const deleteMutation = useDeleteQuotation()

  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<Quotation | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null)

  const rows = useMemo(() => data ?? [], [data])

  /** Count per status, so a filter chip can show how much is behind it. */
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of rows) {
      if (q.status) map.set(q.status, (map.get(q.status) ?? 0) + 1)
    }
    return map
  }, [rows])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter((q) => {
        const matchesSearch =
          !term ||
          (q.client_name ?? '').toLowerCase().includes(term) ||
          (q.quotation_title ?? '').toLowerCase().includes(term) ||
          (q.line_items ?? []).some((li) => (li.item_name ?? '').toLowerCase().includes(term))
        const matchesStatus = statusFilter === 'all' || q.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => (a.client_name ?? '').localeCompare(b.client_name ?? ''))
  }, [rows, search, statusFilter])

  const rowActions = (q: Quotation): MenuGroup[] => [
    {
      items: [
        { id: 'preview', label: 'Quick preview', icon: <Eye size={16} />, onSelect: () => setPreview(q) },
        { id: 'view', label: 'Open', icon: <FileText size={16} />, onSelect: () => navigate(`/quotations/${q.id}`) },
        { id: 'edit', label: 'Edit', icon: <PencilSimple size={16} />, onSelect: () => navigate(`/quotations/${q.id}/edit`) },
        {
          id: 'delete',
          label: 'Delete',
          icon: <Trash size={16} />,
          destructive: true,
          onSelect: () => setDeleteTarget(q),
        },
      ],
    },
  ]

  const columns: Column<Quotation>[] = [
    {
      key: 'client_name',
      header: 'Client',
      render: (q) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {q.client_name ?? '(no name)'}
          </p>
          {q.quotation_title && (
            <p className="truncate text-[11.5px] text-[var(--text-muted)]">{q.quotation_title}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '160px',
      render: (q) =>
        q.status ? (
          <Badge size="xs" tone={STATUS_TONE[q.status] ?? 'neutral'} dot>
            {label(q.status)}
          </Badge>
        ) : (
          <span className="text-[12px] text-[var(--text-faint)]">—</span>
        ),
    },
    {
      key: 'line_items',
      header: 'Items',
      numeric: true,
      width: '80px',
      render: (q) => q.line_items?.length ?? 0,
    },
    {
      key: 'updated_at',
      header: 'Updated',
      width: '140px',
      render: (q) => (
        <span className="text-[12.5px] whitespace-nowrap text-[var(--text-tertiary)]">
          {formatDate(q.updated_at ?? q.created_at)}
        </span>
      ),
    },
    {
      key: '_actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '56px',
      render: (q) => <RowActions groups={rowActions(q)} label={`Actions for ${q.client_name}`} />,
    },
  ]

  const isFiltered = Boolean(search.trim()) || statusFilter !== 'all'

  return (
    <div className="space-y-4">
      <PageHeader
        title="Quotations"
        subtitle="Every hotel and client price list, with its current order status."
        actions={
          <Button asChild>
            <Link to="/quotations/new">
              <FilePlus size={16} aria-hidden />
              New quotation
            </Link>
          </Button>
        }
      />

      <Toolbar>
        <ToolbarGroup className="sm:max-w-xs">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search client, title or item…"
          />
        </ToolbarGroup>

        <ToolbarGroup className="min-w-0 flex-1">
          <FilterBar>
            <FilterChip
              label="All"
              count={rows.length}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            {ORDER_STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={label(s)}
                count={counts.get(s) ?? 0}
                active={statusFilter === s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              />
            ))}
          </FilterBar>
        </ToolbarGroup>

        <ToolbarGroup align="end">
          <span className="text-[12px] tabular-nums whitespace-nowrap text-[var(--text-muted)]">
            {isFiltered ? `${filtered.length} of ${rows.length}` : `${rows.length} total`}
          </span>
        </ToolbarGroup>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : isError ? (
        <ErrorState description={error instanceof Error ? error.message : 'Unable to load quotations'} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(q) => String(q.id)}
          onRowClick={(q) => navigate(`/quotations/${q.id}`)}
          mobilePrimary={['client_name', 'status']}
          mobileHidden={['_actions']}
          caption={`${filtered.length} quotation${filtered.length === 1 ? '' : 's'}`}
          emptyState={
            isFiltered ? (
              <EmptyState
                icon={<FileText size={22} />}
                title="No quotations match"
                description="Clear the search or pick a different status."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<FileText size={22} />}
                title="No quotations yet"
                description="Create a price list for a client to get started."
                action={
                  <Button asChild size="sm">
                    <Link to="/quotations/new">Create quotation</Link>
                  </Button>
                }
              />
            )
          }
        />
      )}

      <QuotationPreviewDialog
        quotation={preview}
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreview(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete quotation?"
        message={
          deleteTarget
            ? `${deleteTarget.client_name}${deleteTarget.quotation_title ? ` — ${deleteTarget.quotation_title}` : ''} will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteMutation.mutate(String(deleteTarget.id), {
            onSettled: () => setDeleteTarget(null),
          })
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
