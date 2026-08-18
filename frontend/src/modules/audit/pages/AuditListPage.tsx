// src/modules/audit/pages/AuditListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// as BusinessListPage/NotificationListPage. A List/Timeline Tabs toggle offers the same data as
// either a sortable table or a chronological feed.
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
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useAuditLogsQuery } from '../hooks'
import { auditTableColumns, AuditFilters, AuditStatsCards, AuditTimelineView } from '../components'
import { AUDIT_EVENT_LABELS } from '../constants'
import type { AuditEventType, AuditLogFilters } from '../types'

type ViewMode = 'list' | 'timeline'

export function AuditListPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState<AuditEventType | undefined>()
  const [actorId, setActorId] = useState('')
  const [targetType, setTargetType] = useState('')
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: AuditLogFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    eventType,
    actorId: actorId || undefined,
    targetType: targetType || undefined,
    from,
    to,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useAuditLogsQuery(filters)

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(eventType ? [{ key: 'eventType', label: `Event: ${AUDIT_EVENT_LABELS[eventType]}` }] : []),
    ...(actorId ? [{ key: 'actorId', label: `Actor: ${actorId.slice(0, 8)}…` }] : []),
    ...(targetType ? [{ key: 'targetType', label: `Target: ${targetType}` }] : []),
    ...(from ? [{ key: 'from', label: `From: ${from}` }] : []),
    ...(to ? [{ key: 'to', label: `To: ${to}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'eventType') setEventType(undefined)
    if (key === 'actorId') setActorId('')
    if (key === 'targetType') setTargetType('')
    if (key === 'from') setFrom(undefined)
    if (key === 'to') setTo(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setEventType(undefined)
    setActorId('')
    setTargetType('')
    setFrom(undefined)
    setTo(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Audit Logs"
        description="Track security-relevant activity across the firm's account."
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.AUDIT_LOGS_READ}>
              <ExportButton
                rows={data?.data ?? []}
                filename="audit-logs"
                columns={[
                  { header: 'Event', accessor: (e) => e.eventType },
                  { header: 'Actor', accessor: (e) => e.actorName },
                  { header: 'Target Type', accessor: (e) => e.targetType },
                  { header: 'Target ID', accessor: (e) => e.targetId },
                  { header: 'Description', accessor: (e) => e.description },
                  { header: 'IP Address', accessor: (e) => e.ipAddress },
                  { header: 'Timestamp', accessor: (e) => e.createdAt },
                ]}
              />
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <AuditStatsCards />

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
              columns={auditTableColumns}
              data={data?.data ?? []}
              isLoading={isLoading}
              isError={isError}
              errorMessage={isError ? normalizeApiError(error).message : undefined}
              onRetry={refetch}
              emptyTitle="No audit events yet"
              emptyDescription="Security-relevant activity will appear here."
              searchValue={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPageIndex(0)
              }}
              searchPlaceholder="Search by description…"
              toolbarFilters={
                <AuditFilters
                  eventType={eventType}
                  onEventTypeChange={(next) => {
                    setEventType(next)
                    setPageIndex(0)
                  }}
                  actorId={actorId}
                  onActorIdChange={(next) => {
                    setActorId(next)
                    setPageIndex(0)
                  }}
                  targetType={targetType}
                  onTargetTypeChange={(next) => {
                    setTargetType(next)
                    setPageIndex(0)
                  }}
                />
              }
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
              onRowClick={(row) => navigate(`/audit/${row.id}`)}
            />
          ) : (
            <Card>
              {isLoading ? (
                <Spinner fullScreen={false} label="Loading timeline…" className="py-12" />
              ) : isError ? (
                <ErrorState title="Couldn't load the timeline" message={normalizeApiError(error).message} onRetry={refetch} />
              ) : !data || data.data.length === 0 ? (
                <EmptyState title="No audit events yet" description="Security-relevant activity will appear here." />
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
