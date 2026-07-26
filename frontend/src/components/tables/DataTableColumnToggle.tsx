// src/components/tables/DataTableColumnToggle.tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, Columns3 } from 'lucide-react'
import type { Table } from '@tanstack/react-table'
import { cn } from '@/lib/utils'

export interface DataTableColumnToggleProps<TData> {
  table: Table<TData>
}

export function DataTableColumnToggle<TData>({ table }: DataTableColumnToggleProps<TData>) {
  const columns = table.getAllLeafColumns().filter((c) => c.getCanHide())

  if (columns.length === 0) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-md)] text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-hover)] transition-colors"
        >
          <Columns3 className="w-3.5 h-3.5" />
          Columns
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-[var(--z-dropdown)] min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-1 shadow-[var(--shadow-lg)]"
        >
          {columns.map((column) => (
            <DropdownMenu.CheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
              className={cn(
                'relative flex cursor-pointer select-none items-center rounded-[var(--radius-sm)] py-2 pl-8 pr-3',
                'text-[13px] text-[var(--color-text-body)] outline-none transition-colors',
                'data-[highlighted]:bg-[var(--color-hover)]'
              )}
            >
              <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="h-3.5 w-3.5 text-[var(--color-primary-600)]" />
                </DropdownMenu.ItemIndicator>
              </span>
              {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
