// src/components/page/PageToolbar.tsx
// Generic row for search/filters/actions sitting between PageHeader and PageContent - the
// page-level equivalent of components/tables/DataTableToolbar, usable above any content type
// (a DataTable, a Card list, a Kanban board), not just tables.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageToolbarProps {
  children?: ReactNode
  className?: string
}

export function PageToolbar({ children, className }: PageToolbarProps) {
  return <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>{children}</div>
}
