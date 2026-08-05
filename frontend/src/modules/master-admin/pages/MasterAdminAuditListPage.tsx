// src/modules/master-admin/pages/MasterAdminAuditListPage.tsx (PRD §4.1 — system-level audit monitoring)
// The master-admin wrapper around the audit log feature: same List/Timeline DataTable composition
// as @/modules/audit's own AuditListPage (PageLayout > PageHeader > PageContent > DataTable, reusing
// DateRangeFilter/FilterChips/Tabs/ExportButton/AuditTimelineView/AuditStatsCards verbatim), but
// backed by the cross-tenant `/master-admin/audit-logs` endpoint instead of the tenant-scoped one,
// with a Tenant selector and a User selector (populated from the selected tenant) up front - the
// tenant-scoped AuditFilters' free-text actorId input doesn't fit here since master admin can pick
// a real user once a tenant is chosen, so those two selects are inlined here rather than forcing
// AuditFilters' shape to fit a use case it wasn't built for.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter/DateRangeFilter'
import { Card } from '@/components/shared/Card/Card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { AuditTimelineView } from '@/modules/audit/components'
import { AUDIT_EVENT_LABELS, AUDIT_EVENT_OPTIONS } from '@/modules/audit/constants'
import type { AuditEventType } from '@/modules/audit/types'
import { useMasterAdminAuditLogsQuery, useTenantUsersQuery, useTenantsQuery } from '../hooks'
import { masterAdminAuditTableColumns } from '../components'
import type { MasterAdminAuditLogFilters } from '../types'

const ALL = '__all__'
const EVENT_FILTER_OPTIONS = [{ value: ALL, label: 'All events' }, ...AUDIT_EVENT_OPTIONS]

type ViewMode = 'list' | 'timeline'

