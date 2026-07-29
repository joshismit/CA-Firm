// src/modules/crm/pages/CRMListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable/Kanban.
// Table view keeps the original DataTable composition unchanged. Kanban view reuses the same
// filters (search/stage/source) but fetches a larger, unpaginated-feeling batch (PAGINATION.MAX_LIMIT
// = 100 leads) since a Kanban board needs every matching lead across all stages at once, not one
// page - see CRMPipelineSummary/CRMKanbanBoard for how the "capped at 100" case is surfaced
// honestly rather than silently dropping leads.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRightCircle } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useLeadsQuery, useLeadStagesQuery, useConvertLeadMutation } from '../hooks'
import { getCrmTableColumns } from '../components/CRMTableColumns'
import { CRMFilters } from '../components/CRMFilters'
import { CRMPipelineSummary } from '../components/CRMPipelineSummary'
import { CRMKanbanBoard } from '../components/CRMKanbanBoard'
import type { Lead, LeadListFilters } from '../types'

const KANBAN_FETCH_LIMIT = 100

export function CRMListPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [search, setSearch] = useState('')
  const [stageId, setStageId] = useState<string | undefined>()
  const [sourceId, setSourceId] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)
  const stagesQuery = useLeadStagesQuery()
  const stages = stagesQuery.data ?? []

  const sharedFilters = {
    search: debouncedSearch || undefined,
    stageId,
    sourceId: sourceId || undefined,
  }

  const tableFilters: LeadListFilters = {
    ...sharedFilters,
    page: pageIndex + 1,
    limit: pageSize,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  // Always fetched (not just in Kanban view) so the pipeline summary row above both views reflects
  // the current search/stage/source filters consistently.
  const summaryFilters: LeadListFilters = { ...sharedFilters, page: 1, limit: KANBAN_FETCH_LIMIT }

  const { data, isLoading, isError, error, refetch } = useLeadsQuery(tableFilters)
  const summaryQuery = useLeadsQuery(summaryFilters)
  const convertMutation = useConvertLeadMutation()

  const handleBulkConvert = async (selected: Lead[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Convert ${selected.length} lead${selected.length === 1 ? '' : 's'} to clients? This cannot be undone.`)) return
    // No bulk-convert endpoint exists - this calls the existing single-lead convertLead mutation
    // once per selected row rather than inventing a new bulk API.
    for (const lead of selected) {
      await convertMutation.mutateAsync({ leadId: lead.id })
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(stageId ? [{ key: 'stageId', label: `Stage: ${stages.find((s) => s.id === stageId)?.name ?? stageId}` }] : []),
    ...(sourceId ? [{ key: 'sourceId', label: `Source: ${sourceId.slice(0, 8)}…` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'stageId') setStageId(undefined)
    if (key === 'sourceId') setSourceId('')
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setStageId(undefined)
    setSourceId('')
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="CRM"
        description={data?.meta ? `${data.meta.total} lead${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="leads"
              columns={[
                { header: 'Title', accessor: (l) => l.title },
                { header: 'Stage', accessor: (l) => stages.find((s) => s.id === l.stageId)?.name ?? l.stageId },
                { header: 'Expected Revenue', accessor: (l) => l.expectedRevenue },
                { header: 'Probability', accessor: (l) => l.probability },
                { header: 'Expected Close', accessor: (l) => l.expectedCloseDate },
                { header: 'Created', accessor: (l) => l.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.CRM_CREATE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/crm/new')}>
                New Lead
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <CRMPipelineSummary
            leads={summaryQuery.data?.data ?? []}
            totalCount={summaryQuery.data?.meta.total ?? 0}
            isLoading={summaryQuery.isLoading}
            isError={summaryQuery.isError}
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs
              tabs={[
                { value: 'table', label: 'Table' },
                { value: 'kanban', label: 'Kanban' },
              ]}
              value={view}
              onChange={(v) => setView(v as 'table' | 'kanban')}
            />
            <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />
          </div>

          {view === 'table' ? (
            <DataTable<Lead>
              columns={getCrmTableColumns(stages)}
              data={data?.data ?? []}
              isLoading={isLoading}
              isError={isError}
              errorMessage={isError ? normalizeApiError(error).message : undefined}
              onRetry={refetch}
              emptyTitle="No leads yet"
              emptyDescription="Leads you create will show up here."
              searchValue={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPageIndex(0)
              }}
              searchPlaceholder="Search by title…"
              toolbarFilters={
                <CRMFilters
                  stages={stages}
                  stagesLoading={stagesQuery.isLoading}
                  stageId={stageId}
                  onStageIdChange={(next) => {
                    setStageId(next)
                    setPageIndex(0)
                  }}
                  sourceId={sourceId}
                  onSourceIdChange={(next) => {
                    setSourceId(next)
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
              enableRowSelection
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              getRowId={(row) => row.id}
              bulkActions={(selected) => (
                <Can permission={PERMISSIONS.CRM_UPDATE}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<ArrowRightCircle className="w-3.5 h-3.5" />}
                    onClick={() => handleBulkConvert(selected)}
                    loading={convertMutation.isPending}
                  >
                    Convert selected
                  </Button>
                </Can>
              )}
              onRowClick={(row) => navigate(`/crm/${row.id}`)}
            />
          ) : (
            <CRMKanbanBoard leads={summaryQuery.data?.data ?? []} stages={stages} />
          )}
        </div>
      </PageContent>
    </PageLayout>
  )
}
