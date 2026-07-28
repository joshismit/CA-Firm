// src/components/page/PageFilters.tsx
// Groups filter controls (Selects, date pickers, etc.) inside a PageToolbar with consistent spacing.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageFiltersProps {
  children: ReactNode
  className?: string
}

export function PageFilters({ children, className }: PageFiltersProps) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}
