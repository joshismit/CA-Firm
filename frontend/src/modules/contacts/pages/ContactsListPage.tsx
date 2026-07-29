// src/modules/contacts/pages/ContactsListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable.
// Same architecture as BusinessListPage - DataTable's own built-in toolbar (search/filters/
// column-visibility/bulk-actions in one row) is used rather than a second page-level
// PageToolbar/PageSearch/PageFilters row, for the identical reasons documented there.
import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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
import { useContactsQuery, useDeleteContactMutation } from '../hooks'
import { contactTableColumns } from '../components/ContactTableColumns'
import { ContactFilters } from '../components/ContactFilters'
import { ContactStatsCards } from '../components/ContactStatsCards'
import type { Contact, ContactListFilters } from '../types'

export function ContactsListPage() {
  const navigate = useNavigate()
  // Reads an initial `?businessId=` set by BusinessContactsCard's "View all" link - still fully
  // editable/clearable from here afterwards, same as every other DataTable filter.
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [businessId, setBusinessId] = useState(searchParams.get('businessId') ?? '')
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: ContactListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    businessId: businessId || undefined,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useContactsQuery(filters)
  const deleteMutation = useDeleteContactMutation()

  const handleBulkDelete = async (selected: Contact[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} contact${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    // No bulk-delete endpoint exists - this calls the existing single-item deleteContact mutation
    // once per selected row rather than inventing a new bulk API.
    for (const contact of selected) {
      await deleteMutation.mutateAsync(contact.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(businessId ? [{ key: 'businessId', label: `Business: ${businessId.slice(0, 8)}…` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'businessId') setBusinessId('')
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setBusinessId('')
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Contacts"
        description={data?.meta ? `${data.meta.total} contact${data.meta.total === 1 ? '' : 's'}` : undefined}
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="contacts"
              columns={[
                { header: 'First Name', accessor: (c) => c.firstName },
                { header: 'Last Name', accessor: (c) => c.lastName },
                { header: 'Email', accessor: (c) => c.email },
                { header: 'Phone', accessor: (c) => c.phone },
                { header: 'PAN', accessor: (c) => c.pan },
                { header: 'Created', accessor: (c) => c.createdAt },
              ]}
            />
            <Can permission={PERMISSIONS.CONTACTS_CREATE}>
              <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/contacts/new')}>
                New Contact
              </Button>
            </Can>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <ContactStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Contact>
            columns={contactTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No contacts yet"
            emptyDescription="Contacts you create will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by name, email, phone…"
            toolbarFilters={
              <ContactFilters
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
              <Can permission={PERMISSIONS.CONTACTS_DELETE}>
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
            onRowClick={(row) => navigate(`/contacts/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
