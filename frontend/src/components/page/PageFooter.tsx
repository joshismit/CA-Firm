// src/components/page/PageFooter.tsx
// Bottom bar for a page - e.g. a sticky save/cancel bar on a form page, or a summary row.
// Distinct from DataTablePagination (table-scoped) - this is page-scoped.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageFooterProps {
  children: ReactNode
  className?: string
}

export function PageFooter({ children, className }: PageFooterProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 pt-4 border-t border-[var(--color-border)]', className)}>
      {children}
    </div>
  )
}
