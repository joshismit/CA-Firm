// src/modules/client-billing/pages/PaymentListPage.tsx
// Reference composition: PageLayout > PageHeader (+ PageActions) > PageContent > DataTable, same
// as BusinessListPage/ProjectsPage. No PERMISSIONS.* entry exists for this feature - actions
// aren't wrapped in <Can>.
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
import { usePaymentsQuery, useDeletePaymentMutation } from '../hooks'
import { paymentTableColumns, PaymentFilters, PaymentStatsCards } from '../components'
import { PAYMENT_STATUS_LABELS } from '../constants'
import type { Payment, PaymentListFilters, PaymentStatus } from '../types'

export function PaymentListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<PaymentStatus | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: PaymentListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = usePaymentsQuery(filters)
  const deleteMutation = useDeletePaymentMutation()

  const handleBulkDelete = async (selected: Payment[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} payment${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const payment of selected) {
      await deleteMutation.mutateAsync(payment.id)
    }
    setRowSelection({})
  }

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${PAYMENT_STATUS_LABELS[status]}` }] : []),
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
        title="Payments"
        description="Track payments received from clients."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="payments"
              columns={[
                { header: 'Payment #', accessor: (p) => p.paymentNumber },
                { header: 'Invoice ID', accessor: (p) => p.invoiceId },
                { header: 'Amount', accessor: (p) => p.amount },
                { header: 'Method', accessor: (p) => p.method },
                { header: 'Reference', accessor: (p) => p.reference },
                { header: 'Status', accessor: (p) => p.status },
                { header: 'Paid Date', accessor: (p) => p.paidDate },
                { header: 'Created', accessor: (p) => p.createdAt },
              ]}
            />
            <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/billing/payments/new')}>
              New payment
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <PaymentStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Payment>
            columns={paymentTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No payments yet"
            emptyDescription="Payments you record will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by payment number or reference…"
            toolbarFilters={
              <PaymentFilters
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
            onRowClick={(row) => navigate(`/billing/payments/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
