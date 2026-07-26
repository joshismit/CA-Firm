// src/components/tables/DataTablePagination.tsx
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Select } from '@/components/ui/select'

export interface DataTablePaginationProps {
  /** 0-based current page index. */
  pageIndex: number
  pageCount: number
  pageSize: number
  totalRows?: number
  onPageChange?: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function DataTablePagination({
  pageIndex,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTablePaginationProps) {
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1

  const rangeStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = totalRows != null ? Math.min((pageIndex + 1) * pageSize, totalRows) : (pageIndex + 1) * pageSize

  const navBtn = 'flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] disabled:opacity-40 hover:bg-[var(--color-hover)] transition-colors'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]">
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange?.(Number(v))}
          options={pageSizeOptions.map((n) => ({ value: String(n), label: String(n) }))}
          className="h-8 w-[72px]"
        />
      </div>

      <div className="flex items-center gap-4">
        <span>
          {totalRows != null
            ? `${rangeStart}-${rangeEnd} of ${totalRows}`
            : `Page ${pageIndex + 1} of ${Math.max(pageCount, 1)}`}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" disabled={!canPrev} onClick={() => onPageChange?.(0)} className={navBtn} aria-label="First page">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={!canPrev} onClick={() => onPageChange?.(pageIndex - 1)} className={navBtn} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={!canNext} onClick={() => onPageChange?.(pageIndex + 1)} className={navBtn} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" disabled={!canNext} onClick={() => onPageChange?.(pageCount - 1)} className={navBtn} aria-label="Last page">
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
