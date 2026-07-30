// src/modules/client-portal/pages/ClientPortalDocumentsPage.tsx
// Read-only from the client's side - no upload/delete actions, unlike the internal
// DocumentListPage. Wired to the shared-documents stub (api/index.ts's notImplemented()).
import { useState } from 'react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { DataTable } from '@/components/tables'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useSharedDocumentsQuery } from '../hooks'
import { sharedDocumentTableColumns } from '../components'
import type { SharedDocument, SharedDocumentListFilters } from '../types'

export function ClientPortalDocumentsPage() {
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: SharedDocumentListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
  }

  const { data, isLoading, isError, error, refetch } = useSharedDocumentsQuery(filters)

  return (
    <PageLayout>
      <PageHeader title="My Documents" description="Documents your firm has shared with you." />
      <PageContent>
        <DataTable<SharedDocument>
          columns={sharedDocumentTableColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No documents yet"
          emptyDescription="Documents your firm shares with you will show up here."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchPlaceholder="Search documents…"
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
