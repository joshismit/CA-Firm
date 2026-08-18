// src/modules/documents/pages/DocumentTemplatesPage.tsx
// Reference composition: PageLayout > PageHeader > PageContent > DataTable, same as
// DocumentListPage - but wired to the templates stub (api/index.ts's notImplemented()) rather
// than the real Documents backend, since no template Prisma model/routes exist yet. No create/edit
// flow is offered here (unlike Compliance's "New filing") since there's no plausible endpoint to
// point it at - once a backend exists, add DocumentTemplateCreatePage/EditPage then.
import { useState } from 'react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Select } from '@/components/ui/select'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useDocumentTemplatesQuery } from '../hooks'
import { documentTemplateTableColumns } from '../components'
import { DOCUMENT_CATEGORY_OPTIONS } from '../constants'
import type { DocumentCategory, DocumentTemplate, DocumentTemplateListFilters } from '../types'

const CATEGORY_FILTER_OPTIONS = [{ value: '__all__', label: 'All categories' }, ...DOCUMENT_CATEGORY_OPTIONS]

export function DocumentTemplatesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<DocumentCategory | '__all__'>('__all__')
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: DocumentTemplateListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    category: category === '__all__' ? undefined : category,
  }

  const { data, isLoading, isError, error, refetch } = useDocumentTemplatesQuery(filters)

  return (
    <PageLayout>
      <PageHeader title="Templates" description="Reusable document templates for engagement letters, NOCs, and other client paperwork." />

      <PageContent>
        <DataTable<DocumentTemplate>
          columns={documentTemplateTableColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          isError={isError}
          errorMessage={isError ? normalizeApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle="No templates yet"
          emptyDescription="Templates your firm creates will show up here."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPageIndex(0)
          }}
          searchPlaceholder="Search templates…"
          toolbarFilters={
            <Select
              value={category}
              onChange={(value) => {
                setCategory(value as DocumentCategory | '__all__')
                setPageIndex(0)
              }}
              options={CATEGORY_FILTER_OPTIONS}
              className="h-9 w-[180px]"
              placeholder="Category"
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
