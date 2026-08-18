// src/components/tables/DataTable.tsx
// Reusable enterprise DataTable on top of @tanstack/react-table. Sorting/search/pagination each
// run in "server mode" (controlled via props) when their corresponding on*Change callback is
// passed, and fall back to client-side TanStack row models otherwise - so the same component
// works for a live paginated API (Projects/Tasks today) or a small in-memory dataset alike.
// Visual conventions (header/row/hover classes) match the precedent in DashboardPage's original
// hand-rolled <table>, just centralized here so every future module can reuse it unmodified.

import { useState, type ReactNode } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton, EmptyState, ErrorState } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { DataTableToolbar } from './DataTableToolbar'
import { DataTablePagination } from './DataTablePagination'
import { DataTableColumnToggle } from './DataTableColumnToggle'

export interface DataTableProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]

  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  emptyState?: ReactNode
  emptyTitle?: string
  emptyDescription?: string

  /** 0-based current page. Providing both pageIndex and pageCount switches pagination to server mode. */
  pageIndex?: number
  pageSize?: number
  pageCount?: number
  totalRows?: number
  onPageChange?: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]

  /** Providing onSortingChange switches sorting to server mode. */
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void

  /** Providing onSearchChange switches global search to server mode. */
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string

  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: (state: RowSelectionState) => void
  getRowId?: (row: TData, index: number) => string

  /** Rendered inside the toolbar's selection pill once at least one row is selected. */
  bulkActions?: (selectedRows: TData[]) => ReactNode

  enableColumnVisibility?: boolean
  /** Extra filter controls (e.g. a status <Select/>) rendered in the toolbar next to search. */
  toolbarFilters?: ReactNode
  hideToolbar?: boolean

  onRowClick?: (row: TData) => void
  className?: string
}

export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  emptyState,
  emptyTitle = 'No results',
  emptyDescription = 'There is no data to display yet.',
  pageIndex,
  pageSize = 20,
  pageCount,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  sorting: controlledSorting,
  onSortingChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  enableRowSelection = false,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  getRowId,
  bulkActions,
  enableColumnVisibility = true,
  toolbarFilters,
  hideToolbar = false,
  onRowClick,
  className,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({})
  const [internalSearch, setInternalSearch] = useState('')
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const isServerSorted = !!onSortingChange
  const isServerSearched = !!onSearchChange
  const isServerPaginated = pageIndex != null && pageCount != null

  const sorting = controlledSorting ?? internalSorting
  const rowSelection = controlledRowSelection ?? internalRowSelection
  const search = isServerSearched ? searchValue ?? '' : internalSearch

  const selectionColumn: ColumnDef<TData, TValue> | null = enableRowSelection
    ? {
        id: '__select__',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all rows"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        size: 36,
        enableSorting: false,
        enableHiding: false,
      }
    : null

  const finalColumns = selectionColumn ? [selectionColumn, ...columns] : columns

  const table = useReactTable({
    data,
    columns: finalColumns,
    state: {
      sorting,
      rowSelection,
      columnVisibility,
      columnFilters,
      globalFilter: isServerSearched ? undefined : search,
      ...(isServerPaginated ? { pagination: { pageIndex: pageIndex!, pageSize } } : {}),
    },
    manualSorting: isServerSorted,
    manualFiltering: isServerSearched,
    manualPagination: isServerPaginated,
    pageCount: isServerPaginated ? pageCount : undefined,
    getRowId,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      if (onSortingChange) onSortingChange(next)
      else setInternalSorting(next)
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater
      if (onRowSelectionChange) onRowSelectionChange(next)
      else setInternalRowSelection(next)
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (v) => {
      if (isServerSearched) onSearchChange?.(v)
      else setInternalSearch(v)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: isServerSorted ? undefined : getSortedRowModel(),
    getFilteredRowModel: isServerSearched ? undefined : getFilteredRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const columnCount = finalColumns.length

  return (
    <div className={cn('space-y-3', className)}>
      {!hideToolbar && (
        <DataTableToolbar
          searchValue={search}
          onSearchChange={(v) => {
            if (isServerSearched) onSearchChange?.(v)
            else setInternalSearch(v)
          }}
          searchPlaceholder={searchPlaceholder}
          filters={toolbarFilters}
          selectedCount={selectedRows.length}
          bulkActions={bulkActions?.(selectedRows)}
          columnToggle={enableColumnVisibility ? <DataTableColumnToggle table={table} /> : null}
        />
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-[12px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--color-border)]">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'py-2.5 px-4 first:pl-4 last:pr-4 text-left',
                        'text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]',
                        canSort && 'cursor-pointer select-none'
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isLoading ? (
              <tr>
                <td colSpan={columnCount} className="p-4">
                  <Skeleton variant="table" rows={5} height={36} />
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={columnCount}>
                  <ErrorState message={errorMessage} onRetry={onRetry} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount}>
                  {emptyState ?? <EmptyState title={emptyTitle} description={emptyDescription} />}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn('group hover:bg-[var(--color-hover)] transition-colors', onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-3 px-4 first:pl-4 last:pr-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isServerPaginated && !isLoading && !isError && (
        <DataTablePagination
          pageIndex={pageIndex!}
          pageCount={pageCount!}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  )
}