export function MasterAdminAuditListPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [actorId, setActorId] = useState('')
  const [eventType, setEventType] = useState<AuditEventType | undefined>()
  const [targetType, setTargetType] = useState('')
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const { data: tenantsData } = useTenantsQuery({ page: 1, limit: 200 })
  const { data: tenantUsers } = useTenantUsersQuery(tenantId)

  const tenantOptions = [
    { value: ALL, label: 'All tenants' },
    ...(tenantsData?.data ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name })),
  ]
  const userOptions = [
    { value: ALL, label: 'All users' },
    ...(tenantUsers ?? []).map((user) => ({ value: user.id, label: `${user.name} (${user.email})` })),
  ]

  const debouncedSearch = useDebounce(search, 300)

  const filters: MasterAdminAuditLogFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    tenantId: tenantId || undefined,
    actorId: actorId || undefined,
    eventType,
    targetType: targetType || undefined,
    from,
    to,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useMasterAdminAuditLogsQuery(filters)

  function handleTenantChange(nextTenantId: string) {
    setTenantId(nextTenantId)
    // A user filter from the previously selected tenant would silently scope results to nobody
    // (or the wrong person) once the tenant changes - clear it along with the tenant.
    setActorId('')
    setPageIndex(0)
  }

  const selectedTenantLabel = tenantOptions.find((opt) => opt.value === tenantId)?.label
  const selectedUserLabel = userOptions.find((opt) => opt.value === actorId)?.label

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(tenantId ? [{ key: 'tenantId', label: `Tenant: ${selectedTenantLabel ?? tenantId}` }] : []),
    ...(actorId ? [{ key: 'actorId', label: `User: ${selectedUserLabel ?? actorId}` }] : []),
    ...(eventType ? [{ key: 'eventType', label: `Event: ${AUDIT_EVENT_LABELS[eventType]}` }] : []),
    ...(targetType ? [{ key: 'targetType', label: `Target: ${targetType}` }] : []),
    ...(from ? [{ key: 'from', label: `From: ${from}` }] : []),
    ...(to ? [{ key: 'to', label: `To: ${to}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'tenantId') handleTenantChange('')
    if (key === 'actorId') setActorId('')
    if (key === 'eventType') setEventType(undefined)
    if (key === 'targetType') setTargetType('')
    if (key === 'from') setFrom(undefined)
    if (key === 'to') setTo(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    handleTenantChange('')
    setEventType(undefined)
    setTargetType('')
    setFrom(undefined)
    setTo(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Audit Logs"
        description="Security-relevant activity across every tenant on the platform (PRD §4.1)."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="master-admin-audit-logs"
              columns={[
                { header: 'Tenant', accessor: (e) => e.tenantName },
                { header: 'Event', accessor: (e) => e.eventType },
                { header: 'Actor', accessor: (e) => e.actorName },
                { header: 'Target Type', accessor: (e) => e.targetType },
                { header: 'Target ID', accessor: (e) => e.targetId },
                { header: 'Description', accessor: (e) => e.description },
                { header: 'IP Address', accessor: (e) => e.ipAddress },
                { header: 'Timestamp', accessor: (e) => e.createdAt },
              ]}
            />
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <Card padding="sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--color-text-muted)]" htmlFor="master-admin-audit-tenant">
                  Tenant
                </label>
                <Select
                  value={tenantId || ALL}
                  onChange={(value) => handleTenantChange(value === ALL ? '' : value)}
                  options={tenantOptions}
                  className="h-9 w-[220px]"
                  aria-label="Filter by tenant"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--color-text-muted)]" htmlFor="master-admin-audit-user">
                  User
                </label>
                <Select
                  value={actorId || ALL}
                  onChange={(value) => {
                    setActorId(value === ALL ? '' : value)
                    setPageIndex(0)
                  }}
                  options={userOptions}
                  disabled={!tenantId}
                  placeholder={tenantId ? 'All users' : 'Select a tenant first'}
                  className="h-9 w-[220px]"
                  aria-label="Filter by user"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--color-text-muted)]" htmlFor="master-admin-audit-event">
                  Event type
                </label>
                <Select
                  value={eventType ?? ALL}
                  onChange={(value) => {
                    setEventType(value === ALL ? undefined : (value as AuditEventType))
                    setPageIndex(0)
                  }}
                  options={EVENT_FILTER_OPTIONS}
                  className="h-9 w-[160px]"
                  aria-label="Filter by event type"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--color-text-muted)]" htmlFor="master-admin-audit-target">
                  Target type
                </label>
                <Input
                  id="master-admin-audit-target"
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value)
                    setPageIndex(0)
                  }}
                  placeholder="e.g. Document"
                  className="h-9 w-[160px]"
                />
              </div>
            </div>
          </Card>

          <Card padding="sm">
            <DateRangeFilter
              from={from}
              to={to}
              onFromChange={(v) => {
                setFrom(v)
                setPageIndex(0)
              }}
              onToChange={(v) => {
                setTo(v)
                setPageIndex(0)
              }}
            />
          </Card>

          <Tabs
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            tabs={[
              { value: 'list', label: 'List' },
              { value: 'timeline', label: 'Timeline' },
            ]}
          />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          {view === 'list' ? (
            <DataTable
              columns={masterAdminAuditTableColumns}
              data={data?.data ?? []}
              isLoading={isLoading}
              isError={isError}
              errorMessage={isError ? normalizeApiError(error).message : undefined}
              onRetry={refetch}
              emptyTitle="No audit events yet"
              emptyDescription="Security-relevant activity across every tenant will appear here."
              searchValue={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPageIndex(0)
              }}
              searchPlaceholder="Search by description…"
              sorting={sorting}
              onSortingChange={setSorting}
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageCount={data?.meta?.totalPages ?? 0}
              totalRows={data?.meta?.total}
              onPageChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageIndex(0)
              }}
              getRowId={(row) => row.id}
              onRowClick={(row) => navigate(`/master-admin/audit/${row.id}`)}
            />
          ) : (
            <Card>
              {isLoading ? (
                <Spinner fullScreen={false} label="Loading timeline…" className="py-12" />
              ) : isError ? (
                <ErrorState title="Couldn't load the timeline" message={normalizeApiError(error).message} onRetry={refetch} />
              ) : !data || data.data.length === 0 ? (
                <EmptyState title="No audit events yet" description="Security-relevant activity across every tenant will appear here." />
              ) : (
                <AuditTimelineView entries={data.data} />
              )}
            </Card>
          )}
        </div>
      </PageContent>
    </PageLayout>
  )
}
