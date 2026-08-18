// src/modules/documents/pages/DocumentListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// architecture as Business/Contacts/CRM list pages - DataTable's own built-in toolbar is used
// rather than a second page-level PageToolbar/PageSearch/PageFilters row, for the identical reasons
// documented there.
//
// No file-type filter here: DocumentSearchFilters (backend/src/modules/documents/repository/
// document.repository.ts) only accepts `category`/`businessId`/`search` - there's no mimeType query
// param to filter by server-side, and client-filtering one already-paginated page by mimeType would
// silently miss matches sitting on other pages. Category already covers most of the same intent
// (e.g. PAN documents are near-always PDFs/images) without fabricating a broken filter.
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, Trash2 } from 'lucide-react'
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
import { formatFileSize } from '@/lib/utils'
import { useDocumentsQuery, useDeleteDocumentMutation } from '../hooks'
import { documentTableColumns } from '../components/DocumentTableColumns'
import { DocumentFilters } from '../components/DocumentFilters'
import { DOCUMENT_CATEGORY_LABELS } from '../constants'
import type { DocumentFile, DocumentCategory, DocumentListFilters } from '../types'

export function DocumentListPage() {
  const navigate = useNavigate()
  // Reads an initial `?businessId=` set by BusinessDocumentsCard's "View all" link - still fully
  // editable/clearable from here afterwards, same as every other DataTable filter.
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentCategory | undefined>()
  const [businessId, setBusinessId] = useState(searchParams.get('businessId') ?? '')
  const [folderId, setFolderId] = useState(searchParams.get('folderId') ?? '')
  const [uploadedFrom, setUploadedFrom] = useState('')
  const [uploadedTo, setUploadedTo] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: DocumentListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    category,
    businessId: businessId || undefined,
    folderId: folderId || undefined,
    uploadedFrom: uploadedFrom || undefined,
    uploadedTo: uploadedTo || undefined,
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

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(category ? [{ key: 'category', label: `Category: ${DOCUMENT_CATEGORY_LABELS[category] ?? category}` }] : []),
    ...(businessId ? [{ key: 'businessId', label: `Business: ${businessId.slice(0, 8)}…` }] : []),
    ...(folderId ? [{ key: 'folderId', label: `Folder: ${folderId.slice(0, 8)}…` }] : []),
    ...(uploadedFrom ? [{ key: 'uploadedFrom', label: `Uploaded from: ${uploadedFrom}` }] : []),
    ...(uploadedTo ? [{ key: 'uploadedTo', label: `Uploaded to: ${uploadedTo}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'category') setCategory(undefined)
    if (key === 'businessId') setBusinessId('')
    if (key === 'folderId') setFolderId('')
    if (key === 'uploadedFrom') setUploadedFrom('')
    if (key === 'uploadedTo') setUploadedTo('')
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setCategory(undefined)
    setBusinessId('')
    setFolderId('')
    setUploadedFrom('')
    setUploadedTo('')
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Documents"
        description={data?.meta ? `${data.meta.total} document${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="documents"
              columns={[
                { header: 'File Name', accessor: (d) => d.fileName },
                { header: 'Category', accessor: (d) => DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category },
                { header: 'Size', accessor: (d) => formatFileSize(d.sizeBytes) },
                { header: 'Version', accessor: (d) => d.version },
                { header: 'Uploaded', accessor: (d) => d.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.DOCUMENTS_CREATE}>
              <Button leadingIcon={<Upload className="w-3.5 h-3.5" />} onClick={() => navigate('/documents/upload')}>
                Upload Document
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

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
                folderId={folderId}
                onFolderIdChange={(next) => {
                  setFolderId(next)
                  setPageIndex(0)
                }}
                uploadedFrom={uploadedFrom}
                onUploadedFromChange={(next) => {
                  setUploadedFrom(next)
                  setPageIndex(0)
                }}
                uploadedTo={uploadedTo}
                onUploadedToChange={(next) => {
                  setUploadedTo(next)
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
        </div>
      </PageContent>
    </PageLayout>
  )
}
