// src/modules/master-admin/pages/TenantsListPage.tsx
// Reference composition: PageLayout > PageHeader > PageContent > DataTable, wired to the tenants
// stub (api/index.ts's notImplemented()). Read-only - tenant provisioning happens through signup,
// not an admin "create" action, so no create/edit flow is offered here.
import { useState } from 'react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Select } from '@/components/ui/select'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useTenantsQuery } from '../hooks'
import { tenantTableColumns } from '../components'
import { TENANT_STATUS_LABELS } from '../constants'
import type { Tenant, TenantListFilters, TenantStatus } from '../types'

const STATUS_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(TENANT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export function TenantsListPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TenantStatus | '__all__'>('__all__')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: TenantListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: status === '__all__' ? undefined : status,
  }

  const { data, isLoading, isError, error, refetch } = useTenantsQuery(filters)

  return (
    <PageLayout>
      <PageHeader title="Tenants" description="Every firm provisioned on this platform." />
      <PageContent>
        <DataTable<Tenant>
          columns={tenantTableColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No tenants yet"
          emptyDescription="Firms that sign up will show up here."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchPlaceholder="Search by firm name…"
          toolbarFilters={
            <Select
              value={status}
              onChange={(value) => {
                setStatus(value as TenantStatus | '__all__')
                setPageIndex(0)
              }}
              options={STATUS_OPTIONS}
              className="h-9 w-[180px]"
              placeholder="Status"
            />
          }
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
        />
      </PageContent>
    </PageLayout>
  )
}
