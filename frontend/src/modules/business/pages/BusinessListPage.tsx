// src/modules/business/pages/BusinessListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable.
// DataTable's own built-in toolbar (search/filters/column-visibility/bulk-actions in one row) is
// used rather than a second page-level PageToolbar/PageSearch/PageFilters row - DataTable is the
// only place Column Visibility and Bulk Actions can render (that DataTableToolbar/
// DataTableColumnToggle wiring lives inside DataTable itself and isn't exposed externally), and
// rendering a second search bar above it would just duplicate the same control. See the final
// report's "deviations" section for the full reasoning.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessesQuery, useDeleteBusinessMutation } from '../hooks'
import { businessTableColumns } from '../components/BusinessTableColumns'
import { BusinessFilters } from '../components/BusinessFilters'
import type { Business, BusinessListFilters, BusinessStatus } from '../types'

export function BusinessListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<BusinessStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const filters: BusinessListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: search || undefined,
    status,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useBusinessesQuery(filters)
  const deleteMutation = useDeleteBusinessMutation()

  const handleBulkDelete = async (selected: Business[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} business${selected.length === 1 ? '' : 'es'}? This cannot be undone.`)) return
    // No bulk-delete endpoint exists - this calls the existing single-item deleteBusiness mutation
    // once per selected row rather than inventing a new bulk API.
    for (const business of selected) {
      await deleteMutation.mutateAsync(business.id)
    }
    setRowSelection({})
  }

  return (
    <PageLayout>
      <PageHeader
        title="Businesses"
        description={data?.meta ? `${data.meta.total} business${data.meta.total === 1 ? '' : 'es'}` : undefined}
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.BUSINESS_CREATE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/business/new')}>
                New Business
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <DataTable<Business>
          columns={businessTableColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No businesses yet"
          emptyDescription="Businesses you create will show up here."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchPlaceholder="Search by name, PAN, GSTIN…"
          toolbarFilters={
            <BusinessFilters
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
            <Can permission={PERMISSIONS.BUSINESS_DELETE}>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleBulkDelete(selected)}
                loading={deleteMutation.isPending}
              >
                Delete selected
              </Button>
            </Can>
          )}
          onRowClick={(row) => navigate(`/business/${row.id}`)}
        />
      </PageContent>
    </PageLayout>
  )
}
