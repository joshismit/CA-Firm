// src/modules/roles/pages/RolesPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// as BusinessListPage.
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
import { useRolesQuery, useDeleteRoleMutation } from '../hooks'
import { roleTableColumns, RoleFilters, RoleStatsCards } from '../components'
import { ROLE_TYPE_LABELS } from '../constants'
import type { Role, RoleListFilters, RoleType } from '../types'
import { AdministrationNav } from '@/modules/administration/components'

export function RolesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<RoleType | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: RoleListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    type,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useRolesQuery(filters)
  const deleteMutation = useDeleteRoleMutation()

  const handleBulkDelete = async (selected: Role[]) => {
    const deletable = selected.filter((r) => r.type !== 'SYSTEM')
    if (deletable.length === 0) return
    if (!window.confirm(`Delete ${deletable.length} role${deletable.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const role of deletable) {
      await deleteMutation.mutateAsync(role.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(type ? [{ key: 'type', label: `Type: ${ROLE_TYPE_LABELS[type]}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'type') setType(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setType(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Roles"
        description="Define roles and the permissions they grant."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="roles"
              columns={[
                { header: 'Name', accessor: (r) => r.name },
                { header: 'Type', accessor: (r) => r.type },
                { header: 'Active', accessor: (r) => (r.isActive ? 'Yes' : 'No') },
                { header: 'Permissions', accessor: (r) => r.permissionCodes.length },
                { header: 'Created', accessor: (r) => r.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.ROLES_MANAGE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/staff/roles/new')}>
                New role
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <AdministrationNav />
          <RoleStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Role>
            columns={roleTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No roles yet"
            emptyDescription="Roles you create will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by role name…"
            toolbarFilters={
              <RoleFilters
                type={type}
                onTypeChange={(next) => {
                  setType(next)
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
              <Can permission={PERMISSIONS.ROLES_MANAGE}>
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
            onRowClick={(row) => navigate(`/staff/roles/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
