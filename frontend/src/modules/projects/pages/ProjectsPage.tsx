// src/modules/projects/pages/ProjectsPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable.
// DataTable's own built-in toolbar (search/filters/column-visibility/bulk-actions in one row) is
// used rather than a second page-level PageToolbar/PageSearch/PageFilters row - same reasoning as
// BusinessListPage/ContactsListPage.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useProjectsQuery, useDeleteProjectMutation } from '../hooks'
import { projectTableColumns, ProjectFilters, ProjectStatsCards } from '../components'
import { PROJECT_STATUS_LABELS } from '../constants'
import type { Project, ProjectListFilters, ProjectStatus } from '../types'

export function ProjectsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | undefined>()
  const [clientId, setClientId] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: ProjectListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    clientId: clientId || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useProjectsQuery(filters)
  const deleteMutation = useDeleteProjectMutation()

  const handleBulkDelete = async (selected: Project[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} project${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    // No bulk-delete endpoint exists - this calls the existing single-item deleteProject mutation
    // once per selected row rather than inventing a bulk API. Projects that aren't DRAFT/PLANNED/
    // CANCELLED will 409 - the loop stops there, same behavior BusinessListPage/ContactsListPage
    // already accept for their own bulk deletes.
    for (const project of selected) {
      await deleteMutation.mutateAsync(project.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${PROJECT_STATUS_LABELS[status] ?? status}` }] : []),
    ...(clientId ? [{ key: 'clientId', label: `Client: ${clientId.slice(0, 8)}…` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'status') setStatus(undefined)
    if (key === 'clientId') setClientId('')
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setStatus(undefined)
    setClientId('')
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Projects"
        description={data?.meta ? `${data.meta.total} engagement${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="projects"
              columns={[
                { header: 'Code', accessor: (p) => p.code },
                { header: 'Name', accessor: (p) => p.name },
                { header: 'Status', accessor: (p) => p.status },
                { header: 'Client ID', accessor: (p) => p.clientId },
                { header: 'Manager ID', accessor: (p) => p.managerId },
                { header: 'Start Date', accessor: (p) => p.startDate },
                { header: 'Due Date', accessor: (p) => p.dueDate },
                { header: 'Overdue', accessor: (p) => (p.isOverdue ? 'Yes' : 'No') },
                { header: 'Created', accessor: (p) => p.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.PROJECTS_CREATE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/projects/new')}>
                New Project
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <ProjectStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Project>
            columns={projectTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No projects yet"
            emptyDescription="Projects you create will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by name or code…"
            toolbarFilters={
              <ProjectFilters
                status={status}
                onStatusChange={(next) => {
                  setStatus(next)
                  setPageIndex(0)
                }}
                clientId={clientId}
                onClientIdChange={(next) => {
                  setClientId(next)
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
              <Can permission={PERMISSIONS.PROJECTS_DELETE}>
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
            onRowClick={(row) => navigate(`/projects/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
