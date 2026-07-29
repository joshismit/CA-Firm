// src/modules/client-billing/pages/InvoiceListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// as BusinessListPage/ProjectsPage. No PERMISSIONS.* entry exists for this feature (the existing
// PERMISSIONS.BILLING_* pair is the unrelated SaaS-subscription resource - see types/index.ts's
// header comment) - actions aren't wrapped in <Can> the way Business/Projects actions are.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import type { RowSelectionState, SortingState } from '@tanstack/react-table'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { DataTable } from '@/components/tables'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/shared/ExportButton/ExportButton'
import { FilterChips, type FilterChip } from '@/components/shared/FilterChips/FilterChips'
import { normalizeApiError } from '@/services/api-error'
import { useDebounce } from '@/hooks'
import { useInvoicesQuery, useDeleteInvoiceMutation } from '../hooks'
import { invoiceTableColumns, InvoiceFilters, InvoiceStatsCards } from '../components'
import { INVOICE_STATUS_LABELS } from '../constants'
import type { Invoice, InvoiceListFilters, InvoiceStatus } from '../types'

export function InvoiceListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: InvoiceListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useInvoicesQuery(filters)
  const deleteMutation = useDeleteInvoiceMutation()

  const handleBulkDelete = async (selected: Invoice[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} invoice${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const invoice of selected) {
      await deleteMutation.mutateAsync(invoice.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${INVOICE_STATUS_LABELS[status]}` }] : []),
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
        title="Invoices"
        description="Track invoices issued to clients."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="invoices"
              columns={[
                { header: 'Invoice #', accessor: (i) => i.invoiceNumber },
                { header: 'Client ID', accessor: (i) => i.clientId },
                { header: 'Business ID', accessor: (i) => i.businessId },
                { header: 'Amount', accessor: (i) => i.amount },
                { header: 'Tax', accessor: (i) => i.tax },
                { header: 'Status', accessor: (i) => i.status },
                { header: 'Due Date', accessor: (i) => i.dueDate },
                { header: 'Created', accessor: (i) => i.createdAt },
              ]}
            />
            <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/billing/invoices/new')}>
              New invoice
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <InvoiceStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Invoice>
            columns={invoiceTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No invoices yet"
            emptyDescription="Invoices you create will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by invoice number…"
            toolbarFilters={
              <InvoiceFilters
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
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => handleBulkDelete(selected)}
                loading={deleteMutation.isPending}
              >
                Delete selected
              </Button>
            )}
            onRowClick={(row) => navigate(`/billing/invoices/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
