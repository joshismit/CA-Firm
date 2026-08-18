// src/components/tables/DataTableToolbar.tsx
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface DataTableToolbarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  /** Extra filter controls (e.g. a status <Select/>) rendered next to the search input. */
  filters?: ReactNode
  selectedCount?: number
  bulkActions?: ReactNode
  columnToggle?: ReactNode
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  selectedCount = 0,
  bulkActions,
  columnToggle,
}: DataTableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          icon={<Search size={14} />}
          className="w-full sm:w-64"
        />
        {filters}
      </div>
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)]">
            <span>{selectedCount} selected</span>
            {bulkActions}
          </div>
        )}
        {columnToggle}
      </div>
    </div>
  )
}
