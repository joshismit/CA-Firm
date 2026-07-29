// src/modules/compliance/pages/ComplianceListPage.tsx
// One generic page shared by all four Compliance areas - instantiated once per moduleKey in
// routes/protected.routes.tsx. Reference composition: PageLayout > PageHeader (+ PageActions) >
// PageContent > DataTable, same as BusinessListPage/ProjectsPage. There is no PERMISSIONS.* entry
// for gst/itr/tds/mca (no such permission resource exists on the backend - see types/index.ts's
// header comment), so the "New filing" action isn't wrapped in <Can> the way Business/Projects
// actions are; it's plainly visible instead of gated on a permission that doesn't exist.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useComplianceFilingsQuery, useDeleteComplianceFilingMutation } from '../hooks'
import { complianceTableColumns, ComplianceFilters, ComplianceStatsCards } from '../components'
import { COMPLIANCE_MODULES, COMPLIANCE_STATUS_LABELS } from '../constants'
import type { ComplianceFiling, ComplianceFilingListFilters, ComplianceFilingStatus, ComplianceModuleKey } from '../types'

export interface ComplianceListPageProps {
  moduleKey: ComplianceModuleKey
}

export function ComplianceListPage({ moduleKey }: ComplianceListPageProps) {
  const config = COMPLIANCE_MODULES[moduleKey]
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ComplianceFilingStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: ComplianceFilingListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useComplianceFilingsQuery(moduleKey, filters)
  const deleteMutation = useDeleteComplianceFilingMutation(moduleKey)

  const handleBulkDelete = async (selected: ComplianceFiling[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} filing${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const filing of selected) {
      await deleteMutation.mutateAsync(filing.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${COMPLIANCE_STATUS_LABELS[status]}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'status') setStatus(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setStatus(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title={config.label}
        description="Track filings, deadlines, and status for this compliance area."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename={config.path}
              columns={[
                { header: 'Reference', accessor: (f) => f.reference },
                { header: 'Period', accessor: (f) => f.period },
                { header: 'Status', accessor: (f) => f.status },
                { header: 'Due Date', accessor: (f) => f.dueDate },
                { header: 'Filed Date', accessor: (f) => f.filedDate },
                { header: 'Created', accessor: (f) => f.createdAt },
              ]}
            />
            <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate(`/${config.path}/new`)}>
              New filing
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <ComplianceStatsCards moduleKey={moduleKey} />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<ComplianceFiling>
            columns={complianceTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={
              isError
                ? normalizeApiError(error).message
                : undefined
            }
            onRetry={refetch}
            emptyTitle={`No ${config.label} yet`}
            emptyDescription={`${config.singular} filings you create will show up here.`}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by reference or period…"
            toolbarFilters={
              <ComplianceFilters
                status={status}
                onStatusChange={(next) => {
                  setStatus(next)
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
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleBulkDelete(selected)}
                loading={deleteMutation.isPending}
              >
                Delete selected
              </Button>
            )}
            onRowClick={(row) => navigate(`/${config.path}/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
