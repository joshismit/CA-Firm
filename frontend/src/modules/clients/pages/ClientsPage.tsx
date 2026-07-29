// src/modules/clients/pages/ClientsPage.tsx
// "All Clients" - a cross-domain hub composing the real Business and Contacts modules (GET
// /business, GET /contacts) rather than a dedicated Clients backend, which doesn't exist yet (see
// backend/src/app.ts - no /clients route is mounted; the Client Prisma model has no controller/
// routes). No new API is invented here: every query below reuses useBusinessesQuery/
// useContactsQuery, the same hooks BusinessListPage/ContactsListPage already call.
//
// Per-tab table columns, filters, and CSV export shape are imported unchanged from the Business and
// Contacts modules (businessTableColumns/BusinessFilters, contactTableColumns/ContactFilters) - only
// the page-level state orchestration (search/sort/pagination per entity) lives here, mirroring
// BusinessListPage/ContactsListPage's own composition since each entity has a distinct filter shape
// and can't share that wiring without inventing an abstraction neither page asked for.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useBusinessesQuery, useDeleteBusinessMutation } from '@/modules/business/hooks'
import { businessTableColumns, BusinessFilters } from '@/modules/business/components'
import { BUSINESS_STATUS_LABELS } from '@/modules/business/constants'
import type { Business, BusinessListFilters, BusinessStatus } from '@/modules/business/types'
import { useContactsQuery, useDeleteContactMutation } from '@/modules/contacts/hooks'
import { contactTableColumns, ContactFilters } from '@/modules/contacts/components'
import type { Contact, ContactListFilters } from '@/modules/contacts/types'
import { ClientsSummaryCards, ClientsQuickActions, ClientsRecentActivity } from '../components'

type ClientsTab = 'businesses' | 'contacts'

