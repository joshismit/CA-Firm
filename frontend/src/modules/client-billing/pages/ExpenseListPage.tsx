// src/modules/client-billing/pages/ExpenseListPage.tsx
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
import { useExpensesQuery, useDeleteExpenseMutation } from '../hooks'
import { expenseTableColumns, ExpenseFilters, ExpenseStatsCards } from '../components'
import { EXPENSE_STATUS_LABELS, EXPENSE_CATEGORY_OPTIONS } from '../constants'
import type { Expense, ExpenseListFilters, ExpenseStatus } from '../types'

export function ExpenseListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ExpenseStatus | undefined>()
  const [category, setCategory] = useState<string | undefined>()
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const debouncedSearch = useDebounce(search, 300)

  const filters: ExpenseListFilters = {
    page: pageIndex + 1,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status,
    category,
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
  }

  const { data, isLoading, isError, error, refetch } = useExpensesQuery(filters)
  const deleteMutation = useDeleteExpenseMutation()

  const handleBulkDelete = async (selected: Expense[]) => {
    if (selected.length === 0) return
    if (!window.confirm(`Delete ${selected.length} expense${selected.length === 1 ? '' : 's'}? This cannot be undone.`)) return
    for (const expense of selected) {
      await deleteMutation.mutateAsync(expense.id)
    }
    setRowSelection({})
  }

  const categoryLabel = (value: string) => EXPENSE_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value

  const chips: FilterChip[] = [
    ...(debouncedSearch ? [{ key: 'search', label: `Search: "${debouncedSearch}"` }] : []),
    ...(status ? [{ key: 'status', label: `Status: ${EXPENSE_STATUS_LABELS[status]}` }] : []),
    ...(category ? [{ key: 'category', label: `Category: ${categoryLabel(category)}` }] : []),
  ]

  const removeChip = (key: string) => {
    if (key === 'search') setSearch('')
    if (key === 'status') setStatus(undefined)
    if (key === 'category') setCategory(undefined)
    setPageIndex(0)
  }

  const clearAllChips = () => {
    setSearch('')
    setStatus(undefined)
    setCategory(undefined)
    setPageIndex(0)
  }

  return (
    <PageLayout>
      <PageHeader
        title="Expenses"
        description="Track expenses incurred by the firm."
        actions={
          <PageActions>
            <ExportButton
              rows={data?.data ?? []}
              filename="expenses"
              columns={[
                { header: 'Expense #', accessor: (e) => e.expenseNumber },
                { header: 'Category', accessor: (e) => e.category },
                { header: 'Vendor', accessor: (e) => e.vendor },
                { header: 'Amount', accessor: (e) => e.amount },
                { header: 'Status', accessor: (e) => e.status },
                { header: 'Date', accessor: (e) => e.date },
                { header: 'Payment Method', accessor: (e) => e.paymentMethod },
                { header: 'Created', accessor: (e) => e.createdAt },
              ]}
            />
            <Button leadingIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => navigate('/billing/expenses/new')}>
              New expense
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <ExpenseStatsCards />

          <FilterChips chips={chips} onRemove={removeChip} onClearAll={clearAllChips} />

          <DataTable<Expense>
            columns={expenseTableColumns}
            data={data?.data ?? []}
            isLoading={isLoading}
            isError={isError}
            errorMessage={isError ? normalizeApiError(error).message : undefined}
            onRetry={refetch}
            emptyTitle="No expenses yet"
            emptyDescription="Expenses you record will show up here."
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPageIndex(0)
            }}
            searchPlaceholder="Search by expense number or vendor…"
            toolbarFilters={
              <ExpenseFilters
                status={status}
                onStatusChange={(next) => {
                  setStatus(next)
                  setPageIndex(0)
                }}
                category={category}
                onCategoryChange={(next) => {
                  setCategory(next)
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
            onRowClick={(row) => navigate(`/billing/expenses/${row.id}`)}
          />
        </div>
      </PageContent>
    </PageLayout>
  )
}
