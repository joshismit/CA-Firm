// src/modules/users/pages/UsersPage.tsx
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
import { useUsersQuery, useDeleteUserMutation } from '../hooks'
import { usersTableColumns, UsersFilters, UsersStatsCards } from '../components'
import { AdministrationNav } from '@/modules/administration/components'
import { USER_STATUS_LABELS } from '../constants'
import type { User, UserListFilters, UserStatus } from '../types'

export function UsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<UserStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: UserListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useUsersQuery(filters)
  const deleteMutation = useDeleteUserMutation()

  const handleBulkDelete = async (selected: User[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Remove ${selected.length} user${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const user of selected) {
      await deleteMutation.mutateAsync(user.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${USER_STATUS_LABELS[status]}` }] : []),
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
        title="Users"
        description="Manage staff accounts and invitations."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="users"
              columns={[
                { header: 'First Name', accessor: (u) => u.firstName },
                { header: 'Last Name', accessor: (u) => u.lastName },
                { header: 'Email', accessor: (u) => u.email },
                { header: 'Job Title', accessor: (u) => u.jobTitle },
                { header: 'Status', accessor: (u) => u.status },
                { header: 'Last Login', accessor: (u) => u.lastLoginAt },
                { header: 'Joined', accessor: (u) => u.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.USERS_MANAGE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/staff/users/new')}>
                Invite user
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <AdministrationNav />
          <UsersStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<User>
            columns={usersTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No users yet"
            emptyDescription="Staff you invite will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by name or email…"
            toolbarFilters={
              <UsersFilters
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
              <Can permission={PERMISSIONS.USERS_MANAGE}>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleBulkDelete(selected)}
                  loading={deleteMutation.isPending}
                >
                  Remove selected
                </Button>
              </Can>
            )}
            onRowClick={(row) => navigate(`/staff/users/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
