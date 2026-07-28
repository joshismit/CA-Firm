// src/modules/crm/pages/CRMListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// architecture as BusinessListPage/ContactsListPage - DataTable's own built-in toolbar is used
// rather than a second page-level PageToolbar/PageSearch/PageFilters row, for the identical reasons
// documented there. Stages are fetched once here (via the real useLeadStagesQuery hook) and passed
// down into both the table columns and the stage filter, so stage-name resolution isn't duplicated.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRightCircle } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useLeadsQuery, useLeadStagesQuery, useConvertLeadMutation } from '../hooks'
import { getCrmTableColumns } from '../components/CRMTableColumns'
import { CRMFilters } from '../components/CRMFilters'
import type { Lead, LeadListFilters } from '../types'

export function CRMListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [stageId, setStageId] = useState<string | undefined>()
  const [sourceId, setSourceId] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const stagesQuery = useLeadStagesQuery()
  const stages = stagesQuery.data ?? []

  const filters: LeadListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: search || undefined,
    stageId,
    sourceId: sourceId || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useLeadsQuery(filters)
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

  return (
    <PageLayout>
      <PageHeader
        title="CRM"
        description={data?.meta ? `${data.meta.total} lead${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.CRM_CREATE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/crm/new')}>
                New Lead
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
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
      </PageContent>
    </PageLayout>
  )
}