export function ClientsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<ClientsTab>('businesses')

  // ─── Businesses tab state ────────────────────────────────────────────────
  const [bizSearch, setBizSearch] = useState('')
  const [bizStatus, setBizStatus] = useState<BusinessStatus | undefined>()
  const [bizTypeId, setBizTypeId] = useState<string | undefined>()
  const [bizSorting, setBizSorting] = useState<SortingState>([])
  const [bizRowSelection, setBizRowSelection] = useState<RowSelectionState>({})
  const [bizPageIndex, setBizPageIndex] = useState(0)
  const [bizPageSize, setBizPageSize] = useState(20)
  const debouncedBizSearch = useDebounce(bizSearch, 300)

  const businessFilters: BusinessListFilters = {
    page: bizPageIndex + 1,
    limit: bizPageSize,
    search: debouncedBizSearch || undefined,
    status: bizStatus,
    typeId: bizTypeId,
    sortBy: bizSorting[0]?.id,
    sortOrder: bizSorting[0] ? (bizSorting[0].desc ? 'desc' : 'asc') : undefined,
  }
  const businessesQuery = useBusinessesQuery(businessFilters)
  const deleteBusinessMutation = useDeleteBusinessMutation()

  const handleBulkDeleteBusinesses = async (selected: Business[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} business${selected.length === 1 ? '' : 'es'}? This cannot be undone.`)) return
    for (const business of selected) {
      await deleteBusinessMutation.mutateAsync(business.id)
    }
    setBizRowSelection({})
  }

  const bizChips: FilterChip[] = [
    ...(debouncedBizSearch ? [{ key: 'search', label: `Search: "${debouncedBizSearch}"` }] : []),
    ...(bizStatus ? [{ key: 'status', label: `Status: ${BUSINESS_STATUS_LABELS[bizStatus] ?? bizStatus}` }] : []),
    ...(bizTypeId ? [{ key: 'typeId', label: `Type: ${bizTypeId.slice(0, 8)}…` }] : []),
  ]
  const removeBizChip = (key: string) => {
    if (key === 'search') setBizSearch('')
    if (key === 'status') setBizStatus(undefined)
    if (key === 'typeId') setBizTypeId(undefined)
    setBizPageIndex(0)
  }
  const clearBizChips = () => {
    setBizSearch('')
    setBizStatus(undefined)
    setBizTypeId(undefined)
    setBizPageIndex(0)
  }

  // ─── Contacts tab state ──────────────────────────────────────────────────
  const [contactSearch, setContactSearch] = useState('')
  const [contactBusinessId, setContactBusinessId] = useState('')
  const [contactSorting, setContactSorting] = useState<SortingState>([])
  const [contactRowSelection, setContactRowSelection] = useState<RowSelectionState>({})
  const [contactPageIndex, setContactPageIndex] = useState(0)
  const [contactPageSize, setContactPageSize] = useState(20)
  const debouncedContactSearch = useDebounce(contactSearch, 300)

  const contactFilters: ContactListFilters = {
    page: contactPageIndex + 1,
    limit: contactPageSize,
    search: debouncedContactSearch || undefined,
    businessId: contactBusinessId || undefined,
    sortBy: contactSorting[0]?.id,
    sortOrder: contactSorting[0] ? (contactSorting[0].desc ? 'desc' : 'asc') : undefined,
  }
  const contactsQuery = useContactsQuery(contactFilters)
  const deleteContactMutation = useDeleteContactMutation()

  const handleBulkDeleteContacts = async (selected: Contact[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} contact${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const contact of selected) {
      await deleteContactMutation.mutateAsync(contact.id)
    }
    setContactRowSelection({})
  }

  const contactChips: FilterChip[] = [
    ...(debouncedContactSearch ? [{ key: 'search', label: `Search: "${debouncedContactSearch}"` }] : []),
    ...(contactBusinessId ? [{ key: 'businessId', label: `Business: ${contactBusinessId.slice(0, 8)}…` }] : []),
  ]
  const removeContactChip = (key: string) => {
    if (key === 'search') setContactSearch('')
    if (key === 'businessId') setContactBusinessId('')
    setContactPageIndex(0)
  }
  const clearContactChips = () => {
    setContactSearch('')
    setContactBusinessId('')
    setContactPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="All Clients"
        description="Unified view across Businesses and Contacts"
        actions={
          <PageActions>
            {tab === 'businesses' ? (
              <>
                <ExportButton
                  rows={businessesQuery.data?.data ?? []}
                  filename="businesses"
                  columns={[
                    { header: 'Name', accessor: (b) => b.name },
                    { header: 'Legal Name', accessor: (b) => b.legalName },
                    { header: 'PAN', accessor: (b) => b.pan },
                    { header: 'GSTIN', accessor: (b) => b.gstin },
                    { header: 'Status', accessor: (b) => b.status },
                    { header: 'Industry', accessor: (b) => b.industry },
                    { header: 'Created', accessor: (b) => b.createdAt },
                  ]}
                />
                <Can permission={PERMISSIONS.BUSINESS_CREATE}>
                  <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/business/new')}>
                    New Business
                  </Button>
                </Can>
              </>
            ) : (
              <>
                <ExportButton
                  rows={contactsQuery.data?.data ?? []}
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
              </>
            )}
          </PageActions>
        }
      />

      <PageContent>
        <ClientsSummaryCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <ClientsQuickActions />
          </div>
          <div className="lg:col-span-2">
            <ClientsRecentActivity />
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={(v) => setTab(v as ClientsTab)}
          tabs={[
            { value: 'businesses', label: 'Businesses', badge: businessesQuery.data?.meta.total },
            { value: 'contacts', label: 'Contacts', badge: contactsQuery.data?.meta.total },
          ]}
        />

        {tab === 'businesses' ? (
          <div className="space-y-4">
            <FilterChips chips={bizChips} onRemove={removeBizChip} onClearAll={clearBizChips} />
            <DataTable<Business>
              columns={businessTableColumns}
              data={businessesQuery.data?.data ?? []}
              isLoading={businessesQuery.isLoading}
              isError={businessesQuery.isError}
              errorMessage={businessesQuery.isError ? normalizeApiError(businessesQuery.error).message : undefined}
              onRetry={businessesQuery.refetch}
              emptyTitle="No businesses yet"
              emptyDescription="Businesses you create will show up here."
              searchValue={bizSearch}
              onSearchChange={(value) => {
                setBizSearch(value)
                setBizPageIndex(0)
              }}
              searchPlaceholder="Search by name, PAN, GSTIN…"
              toolbarFilters={
                <BusinessFilters
                  status={bizStatus}
                  onStatusChange={(next) => {
                    setBizStatus(next)
                    setBizPageIndex(0)
                  }}
                  typeId={bizTypeId}
                  onTypeIdChange={(next) => {
                    setBizTypeId(next)
                    setBizPageIndex(0)
                  }}
                />
              }
              sorting={bizSorting}
              onSortingChange={setBizSorting}
              pageIndex={bizPageIndex}
              pageSize={bizPageSize}
              pageCount={businessesQuery.data?.meta?.totalPages ?? 0}
              totalRows={businessesQuery.data?.meta?.total}
              onPageChange={setBizPageIndex}
              onPageSizeChange={(size) => {
                setBizPageSize(size)
                setBizPageIndex(0)
              }}
              enableRowSelection
              rowSelection={bizRowSelection}
              onRowSelectionChange={setBizRowSelection}
              getRowId={(row) => row.id}
              bulkActions={(selected) => (
                <Can permission={PERMISSIONS.BUSINESS_DELETE}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleBulkDeleteBusinesses(selected)}
                    loading={deleteBusinessMutation.isPending}
                  >
                    Delete selected
                  </Button>
                </Can>
              )}
              onRowClick={(row) => navigate(`/business/${row.id}`)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <FilterChips chips={contactChips} onRemove={removeContactChip} onClearAll={clearContactChips} />
            <DataTable<Contact>
              columns={contactTableColumns}
              data={contactsQuery.data?.data ?? []}
              isLoading={contactsQuery.isLoading}
              isError={contactsQuery.isError}
              errorMessage={contactsQuery.isError ? normalizeApiError(contactsQuery.error).message : undefined}
              onRetry={contactsQuery.refetch}
              emptyTitle="No contacts yet"
              emptyDescription="Contacts you create will show up here."
              searchValue={contactSearch}
              onSearchChange={(value) => {
                setContactSearch(value)
                setContactPageIndex(0)
              }}
              searchPlaceholder="Search by name, email, phone…"
              toolbarFilters={
                <ContactFilters
                  businessId={contactBusinessId}
                  onBusinessIdChange={(next) => {
                    setContactBusinessId(next)
                    setContactPageIndex(0)
                  }}
                />
              }
              sorting={contactSorting}
              onSortingChange={setContactSorting}
              pageIndex={contactPageIndex}
              pageSize={contactPageSize}
              pageCount={contactsQuery.data?.meta?.totalPages ?? 0}
              totalRows={contactsQuery.data?.meta?.total}
              onPageChange={setContactPageIndex}
              onPageSizeChange={(size) => {
                setContactPageSize(size)
                setContactPageIndex(0)
              }}
              enableRowSelection
              rowSelection={contactRowSelection}
              onRowSelectionChange={setContactRowSelection}
              getRowId={(row) => row.id}
              bulkActions={(selected) => (
                <Can permission={PERMISSIONS.CONTACTS_DELETE}>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleBulkDeleteContacts(selected)}
                    loading={deleteContactMutation.isPending}
                  >
                    Delete selected
                  </Button>
                </Can>
              )}
              onRowClick={(row) => navigate(`/contacts/${row.id}`)}
            />
          </div>
        )}
      </PageContent>
    </PageLayout>
  )
}
