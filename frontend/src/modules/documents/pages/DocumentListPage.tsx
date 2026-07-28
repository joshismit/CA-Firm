// src/modules/documents/pages/DocumentListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// architecture as Business/Contacts/CRM list pages - DataTable's own built-in toolbar is used
// rather than a second page-level PageToolbar/PageSearch/PageFilters row, for the identical reasons
// documented there.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useDocumentsQuery, useDeleteDocumentMutation } from '../hooks'
import { documentTableColumns } from '../components/DocumentTableColumns'
import { DocumentFilters } from '../components/DocumentFilters'
import type { DocumentFile, DocumentCategory, DocumentListFilters } from '../types'

export function DocumentListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentCategory | undefined>()
  const [businessId, setBusinessId] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const filters: DocumentListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: search || undefined,
    category,
    businessId: businessId || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useDocumentsQuery(filters)
  const deleteMutation = useDeleteDocumentMutation()

  const handleBulkDelete = async (selected: DocumentFile[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} document${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    // No bulk-delete endpoint exists - this calls the existing single-item deleteDocument mutation
    // once per selected row rather than inventing a new bulk API.
    for (const document of selected) {
      await deleteMutation.mutateAsync(document.id)
    }
    setRowSelection({})
  }

  return (
    <PageLayout>
      <PageHeader
        title="Documents"
        description={data?.meta ? `${data.meta.total} document${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <Can permission={PERMISSIONS.DOCUMENTS_CREATE}>
              <Button leadingIcon={<Upload className="w-3.5 h-3.5" />} onClick={() => navigate('/documents/upload')}>
                Upload Document
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <DataTable<DocumentFile>
          columns={documentTableColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No documents yet"
          emptyDescription="Documents you upload will show up here."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchPlaceholder="Search by file name…"
          toolbarFilters={
            <DocumentFilters
              category={category}
              onCategoryChange={(next) => {
                setCategory(next)
                setPageIndex(0)
              }}
              businessId={businessId}
              onBusinessIdChange={(next) => {
                setBusinessId(next)
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
            <Can permission={PERMISSIONS.DOCUMENTS_DELETE}>
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
          onRowClick={(row) => navigate(`/documents/${row.id}`)}
        />
      </PageContent>
    </PageLayout>
  )
}
