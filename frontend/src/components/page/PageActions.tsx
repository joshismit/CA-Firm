// src/components/page/PageActions.tsx
// Right-aligned row of action buttons - reused both inside PageHeader's `actions` slot and inside
// PageToolbar for secondary/bulk actions, so button spacing stays identical in both spots.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface PageActionsProps {
  children: ReactNode
  className?: string
}

export function PageActions({ children, className }: PageActionsProps) {
  return <div className={cn('flex items-center gap-2 shrink-0', className)}>{children}</div>
}
