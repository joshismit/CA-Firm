// src/modules/permissions/pages/PermissionsPage.tsx
// Read-only catalog. listPermissions() returns the full list in one call (not paginated), so
// search/resource/action filtering happens client-side over that one fetch, and DataTable runs in
// client mode (no server pageIndex/pageCount wiring) for its own pagination/sorting - there's
// nothing to reuse from the DataTable's server mode) - PERMISSIONS.ROLES_READ gates
// export since permissions viewing is a role-management concern and no dedicated
// "permissions" resource exists in the backend's permission enum.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Can } from '@/components/common/Can'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { usePermissionsQuery } from '../hooks'
import { permissionTableColumns, PermissionFilters, PermissionStatsCards } from '../components'
import { AdministrationNav } from '@/modules/administration/components'

export function PermissionsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [resource, setResource] = useState<string | undefined>()
  const [action, setAction] = useState<string | undefined>()

  const { data, isLoading, isError, error, refetch } = usePermissionsQuery()

  const filtered = useMemo(() => {
    return (data ?? []).filter((p) => {
      const matchesSearch = !search || p.code.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase())
      const matchesResource = !resource || p.resource === resource
      const matchesAction = !action || p.action === action
      return matchesSearch && matchesResource && matchesAction
    })
  }, [data, search, resource, action])

  return (
    <PageLayout>
      <PageHeader
        title="Permissions"
        description="The full permission catalog - read-only."
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.ROLES_READ}>
              <ExportButton
                rows={filtered}
                filename="permissions"
                columns={[
                  { header: 'Code', accessor: (p) => p.code },
                  { header: 'Name', accessor: (p) => p.name },
                  { header: 'Resource', accessor: (p) => p.resource },
                  { header: 'Action', accessor: (p) => p.action },
                  { header: 'Sensitive', accessor: (p) => (p.isSensitive ? 'Yes' : 'No') },
                ]}
              />
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <AdministrationNav />
          <PermissionStatsCards />

          <DataTable
            columns={permissionTableColumns}
            data={filtered}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No permissions found"
            emptyDescription="The permission catalog will appear here once available."
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by code or name…"
            toolbarFilters={
              <PermissionFilters resource={resource} onResourceChange={setResource} action={action} onActionChange={setAction} />
            }
            getRowId={(row) => row.id}
            onRowClick={(row) => navigate(`/staff/permissions/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
